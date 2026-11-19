import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, UserRole, UserStatus, WorkoutAssignmentStatus } from '@prisma/client';
import type { AssignmentDetailDto, AssignmentDto } from '@neo/shared-types';
import type { CreateAssignmentInput, ListAssignmentsQuery, UpdateAssignmentInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatDateOnly, parseDateOnly, todayIn } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { assignmentInclude, toAssignmentDetailDto, toAssignmentDto } from '../workouts/workout.mapper';

export interface SkippedAssignment {
  userId: string;
  reason: string;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * HU-10: asigna una clase publicada a una o varias usuarias. Cada usuaria se valida por separado
   * y las que no aplican se devuelven en `skipped` con el motivo, sin frenar al resto.
   */
  async create(actorId: string, input: CreateAssignmentInput): Promise<{ created: AssignmentDto[]; skipped: SkippedAssignment[] }> {
    const workout = await this.prisma.workout.findUnique({ where: { id: input.workoutId } });
    if (!workout) throw new NotFoundException('Clase no encontrada');
    if (!workout.isPublished) throw new BadRequestException('Publica la clase antes de asignarla');

    const userIds = [...new Set(input.userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, role: UserRole.USER },
      select: { id: true, status: true, timezone: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const date = parseDateOnly(input.scheduledDate);

    const existing = await this.prisma.workoutAssignment.findMany({
      where: { workoutId: workout.id, userId: { in: userIds }, scheduledDate: date, status: { not: WorkoutAssignmentStatus.CANCELLED } },
      select: { userId: true },
    });
    const alreadyAssigned = new Set(existing.map((e) => e.userId));

    const skipped: SkippedAssignment[] = [];
    const eligible: string[] = [];
    for (const userId of userIds) {
      const user = byId.get(userId);
      if (!user) skipped.push({ userId, reason: 'Usuaria no encontrada' });
      else if (user.status !== UserStatus.ACTIVE) skipped.push({ userId, reason: 'La usuaria no tiene el acceso activo' });
      else if (input.scheduledDate < todayIn(user.timezone)) skipped.push({ userId, reason: 'La fecha ya pasó en su zona horaria' });
      else if (alreadyAssigned.has(userId)) skipped.push({ userId, reason: 'Ya tiene esta clase en esa fecha' });
      else eligible.push(userId);
    }
    if (eligible.length === 0) return { created: [], skipped };

    const rows = await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        eligible.map((userId) =>
          tx.workoutAssignment.create({
            data: {
              workoutId: workout.id,
              userId,
              scheduledDate: date,
              scheduledTime: input.scheduledTime ?? null,
              assignedById: actorId,
            },
            include: assignmentInclude,
          }),
        ),
      );
      await this.audit.record(
        {
          actorId,
          action: 'WORKOUT_ASSIGNED',
          resource: 'Workout',
          resourceId: workout.id,
          metadata: { userIds: eligible, scheduledDate: input.scheduledDate },
        },
        tx,
      );
      await this.notifications.notify(
        eligible.map((userId, i) => ({
          userId,
          type: NotificationType.WORKOUT_ASSIGNED,
          title: 'Nuevo entrenamiento',
          message: `Tienes "${workout.title}" el ${input.scheduledDate}.`,
          data: { assignmentId: created[i]!.id },
        })),
        tx,
      );
      return created;
    });
    return { created: rows.map(toAssignmentDto), skipped };
  }

  /** Reprogramar o cancelar. Solo asignaciones aún programadas; una completada no se toca. */
  async update(actorId: string, id: string, input: UpdateAssignmentInput): Promise<AssignmentDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workoutAssignment.findUnique({ where: { id }, include: { user: { select: { timezone: true } } } });
      if (!current) throw new NotFoundException('Asignación no encontrada');
      if (current.status !== WorkoutAssignmentStatus.SCHEDULED) {
        throw new ConflictException('Solo se pueden modificar asignaciones programadas');
      }

      const data: Prisma.WorkoutAssignmentUpdateInput = {};
      if (input.status === WorkoutAssignmentStatus.CANCELLED) {
        data.status = WorkoutAssignmentStatus.CANCELLED;
      } else {
        if (input.scheduledDate) {
          if (input.scheduledDate < todayIn(current.user.timezone)) throw new BadRequestException('La nueva fecha ya pasó');
          const clash = await tx.workoutAssignment.findFirst({
            where: {
              id: { not: id },
              userId: current.userId,
              workoutId: current.workoutId,
              scheduledDate: parseDateOnly(input.scheduledDate),
              status: { not: WorkoutAssignmentStatus.CANCELLED },
            },
            select: { id: true },
          });
          if (clash) throw new ConflictException('Ya tiene esta clase en esa fecha');
          data.scheduledDate = parseDateOnly(input.scheduledDate);
        }
        if (input.scheduledTime !== undefined) data.scheduledTime = input.scheduledTime;
      }

      const updated = await tx.workoutAssignment.update({ where: { id }, data, include: assignmentInclude });
      await this.audit.record(
        {
          actorId,
          action: input.status ? 'WORKOUT_ASSIGNMENT_CANCELLED' : 'WORKOUT_ASSIGNMENT_RESCHEDULED',
          resource: 'WorkoutAssignment',
          resourceId: id,
          metadata: { scheduledDate: input.scheduledDate ?? null, scheduledTime: input.scheduledTime ?? null },
        },
        tx,
      );
      if (!input.status) {
        await this.notifications.notify(
          {
            userId: current.userId,
            type: NotificationType.WORKOUT_RESCHEDULED,
            title: 'Entrenamiento reprogramado',
            message: `"${updated.workout.title}" quedó para el ${formatDateOnly(updated.scheduledDate)}${updated.scheduledTime ? ` a las ${updated.scheduledTime}` : ''}.`,
            data: { assignmentId: id },
          },
          tx,
        );
      }
      return toAssignmentDto(updated);
    });
  }

  /** Calendario por rol: la usuaria solo ve las suyas (y no las canceladas); la Coach filtra por usuaria. */
  async list(user: AuthenticatedUser, query: ListAssignmentsQuery): Promise<AssignmentDto[]> {
    const where: Prisma.WorkoutAssignmentWhereInput = {
      scheduledDate: { gte: parseDateOnly(query.from), lte: parseDateOnly(query.to) },
    };
    if (user.role === UserRole.USER) {
      // Se ignora cualquier userId enviado: no hay acceso horizontal (RNF-19).
      where.userId = user.id;
      // Las canceladas nunca se muestran a la usuaria, ni siquiera filtrando por ese estado.
      where.status =
        query.status && query.status !== WorkoutAssignmentStatus.CANCELLED ? query.status : { not: WorkoutAssignmentStatus.CANCELLED };
    } else {
      if (query.userId) where.userId = query.userId;
      if (query.status) where.status = query.status;
    }
    const rows = await this.prisma.workoutAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 1000,
    });
    return rows.map(toAssignmentDto);
  }

  async get(user: AuthenticatedUser, id: string): Promise<AssignmentDetailDto> {
    const where: Prisma.WorkoutAssignmentWhereInput = { id };
    if (user.role === UserRole.USER) {
      where.userId = user.id;
      where.status = { not: WorkoutAssignmentStatus.CANCELLED };
    }
    const row = await this.prisma.workoutAssignment.findFirst({ where, include: assignmentInclude });
    // 404 (no 403) si es de otra usuaria: no se confirma que exista.
    if (!row) throw new NotFoundException('Entrenamiento no encontrado');
    return toAssignmentDetailDto(row);
  }
}
