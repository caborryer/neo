import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { ApiList, WorkoutDto } from '@neo/shared-types';
import type { CreateWorkoutInput, ListWorkoutsQuery, UpdateWorkoutInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { toWorkoutDto } from './workout.mapper';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** HU-09: clase reutilizable con video de YouTube. Si se crea publicada ya queda disponible para asignar. */
  async create(actorId: string, input: CreateWorkoutInput): Promise<WorkoutDto> {
    return this.prisma.$transaction(async (tx) => {
      const workout = await tx.workout.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          durationMinutes: input.durationMinutes,
          difficulty: input.difficulty,
          category: input.category,
          videoId: input.video,
          videoVisibility: input.videoVisibility,
          equipment: input.equipment,
          tips: input.tips,
          isPublished: input.isPublished,
          createdById: actorId,
        },
      });
      await this.audit.record({ actorId, action: 'WORKOUT_CREATED', resource: 'Workout', resourceId: workout.id }, tx);
      return toWorkoutDto(workout);
    });
  }

  async update(actorId: string, id: string, input: UpdateWorkoutInput): Promise<WorkoutDto> {
    const { video, ...rest } = input;
    const data: Prisma.WorkoutUpdateInput = { ...rest, ...(video !== undefined ? { videoId: video } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.workout.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Clase no encontrada');
      const workout = await tx.workout.update({ where: { id }, data });
      await this.audit.record(
        { actorId, action: 'WORKOUT_UPDATED', resource: 'Workout', resourceId: id, metadata: { fields: Object.keys(input) } },
        tx,
      );
      return toWorkoutDto(workout);
    });
  }

  /** La Coach ve todas las clases (también borradores); la usuaria solo las que tiene asignadas (§13.4). */
  async list(user: AuthenticatedUser, query: ListWorkoutsQuery): Promise<ApiList<WorkoutDto>> {
    const where: Prisma.WorkoutWhereInput = {};
    if (user.role === UserRole.USER) {
      where.assignments = { some: { userId: user.id, status: { not: 'CANCELLED' } } };
    } else if (query.published) {
      where.isPublished = query.published === 'true';
    }
    if (query.category) where.category = query.category;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.workout.count({ where }),
      this.prisma.workout.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(toWorkoutDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async get(user: AuthenticatedUser, id: string): Promise<WorkoutDto> {
    const where: Prisma.WorkoutWhereInput = { id };
    if (user.role === UserRole.USER) where.assignments = { some: { userId: user.id, status: { not: 'CANCELLED' } } };
    const workout = await this.prisma.workout.findFirst({ where });
    // 404 también cuando existe pero no es de la usuaria: no se revela su existencia (RNF-19).
    if (!workout) throw new NotFoundException('Clase no encontrada');
    return toWorkoutDto(workout);
  }
}
