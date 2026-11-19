import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus, NotificationType } from '@prisma/client';
import type {
  ApiList,
  NutritionPlanAssignmentDto,
  NutritionPlanDetailDto,
  NutritionPlanSummaryDto,
  NutritionVersionDto,
} from '@neo/shared-types';
import type {
  CreateNutritionPlanInput,
  CreatePlanAssignmentInput,
  DuplicateNutritionPlanInput,
  ListNutritionPlansQuery,
  NutritionContentInput,
  UpdateNutritionPlanInput,
} from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, formatDateOnly, parseDateOnly, todayIn } from '../common/dates';
import { PrismaService } from '../database/prisma.service';
import {
  DAY_NUMBER,
  assignmentInclude,
  planInclude,
  toAssignmentDto,
  toPlanDetailDto,
  toPlanSummaryDto,
  toVersionDto,
  toDaysDto,
  versionTreeInclude,
} from './nutrition.mapper';

export interface SkippedUser {
  userId: string;
  reason: string;
}

/** Estructura de días → escritura anidada de Prisma. */
function daysCreate(days: NutritionContentInput['days']): Prisma.NutritionPlanDayCreateWithoutVersionInput[] {
  return days.map((d) => ({
    dayNumber: DAY_NUMBER[d.dayName],
    dayName: d.dayName,
    meals: {
      create: d.meals.map((m) => ({
        mealType: m.mealType,
        title: m.title,
        scheduledTime: m.scheduledTime ?? null,
        instructions: m.instructions ?? null,
        foods: { create: m.foods.map((f) => ({ name: f.name, quantity: f.quantity, unit: f.unit, notes: f.notes ?? null })) },
      })),
    },
  }));
}

/** Convierte una versión leída de la BD en el contenido de entrada (para clonarla). */
function contentOf(version: Prisma.NutritionPlanVersionGetPayload<{ include: typeof versionTreeInclude }>): NutritionContentInput {
  return {
    notes: version.notes,
    days: toDaysDto(version.days).map((d) => ({
      dayName: d.dayName,
      meals: d.meals.map((m) => ({
        mealType: m.mealType,
        title: m.title,
        scheduledTime: m.scheduledTime,
        instructions: m.instructions,
        foods: m.foods.map((f) => ({ name: f.name, quantity: f.quantity, unit: f.unit, notes: f.notes })),
      })),
    })),
  };
}

