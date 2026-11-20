import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, UserRole, UserStatus } from '@prisma/client';
import type { ConversationDto, MessageDto, MessageListDto, ThreadInfoDto } from '@neo/shared-types';
import type { ListConversationsQuery, ListMessagesQuery, SendMessageInput } from '@neo/validation';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const PREVIEW_LENGTH = 120;
const CONVERSATIONS_LIMIT = 200;

type Row = Prisma.MessageGetPayload<{ select: { id: true; body: true; senderId: true; readAt: true; createdAt: true } }>;
const messageSelect = { id: true, body: true, senderId: true, readAt: true, createdAt: true } as const;

const toDto = (m: Row, viewerId: string): MessageDto => ({
  id: m.id,
  body: m.body,
  mine: m.senderId === viewerId,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt ? m.readAt.toISOString() : null,
});
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
const preview = (body: string) => (body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH - 1)}…` : body);

/**
 * HU-32: mensajería individual. Un hilo por usuaria; la contraparte es la Coach.
 * - La usuaria solo accede a su propio hilo (nunca recibe un id de hilo del cliente).
 * - La Coach accede al hilo de cualquier usuaria activa; si no existe o no es usuaria → 404.
 * - El contenido es texto plano; no se audita el cuerpo (privacidad) y se muestra siempre escapado en la web.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Hilo de la usuaria ──────────────────────────────────────────────────

  threadInfoForUser(user: AuthenticatedUser): Promise<ThreadInfoDto> {
    return this.partnerOf(user.id).then((coach) => ({ partnerName: coach ? fullName(coach) : 'Tu Coach' }));
  }

  listForUser(user: AuthenticatedUser, query: ListMessagesQuery): Promise<MessageListDto> {
    return this.list(user.id, user.id, query);
  }

  async sendAsUser(user: AuthenticatedUser, input: SendMessageInput): Promise<MessageDto> {
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { coachId: true, firstName: true, lastName: true } });
    if (!me?.coachId) throw new ConflictException('Aún no tienes una Coach asignada para escribirle.');
    return this.send({ threadUserId: user.id, sender: user.id, recipientId: me.coachId, senderName: fullName(me), body: input.body });
  }

  markReadForUser(user: AuthenticatedUser) {
    return this.markRead(user.id, UserRole.COACH, user.id);
  }

  // ── Hilos de la Coach ───────────────────────────────────────────────────

  async conversations(query: ListConversationsQuery): Promise<ConversationDto[]> {
    const where: Prisma.UserWhereInput = { role: UserRole.USER, status: UserStatus.ACTIVE };
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: CONVERSATIONS_LIMIT,
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];

    const [lasts, unread] = await Promise.all([
      this.prisma.message.findMany({
        where: { threadUserId: { in: ids } },
        distinct: ['threadUserId'],
        orderBy: [{ threadUserId: 'asc' }, { createdAt: 'desc' }],
        select: { threadUserId: true, body: true, senderId: true, createdAt: true },
      }),
      this.prisma.message.groupBy({
        by: ['threadUserId'],
        where: { threadUserId: { in: ids }, readAt: null, sender: { role: UserRole.USER } },
        _count: { _all: true },
      }),
    ]);
    const lastBy = new Map(lasts.map((m) => [m.threadUserId, m]));
    const unreadBy = new Map(unread.map((g) => [g.threadUserId, g._count._all]));

    const rows: ConversationDto[] = users.map((u) => {
      const last = lastBy.get(u.id);
      return {
        userId: u.id,
        userName: fullName(u),
        lastMessage: last ? { body: preview(last.body), createdAt: last.createdAt.toISOString(), mine: last.senderId !== u.id } : null,
        unread: unreadBy.get(u.id) ?? 0,
      };
    });
    // Con actividad primero (la más reciente arriba); el resto, alfabético (ya viene así).
    return rows.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
  }

  async threadInfoForCoach(userId: string): Promise<ThreadInfoDto> {
    const u = await this.requireThreadUser(userId);
    return { partnerName: fullName(u) };
  }

  async listForCoach(coach: AuthenticatedUser, userId: string, query: ListMessagesQuery): Promise<MessageListDto> {
    await this.requireThreadUser(userId);
    return this.list(userId, coach.id, query);
  }

  async sendAsCoach(coach: AuthenticatedUser, userId: string, input: SendMessageInput): Promise<MessageDto> {
    await this.requireThreadUser(userId);
    const me = await this.prisma.user.findUnique({ where: { id: coach.id }, select: { firstName: true, lastName: true } });
    return this.send({ threadUserId: userId, sender: coach.id, recipientId: userId, senderName: me ? fullName(me) : 'Tu Coach', body: input.body });
  }

  async markReadForCoach(coach: AuthenticatedUser, userId: string) {
    await this.requireThreadUser(userId);
    return this.markRead(userId, UserRole.USER, coach.id);
  }

  // ── Compartido ──────────────────────────────────────────────────────────

  /** Mensajes sin leer para el badge: los de la contraparte. */
  async unreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const where: Prisma.MessageWhereInput =
      user.role === UserRole.COACH
        ? { readAt: null, sender: { role: UserRole.USER } }
        : { threadUserId: user.id, readAt: null, sender: { role: UserRole.COACH } };
    return { count: await this.prisma.message.count({ where }) };
  }

  private async partnerOf(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { coach: { select: { firstName: true, lastName: true } } } });
    return me?.coach ?? null;
  }

  private async requireThreadUser(userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.USER, status: UserStatus.ACTIVE },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!u) throw new NotFoundException('Conversación no encontrada');
    return u;
  }

  private async list(threadUserId: string, viewerId: string, query: ListMessagesQuery): Promise<MessageListDto> {
    if (query.before) {
      const cursor = await this.prisma.message.findFirst({ where: { id: query.before, threadUserId }, select: { id: true } });
      if (!cursor) throw new BadRequestException('Cursor inválido');
    }
    const rows = await this.prisma.message.findMany({
      where: { threadUserId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      select: messageSelect,
    });
    const hasMore = rows.length > query.limit;
    return { data: rows.slice(0, query.limit).reverse().map((m) => toDto(m, viewerId)), meta: { hasMore } };
  }

  private async send(p: { threadUserId: string; sender: string; recipientId: string; senderName: string; body: string }): Promise<MessageDto> {
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { threadUserId: p.threadUserId, senderId: p.sender, body: p.body }, select: messageSelect });
      // Un solo aviso por hilo mientras el anterior siga sin leer: evita llenar las notificaciones en una conversación activa.
      const pending = await tx.notification.findFirst({
        where: { userId: p.recipientId, type: NotificationType.NEW_MESSAGE, readAt: null, data: { path: ['threadUserId'], equals: p.threadUserId } },
        select: { id: true },
      });
      if (!pending) {
        await this.notifications.notify(
          { userId: p.recipientId, type: NotificationType.NEW_MESSAGE, title: 'Nuevo mensaje', message: `${p.senderName} te escribió.`, data: { threadUserId: p.threadUserId } },
          tx,
        );
      }
      return toDto(m, p.sender);
    });
  }

  /** Marca como leídos los mensajes que envió la contraparte (`fromRole`) y sus avisos. */
  private async markRead(threadUserId: string, fromRole: UserRole, readerId: string): Promise<{ updated: number }> {
    const now = new Date();
    const [res] = await this.prisma.$transaction([
      this.prisma.message.updateMany({ where: { threadUserId, readAt: null, sender: { role: fromRole } }, data: { readAt: now } }),
      this.prisma.notification.updateMany({
        where: { userId: readerId, type: NotificationType.NEW_MESSAGE, readAt: null, data: { path: ['threadUserId'], equals: threadUserId } },
        data: { readAt: now },
      }),
    ]);
    return { updated: res.count };
  }
}
