import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackCompletion, NotificationType, Prisma, UserRole, WorkoutAssignmentStatus } from '@prisma/client';
import type { ApiList, FeedbackDto, SessionDto, SessionHistoryItem } from '@neo/shared-types';
import type { CreateFeedbackInput, CreateSessionInput, ListSessionsQuery } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { ChallengesService } from '../challenges/challenges.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatDateOnly, todayIn } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { toSessionDto } from '../workouts/workout.mapper';

const MAX_SESSION_MINUTES = 600;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly challenges: ChallengesService,
  ) {}

  /**
   * HU-19: registra la sesión completada. Es idempotente: reintentar con la misma `idempotencyKey`
   * devuelve la sesión ya creada (created=false) en lugar de duplicarla (§4.2, §7.6).
   * Suposición S3: una sesión por asignación en el MVP.
   */
  async create(user: AuthenticatedUser, input: CreateSessionInput): Promise<{ session: SessionDto; created: boolean }> {
    const replay = await this.findByKey(input.assignmentId, input.idempotencyKey, user.id);
    if (replay) return { session: toSessionDto(replay), created: false };

    const assignment = await this.prisma.workoutAssignment.findFirst({
      where: { id: input.assignmentId, userId: user.id, status: { not: WorkoutAssignmentStatus.CANCELLED } },
      include: { workout: { select: { durationMinutes: true } } },
    });
    if (!assignment) throw new NotFoundException('Entrenamiento no encontrado');
    if (formatDateOnly(assignment.scheduledDate) > todayIn(user.timezone)) {
      throw new BadRequestException('Este entrenamiento aún no es de hoy');
    }

    const now = new Date();
    const startedAt = input.startedAt && input.startedAt.getTime() < now.getTime() ? input.startedAt : now;
    const measured = input.startedAt ? Math.round((now.getTime() - startedAt.getTime()) / 60_000) : null;
    const durationMinutes = measured === null ? assignment.workout.durationMinutes : Math.min(Math.max(measured, 1), MAX_SESSION_MINUTES);

    try {
      const session = await this.prisma.$transaction(async (tx) => {
        // Guarda atómica: solo una petición logra pasar la asignación de programada a completada.
        const claimed = await tx.workoutAssignment.updateMany({
          where: { id: assignment.id, status: { in: [WorkoutAssignmentStatus.SCHEDULED, WorkoutAssignmentStatus.IN_PROGRESS] } },
          data: { status: WorkoutAssignmentStatus.COMPLETED },
        });
        if (claimed.count === 0) throw new ConflictException('Este entrenamiento ya fue registrado');
        const created = await tx.workoutSession.create({
          data: {
            assignmentId: assignment.id,
            startedAt,
            completedAt: now,
            status: WorkoutAssignmentStatus.COMPLETED,
            completionPercentage: 100,
            durationMinutes,
            idempotencyKey: input.idempotencyKey,
          },
          include: { feedback: { select: { id: true } } },
        });
        // §4.6: el progreso de los retos lo calcula el servidor, en la misma transacción.
        await this.challenges.syncSession(tx, created.id);
        return created;
      });
      return { session: toSessionDto(session), created: true };
    } catch (err) {
      // Dos reintentos simultáneos con la misma clave: el segundo choca con la unicidad y recibe la sesión del primero.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.findByKey(input.assignmentId, input.idempotencyKey, user.id);
        if (again) return { session: toSessionDto(again), created: false };
      }
      throw err;
    }
  }

  /** Historial. La usuaria solo ve el suyo; la Coach puede filtrar por usuaria. */
  async list(user: AuthenticatedUser, query: ListSessionsQuery): Promise<ApiList<SessionHistoryItem>> {
    const where: Prisma.WorkoutSessionWhereInput =
      user.role === UserRole.USER
        ? { assignment: { userId: user.id } }
        : query.userId
          ? { assignment: { userId: query.userId } }
          : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workoutSession.count({ where }),
      this.prisma.workoutSession.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          feedback: { select: { id: true } },
          assignment: { select: { scheduledDate: true, workout: { select: { title: true } }, user: { select: { id: true, firstName: true, lastName: true } } } },
        },
      }),
    ]);
    return {
      data: rows.map((r) => ({
        ...toSessionDto(r),
        workoutTitle: r.assignment.workout.title,
        scheduledDate: formatDateOnly(r.assignment.scheduledDate),
        user: r.assignment.user,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  /**
   * HU-20: retroalimentación (máximo una por sesión). Según la respuesta se ajusta, en la misma
   * transacción, el estado de la sesión y de la asignación: Sí → completada, Parcial → parcial, No → no realizada.
   */
  async createFeedback(user: AuthenticatedUser, sessionId: string, input: CreateFeedbackInput): Promise<FeedbackDto> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, assignment: { userId: user.id } },
      include: { feedback: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.feedback) throw new ConflictException('Ya enviaste la retroalimentación de esta sesión');

    const outcome = {
      [FeedbackCompletion.YES]: { status: WorkoutAssignmentStatus.COMPLETED, percentage: 100 },
      [FeedbackCompletion.PARTIAL]: { status: WorkoutAssignmentStatus.PARTIAL, percentage: input.completionPercentage ?? 0 },
      [FeedbackCompletion.NO]: { status: WorkoutAssignmentStatus.SKIPPED, percentage: 0 },
    }[input.completed];

    try {
      const feedback = await this.prisma.$transaction(async (tx) => {
        const created = await tx.workoutFeedback.create({
          data: {
            sessionId,
            completed: input.completed,
            completionPercentage: input.completed === FeedbackCompletion.PARTIAL ? (input.completionPercentage ?? null) : null,
            notCompletedReason: input.completed === FeedbackCompletion.NO ? (input.notCompletedReason ?? null) : null,
            feelingRating: input.feelingRating,
            feelingDescription: input.feelingDescription || null,
            ateBeforeWorkout: input.ateBeforeWorkout,
            preWorkoutMeal: input.ateBeforeWorkout ? (input.preWorkoutMeal ?? null) : null,
          },
        });
        await tx.workoutSession.update({
          where: { id: sessionId },
          data: { status: outcome.status, completionPercentage: outcome.percentage },
        });
        await tx.workoutAssignment.update({ where: { id: session.assignmentId }, data: { status: outcome.status } });
        await this.challenges.syncSession(tx, sessionId);
        await this.audit.record({ actorId: user.id, action: 'WORKOUT_FEEDBACK_SUBMITTED', resource: 'WorkoutSession', resourceId: sessionId }, tx);
        await this.notifications.notifyCoachOf(
          user.id,
          {
            type: NotificationType.FEEDBACK_RECEIVED,
            title: 'Nueva retroalimentación',
            message: '{name} dejó su retroalimentación de un entrenamiento.',
            data: { sessionId, assignmentId: session.assignmentId },
          },
          tx,
        );
        return created;
      });
      return {
        id: feedback.id,
        sessionId: feedback.sessionId,
        completed: feedback.completed as FeedbackDto['completed'],
        completionPercentage: feedback.completionPercentage,
        notCompletedReason: feedback.notCompletedReason,
        feelingRating: feedback.feelingRating,
        feelingDescription: feedback.feelingDescription,
        ateBeforeWorkout: feedback.ateBeforeWorkout,
        preWorkoutMeal: feedback.preWorkoutMeal,
        createdAt: feedback.createdAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya enviaste la retroalimentación de esta sesión');
      }
      throw err;
    }
  }

  private findByKey(assignmentId: string, idempotencyKey: string, userId: string) {
    return this.prisma.workoutSession.findFirst({
      where: { assignmentId, idempotencyKey, assignment: { userId } },
      include: { feedback: { select: { id: true } } },
    });
  }
}