@Injectable()
export class NutritionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** HU-11: crea el plan y su versión 1 como borrador. */
  async create(actorId: string, input: CreateNutritionPlanInput): Promise<NutritionPlanDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.nutritionPlan.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          isTemplate: input.isTemplate,
          createdById: actorId,
          versions: { create: { versionNumber: 1, notes: input.notes ?? null, days: { create: daysCreate(input.days) } } },
        },
        include: planInclude,
      });
      await this.audit.record({ actorId, action: 'NUTRITION_PLAN_CREATED', resource: 'NutritionPlan', resourceId: plan.id }, tx);
      return toPlanDetailDto(plan);
    });
  }

  async list(query: ListNutritionPlansQuery): Promise<ApiList<NutritionPlanSummaryDto>> {
    const where: Prisma.NutritionPlanWhereInput = {};
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.template) where.isTemplate = query.template === 'true';
    if (query.active) where.isActive = query.active === 'true';

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.nutritionPlan.count({ where }),
      this.prisma.nutritionPlan.findMany({
        where,
        include: planInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(toPlanSummaryDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async get(id: string): Promise<NutritionPlanDetailDto> {
    const plan = await this.prisma.nutritionPlan.findUnique({ where: { id }, include: planInclude });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return toPlanDetailDto(plan);
  }

  async getVersion(planId: string, versionId: string): Promise<NutritionVersionDto> {
    const version = await this.prisma.nutritionPlanVersion.findFirst({ where: { id: versionId, planId }, include: versionTreeInclude });
    if (!version) throw new NotFoundException('Versión no encontrada');
    return toVersionDto(version);
  }

  async update(actorId: string, id: string, input: UpdateNutritionPlanInput): Promise<NutritionPlanDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.nutritionPlan.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Plan no encontrado');
      const plan = await tx.nutritionPlan.update({ where: { id }, data: input, include: planInclude });
      await this.audit.record(
        { actorId, action: 'NUTRITION_PLAN_UPDATED', resource: 'NutritionPlan', resourceId: id, metadata: { fields: Object.keys(input) } },
        tx,
      );
      return toPlanDetailDto(plan);
    });
  }

  /** Copia la última versión a un plan nuevo (reutilizar plantillas, §4.3). El original no cambia. */
  async duplicate(actorId: string, id: string, input: DuplicateNutritionPlanInput): Promise<NutritionPlanDetailDto> {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.nutritionPlan.findUnique({ where: { id }, select: { description: true } });
      if (!source) throw new NotFoundException('Plan no encontrado');
      const latest = await tx.nutritionPlanVersion.findFirst({ where: { planId: id }, orderBy: { versionNumber: 'desc' }, include: versionTreeInclude });
      const content = latest ? contentOf(latest) : { notes: null, days: [] };
      const plan = await tx.nutritionPlan.create({
        data: {
          name: input.name,
          description: source.description,
          isTemplate: input.isTemplate,
          createdById: actorId,
          versions: { create: { versionNumber: 1, notes: content.notes ?? null, days: { create: daysCreate(content.days) } } },
        },
        include: planInclude,
      });
      await this.audit.record(
        { actorId, action: 'NUTRITION_PLAN_DUPLICATED', resource: 'NutritionPlan', resourceId: plan.id, metadata: { sourcePlanId: id } },
        tx,
      );
      return toPlanDetailDto(plan);
    });
  }

  /** Nueva versión como borrador, copiando la última. Solo puede haber un borrador a la vez. */
  async createVersion(actorId: string, planId: string): Promise<NutritionVersionDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.nutritionPlan.findUnique({ where: { id: planId }, select: { id: true } });
        if (!plan) throw new NotFoundException('Plan no encontrado');
        const latest = await tx.nutritionPlanVersion.findFirst({ where: { planId }, orderBy: { versionNumber: 'desc' }, include: versionTreeInclude });
        if (latest && latest.publishedAt === null) throw new ConflictException('Ya hay un borrador: edítalo o publícalo antes de crear otra versión');
        const content = latest ? contentOf(latest) : { notes: null, days: [] };
        const created = await tx.nutritionPlanVersion.create({
          data: { planId, versionNumber: (latest?.versionNumber ?? 0) + 1, notes: content.notes ?? null, days: { create: daysCreate(content.days) } },
          include: versionTreeInclude,
        });
        await tx.nutritionPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
        await this.audit.record(
          { actorId, action: 'NUTRITION_VERSION_CREATED', resource: 'NutritionPlanVersion', resourceId: created.id, metadata: { planId, versionNumber: created.versionNumber } },
          tx,
        );
        return toVersionDto(created);
      });
    } catch (err) {
      // Dos clics simultáneos: la restricción única [planId, versionNumber] frena al segundo.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya se estaba creando una versión; recarga e inténtalo de nuevo');
      }
      throw err;
    }
  }

  /** Reemplaza el contenido de un borrador. Una versión publicada es inmutable (RNF-18). */
  async saveDraft(actorId: string, planId: string, versionId: string, input: NutritionContentInput): Promise<NutritionVersionDto> {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.nutritionPlanVersion.findFirst({ where: { id: versionId, planId }, select: { id: true, publishedAt: true } });
      if (!version) throw new NotFoundException('Versión no encontrada');
      if (version.publishedAt) throw new ConflictException('Una versión publicada no se puede modificar. Crea una nueva versión');

      await tx.nutritionPlanFood.deleteMany({ where: { meal: { day: { versionId } } } });
      await tx.nutritionPlanMeal.deleteMany({ where: { day: { versionId } } });
      await tx.nutritionPlanDay.deleteMany({ where: { versionId } });
      const saved = await tx.nutritionPlanVersion.update({
        where: { id: versionId },
        data: { notes: input.notes ?? null, days: { create: daysCreate(input.days) } },
        include: versionTreeInclude,
      });
      await tx.nutritionPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      await this.audit.record({ actorId, action: 'NUTRITION_VERSION_SAVED', resource: 'NutritionPlanVersion', resourceId: versionId }, tx);
      return toVersionDto(saved);
    });
  }

  /** Publicar congela la versión. Exige contenido completo: ≥1 comida y cada comida con alimentos. */
  async publish(actorId: string, planId: string, versionId: string): Promise<NutritionVersionDto> {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.nutritionPlanVersion.findFirst({ where: { id: versionId, planId }, include: versionTreeInclude });
      if (!version) throw new NotFoundException('Versión no encontrada');
      if (version.publishedAt) throw new ConflictException('Esta versión ya está publicada');

      const problems: string[] = [];
      const meals = version.days.flatMap((d) => d.meals.map((m) => ({ day: d.dayName, meal: m })));
      if (meals.length === 0) problems.push('Agrega al menos una comida');
      for (const { day, meal } of meals) {
        if (meal.foods.length === 0) problems.push(`"${meal.title}" (${day}) no tiene alimentos`);
      }
      if (problems.length) {
        throw new BadRequestException({ message: 'La versión no está lista para publicarse', details: problems.map((message) => ({ field: 'days', message })) });
      }

      // Reclamo atómico: si dos publicaciones compiten, solo una cambia la fila.
      const claimed = await tx.nutritionPlanVersion.updateMany({ where: { id: versionId, publishedAt: null }, data: { publishedAt: new Date() } });
      if (claimed.count === 0) throw new ConflictException('Esta versión ya está publicada');
      await tx.nutritionPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
      await this.audit.record(
        { actorId, action: 'NUTRITION_VERSION_PUBLISHED', resource: 'NutritionPlanVersion', resourceId: versionId, metadata: { planId, versionNumber: version.versionNumber } },
        tx,
      );
      const fresh = await tx.nutritionPlanVersion.findUniqueOrThrow({ where: { id: versionId }, include: versionTreeInclude });
      return toVersionDto(fresh);
    });
  }

  /**
   * HU-12: asigna una versión publicada a una o varias usuarias. Por cada una, las asignaciones activas
   * que se solapan con la nueva vigencia se finalizan ("al reemplazar un plan se finaliza el anterior", §4.3).
   */
  async assign(actorId: string, planId: string, input: CreatePlanAssignmentInput): Promise<{ created: NutritionPlanAssignmentDto[]; skipped: SkippedUser[] }> {
    const version = await this.prisma.nutritionPlanVersion.findFirst({ where: { id: input.versionId, planId }, include: { plan: { select: { isActive: true, name: true } } } });
    if (!version) throw new NotFoundException('Versión no encontrada');
    if (!version.publishedAt) throw new BadRequestException('Publica la versión antes de asignarla');
    if (!version.plan.isActive) throw new BadRequestException('El plan está archivado');

    const userIds = [...new Set(input.userIds)];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds }, role: UserRole.USER }, select: { id: true, status: true, timezone: true } });
    const byId = new Map(users.map((u) => [u.id, u]));

    const skipped: SkippedUser[] = [];
    const eligible: string[] = [];
    for (const userId of userIds) {
      const user = byId.get(userId);
      if (!user) skipped.push({ userId, reason: 'Usuaria no encontrada' });
      else if (user.status !== UserStatus.ACTIVE) skipped.push({ userId, reason: 'La usuaria no tiene el acceso activo' });
      else if (input.startDate < todayIn(user.timezone)) skipped.push({ userId, reason: 'La fecha de inicio ya pasó en su zona horaria' });
      else eligible.push(userId);
    }
    if (eligible.length === 0) return { created: [], skipped };

    const start = parseDateOnly(input.startDate);
    const end = input.endDate ? parseDateOnly(input.endDate) : null;
    const dayBefore = parseDateOnly(addDays(input.startDate, -1));

    try {
      const rows = await this.prisma.$transaction(
        async (tx) => {
          const created = [];
          for (const userId of eligible) {
            // Activas cuyo período se cruza con [start, end].
            const overlapping = await tx.nutritionPlanAssignment.findMany({
              where: {
                userId,
                status: 'ACTIVE',
                AND: [{ OR: [{ endDate: null }, { endDate: { gte: start } }] }, ...(end ? [{ startDate: { lte: end } }] : [])],
              },
              select: { id: true, startDate: true },
            });
            for (const old of overlapping) {
              // Las que ya empezaron terminan el día anterior; las futuras se descartan por completo.
              await tx.nutritionPlanAssignment.update({
                where: { id: old.id },
                data: old.startDate < start ? { status: 'ENDED', endDate: dayBefore } : { status: 'ENDED' },
              });
            }
            created.push(
              await tx.nutritionPlanAssignment.create({
                data: { userId, versionId: input.versionId, assignedById: actorId, startDate: start, endDate: end },
                include: assignmentInclude,
              }),
            );
          }
          await this.audit.record(
            {
              actorId,
              action: 'NUTRITION_PLAN_ASSIGNED',
              resource: 'NutritionPlan',
              resourceId: planId,
              metadata: { versionId: input.versionId, userIds: eligible, startDate: input.startDate, endDate: input.endDate ?? null },
            },
            tx,
          );
          await this.notifications.notify(
            created.map((c) => ({
              userId: c.userId,
              type: NotificationType.NUTRITION_PLAN_ASSIGNED,
              title: 'Nuevo plan de alimentación',
              message: `Tu plan "${version.plan.name}" empieza el ${input.startDate}.`,
              data: { assignmentId: c.id },
            })),
            tx,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { created: rows.map((r) => toAssignmentDto(r, todayIn(r.user.timezone))), skipped };
    } catch (err) {
      // Serialización o la restricción de no-solapamiento de la BD: otra asignación ganó la carrera.
      if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2010'].includes(err.code)) {
        throw new ConflictException('Otra asignación se estaba guardando al mismo tiempo. Inténtalo de nuevo');
      }
      throw err;
    }
  }

  /** Asignaciones de todas las versiones de un plan. */
  async listForPlan(planId: string): Promise<NutritionPlanAssignmentDto[]> {
    const exists = await this.prisma.nutritionPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Plan no encontrado');
    const rows = await this.prisma.nutritionPlanAssignment.findMany({
      where: { version: { planId } },
      include: assignmentInclude,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map((r) => toAssignmentDto(r, todayIn(r.user.timezone)));
  }

  /** Historial de planes de una usuaria (vista de la Coach). */
  async listForUser(userId: string): Promise<NutritionPlanAssignmentDto[]> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, role: UserRole.USER }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuaria no encontrada');
    const rows = await this.prisma.nutritionPlanAssignment.findMany({
      where: { userId },
      include: assignmentInclude,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map((r) => toAssignmentDto(r, todayIn(r.user.timezone)));
  }

  /** La Coach finaliza una asignación antes de tiempo. Hoy (en la zona de la usuaria) es el último día. */
  async endAssignment(actorId: string, id: string): Promise<NutritionPlanAssignmentDto> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.nutritionPlanAssignment.findUnique({ where: { id }, include: assignmentInclude });
      if (!current) throw new NotFoundException('Asignación no encontrada');
      if (current.status !== 'ACTIVE') throw new ConflictException('La asignación ya está finalizada');
      const today = todayIn(current.user.timezone);
      const started = formatDateOnly(current.startDate) <= today;
      const updated = await tx.nutritionPlanAssignment.update({
        where: { id },
        data: { status: 'ENDED', ...(started ? { endDate: parseDateOnly(today) } : {}) },
        include: assignmentInclude,
      });
      await this.audit.record({ actorId, action: 'NUTRITION_ASSIGNMENT_ENDED', resource: 'NutritionPlanAssignment', resourceId: id }, tx);
      return toAssignmentDto(updated, today);
    });
  }
}
