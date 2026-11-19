import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import type { ApiList, NotificationDto } from '@neo/shared-types';
import type { ListNotificationsQuery } from '@neo/validation';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export interface NotifyEntry {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Referencia para navegar al recurso, p. ej. { assignmentId }. Sin datos sensibles. */
  data?: Prisma.InputJsonValue;
}

type Row = Prisma.NotificationGetPayload<object>;

export const toNotificationDto = (n: Row): NotificationDto => ({
  id: n.id,
  type: n.type as NotificationDto['type'],
  title: n.title,
  message: n.message,
  data: (n.data as Record<string, unknown> | null) ?? null,
  readAt: n.readAt ? n.readAt.toISOString() : null,
  createdAt: n.createdAt.toISOString(),
});

/**
 * HU-25: notificaciones internas (dentro de la app). No hay envío por correo ni push en el MVP.
 * Los métodos de creación reciben el cliente de la transacción para que la notificación
 * quede atómica con el hecho que la origina.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(entries: NotifyEntry | NotifyEntry[], db: Db = this.prisma): Promise<void> {
    const list = Array.isArray(entries) ? entries : [entries];
    if (list.length === 0) return;
    await db.notification.createMany({
      data: list.map((e) => ({ userId: e.userId, type: e.type, title: e.title, message: e.message, data: e.data })),
    });
  }

  /**
   * Avisa a la Coach de una usuaria. `{name}` en título o mensaje se reemplaza por el nombre de la usuaria.
   * Si la usuaria no tiene Coach asignada no hace nada.
   */
  async notifyCoachOf(userId: string, entry: Omit<NotifyEntry, 'userId'>, db: Db = this.prisma): Promise<void> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { coachId: true, firstName: true, lastName: true } });
    if (!user?.coachId) return;
    const name = `${user.firstName} ${user.lastName}`.trim();
    await this.notify(
      { ...entry, userId: user.coachId, title: entry.title.replace('{name}', name), message: entry.message.replace('{name}', name) },
      db,
    );
  }

  async list(user: AuthenticatedUser, query: ListNotificationsQuery): Promise<ApiList<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (query.unread === 'true') where.readAt = null;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(toNotificationDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  /** Solo las propias: una ajena responde 404 (RNF-19). Marcar una ya leída no la modifica. */
  async markRead(user: AuthenticatedUser, id: string): Promise<NotificationDto> {
    const current = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
    if (!current) throw new NotFoundException('Notificación no encontrada');
    if (current.readAt) return toNotificationDto(current);
    const updated = await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return toNotificationDto(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: res.count };
  }
}
