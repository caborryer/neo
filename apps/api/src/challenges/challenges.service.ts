import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChallengeParticipantStatus, NotificationType, Prisma, UserRole, UserStatus, WorkoutAssignmentStatus } from '@prisma/client';
import type { ApiList, ChallengeDetailDto, ChallengeDto, ChallengeProgressDto } from '@neo/shared-types';
import type { CreateChallengeInput, ListChallengesQuery, UpdateChallengeInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { formatDateOnly, parseDateOnly, todayIn } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { phaseOf, toChallengeDto } from './challenges.mapper';

type Db = Prisma.TransactionClient | PrismaService;

const meta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
const notAbandoned = { status: { not: ChallengeParticipantStatus.ABANDONED } };

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Coach (HU-29) ───────────────────────────────────────────────────

  async create(coach: AuthenticatedUser, input: CreateChallengeInput): Promise<ChallengeDto> {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          goal: input.goal,
          startDate: parseDateOnly(input.startDate),
          endDate: parseDateOnly(input.endDate),
          isActive: input.published,
          createdById: coach.id,
        },
      });
      await this.audit.record({ actorId: coach.id, action: 'CHALLENGE_CREATED', resource: 'Challenge', resourceId: challenge.id }, tx);
      if (input.published) await this.announce(tx, challenge.id, challenge.name);
      return toChallengeDto(challenge, { timeZone: coach.timezone, participantCount: 0 });
    });
  }

  async update(coach: AuthenticatedUser, id: string, input: UpdateChallengeInput): Promise<ChallengeDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.challenge.findUnique({ where: { id }, include: { _count: { select: { participants: true } } } });
      if (!current) throw new NotFoundException('Reto no encontrado');

      // Con participantes, cambiar meta o fechas alteraría su progreso ya acumulado.
      const locked = current._count.participants > 0 && (input.goal !== undefined || input.startDate !== undefined || input.endDate !== undefined);
      if (locked) throw new BadRequestException('El reto ya tiene participantes: no se pueden cambiar la meta ni las fechas');

      const start = input.startDate ?? formatDateOnly(current.startDate);
      const end = input.endDate ?? formatDateOnly(current.endDate);
      if (end < start) throw new BadRequestException('La fecha de fin no puede ser anterior al inicio');

      const { published, startDate, endDate, ...rest } = input;
      const data: Prisma.ChallengeUncheckedUpdateInput = {
        ...rest,
        ...(published !== undefined ? { isActive: published } : {}),
        ...(startDate !== undefined ? { startDate: parseDateOnly(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: parseDateOnly(endDate) } : {}),
      };
      const updated = await tx.challenge.update({ where: { id }, data });
      const changed = published !== undefined && published !== current.isActive;
      const action = changed ? (published ? 'CHALLENGE_PUBLISHED' : 'CHALLENGE_UNPUBLISHED') : 'CHALLENGE_UPDATED';
      await this.audit.record({ actorId: coach.id, action, resource: 'Challenge', resourceId: id, metadata: { fields: Object.keys(input) } }, tx);
      if (changed && published) await this.announce(tx, id, updated.name);
      const count = await tx.challengeParticipant.count({ where: { challengeId: id, ...notAbandoned } });
      return toChallengeDto(updated, { timeZone: coach.timezone, participantCount: count });
    });
  }

  /** Aviso interno a las usuarias activas cuando un reto se publica. */
  private async announce(db: Db, challengeId: string, name: string) {
    const users = await db.user.findMany({ where: { role: UserRole.USER, status: UserStatus.ACTIVE }, select: { id: true } });
    await this.notifications.notify(
      users.map((u) => ({ userId: u.id, type: NotificationType.CHALLENGE_PUBLISHED, title: 'Nuevo reto', message: `Ya puedes inscribirte al reto “${name}”.`, data: { challengeId } })),
      db,
    );
  }

  async listForCoach(coach: AuthenticatedUser, query: ListChallengesQuery): Promise<ApiList<ChallengeDto>> {
    const where: Prisma.ChallengeWhereInput = {};
    if (query.published) where.isActive = query.published === 'true';
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.challenge.count({ where }),
      this.prisma.challenge.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { participants: { where: notAbandoned } } } },
      }),
    ]);
    return { data: rows.map((r) => toChallengeDto(r, { timeZone: coach.timezone, participantCount: r._count.participants })), meta: meta(query.page, query.limit, total) };
  }

  /** Reto con sus participantes y su progreso (la Coach consulta el avance, HU-29). */
  async getForCoach(coach: AuthenticatedUser, id: string): Promise<ChallengeDetailDto> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: { participants: { include: { user: { select: { firstName: true, lastName: true } } }, orderBy: [{ progress: 'desc' }, { joinedAt: 'asc' }] } },
    });
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    const active = challenge.participants.filter((p) => p.status !== ChallengeParticipantStatus.ABANDONED);
    return {
      ...toChallengeDto(challenge, { timeZone: coach.timezone, participantCount: active.length }),
      participants: challenge.participants.map((p) => ({
        userId: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`.trim(),
        status: p.status as ChallengeDetailDto['participants'][number]['status'],
        progress: p.progress,
        joinedAt: p.joinedAt.toISOString(),
      })),
    };
  }

  // ─── Usuaria (HU-30) ─────────────────────────────────────────────────

  /** Solo retos publicados, con su participación. */
  async listForUser(user: AuthenticatedUser, query: ListChallengesQuery): Promise<ApiList<ChallengeDto>> {
    const where: Prisma.ChallengeWhereInput = { isActive: true };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.challenge.count({ where }),
      this.prisma.challenge.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { participants: { where: { userId: user.id } }, _count: { select: { participants: { where: notAbandoned } } } },
      }),
    ]);
    return {
      data: rows.map((r) => toChallengeDto(r, { timeZone: user.timezone, participantCount: r._count.participants, mine: r.participants[0] ?? null })),
      meta: meta(query.page, query.limit, total),
    };
  }

  private async findPublished(db: Db, id: string) {
    const challenge = await db.challenge.findFirst({ where: { id, isActive: true } });
    // Un reto sin publicar no existe para la usuaria (RNF-19).
    if (!challenge) throw new NotFoundException('Reto no encontrado');
    return challenge;
  }

  async getForUser(user: AuthenticatedUser, id: string): Promise<ChallengeDto> {
    const challenge = await this.findPublished(this.prisma, id);
    const [mine, count] = await this.prisma.$transaction([
      this.prisma.challengeParticipant.findUnique({ where: { userId_challengeId: { userId: user.id, challengeId: id } } }),
      this.prisma.challengeParticipant.count({ where: { challengeId: id, ...notAbandoned } }),
    ]);
    return toChallengeDto(challenge, { timeZone: user.timezone, participantCount: count, mine });
  }

  async join(user: AuthenticatedUser, id: string): Promise<ChallengeDto> {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await this.findPublished(tx, id);
      if (phaseOf(challenge, user.timezone) === 'ENDED') throw new BadRequestException('Este reto ya terminó');
      const existing = await tx.challengeParticipant.findUnique({ where: { userId_challengeId: { userId: user.id, challengeId: id } } });
      if (existing && existing.status !== ChallengeParticipantStatus.ABANDONED) throw new ConflictException('Ya estás inscrita en este reto');

      // Reinscribirse conserva el historial; solo cuentan las sesiones completadas desde la inscripción original.
      const mine = existing
        ? await tx.challengeParticipant.update({ where: { id: existing.id }, data: { status: ChallengeParticipantStatus.IN_PROGRESS } })
        : await tx.challengeParticipant.create({ data: { userId: user.id, challengeId: id } });
      await this.audit.record({ actorId: user.id, action: 'CHALLENGE_JOINED', resource: 'Challenge', resourceId: id }, tx);
      const count = await tx.challengeParticipant.count({ where: { challengeId: id, ...notAbandoned } });
      return toChallengeDto(challenge, { timeZone: user.timezone, participantCount: count, mine });
    });
  }

  async leave(user: AuthenticatedUser, id: string): Promise<ChallengeDto> {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await this.findPublished(tx, id);
      const existing = await tx.challengeParticipant.findUnique({ where: { userId_challengeId: { userId: user.id, challengeId: id } } });
      if (!existing) throw new NotFoundException('No estás inscrita en este reto');
      if (existing.status === ChallengeParticipantStatus.COMPLETED) throw new BadRequestException('Ya completaste este reto');
      const mine = await tx.challengeParticipant.update({ where: { id: existing.id }, data: { status: ChallengeParticipantStatus.ABANDONED } });
      await this.audit.record({ actorId: user.id, action: 'CHALLENGE_LEFT', resource: 'Challenge', resourceId: id }, tx);
      const count = await tx.challengeParticipant.count({ where: { challengeId: id, ...notAbandoned } });
      return toChallengeDto(challenge, { timeZone: user.timezone, participantCount: count, mine });
    });
  }

  /** Progreso propio: nunca el de otra usuaria. Sin inscripción → 404. */
  async progress(user: AuthenticatedUser, id: string): Promise<ChallengeProgressDto> {
    const participant = await this.prisma.challengeParticipant.findFirst({
      where: { userId: user.id, challengeId: id, challenge: { isActive: true } },
      include: {
        challenge: { select: { goal: true } },
        activities: { orderBy: { createdAt: 'asc' }, include: { workoutSession: { select: { completedAt: true, assignment: { select: { workout: { select: { title: true } } } } } } } },
      },
    });
    if (!participant) throw new NotFoundException('No estás inscrita en este reto');
    return {
      challengeId: id,
      goal: participant.challenge.goal,
      progress: participant.progress,
      status: participant.status as ChallengeProgressDto['status'],
      joinedAt: participant.joinedAt.toISOString(),
      activities: participant.activities.map((a) => ({
        sessionId: a.workoutSessionId,
        workoutTitle: a.workoutSession.assignment.workout.title,
        completedAt: (a.workoutSession.completedAt ?? a.createdAt).toISOString(),
      })),
    };
  }

  // ─── Progreso (§4.6) ─────────────────────────────────────────────────

  /**
   * Sincroniza el progreso de los retos de la usuaria con una sesión. Se llama dentro de la misma
   * transacción que crea la sesión o registra su retroalimentación, así el progreso nunca queda
   * desfasado. Una sesión cuenta si: está COMPLETADA, ocurrió desde que la usuaria se inscribió y
   * su fecha local cae dentro de las fechas del reto. Se cuenta una sola vez por sesión (unicidad
   * en base de datos) y deja de contar si la retroalimentación la cambia a parcial o no realizada.
   */
  async syncSession(db: Db, sessionId: string): Promise<void> {
    const session = await db.workoutSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, completedAt: true, assignment: { select: { userId: true, user: { select: { timezone: true } } } } },
    });
    if (!session) return;
    const { userId } = session.assignment;
    const participants = await db.challengeParticipant.findMany({
      where: { userId, ...notAbandoned, challenge: { isActive: true } },
      include: { challenge: true },
    });

    for (const p of participants) {
      const done = session.completedAt;
      const day = done ? todayIn(session.assignment.user.timezone, done) : null;
      const valid =
        session.status === WorkoutAssignmentStatus.COMPLETED &&
        done !== null &&
        done.getTime() >= p.joinedAt.getTime() &&
        day !== null &&
        day >= formatDateOnly(p.challenge.startDate) &&
        day <= formatDateOnly(p.challenge.endDate);

      if (valid) await db.challengeActivity.createMany({ data: [{ participantId: p.id, workoutSessionId: sessionId }], skipDuplicates: true });
      else await db.challengeActivity.deleteMany({ where: { participantId: p.id, workoutSessionId: sessionId } });

      const sum = await db.challengeActivity.aggregate({ where: { participantId: p.id }, _sum: { contribution: true } });
      const progress = sum._sum.contribution ?? 0;
      const status = progress >= p.challenge.goal ? ChallengeParticipantStatus.COMPLETED : ChallengeParticipantStatus.IN_PROGRESS;
      if (progress === p.progress && status === p.status) continue;
      await db.challengeParticipant.update({ where: { id: p.id }, data: { progress, status } });
      if (status === ChallengeParticipantStatus.COMPLETED && p.status !== ChallengeParticipantStatus.COMPLETED) {
        await this.notifications.notify(
          { userId, type: NotificationType.CHALLENGE_COMPLETED, title: '¡Reto completado!', message: `Completaste el reto “${p.challenge.name}”. ¡Felicitaciones!`, data: { challengeId: p.challengeId } },
          db,
        );
      }
    }
  }
}
