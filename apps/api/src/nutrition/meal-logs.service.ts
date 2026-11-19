import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MealLogStatus, MealType, NotificationType, Prisma, UserRole } from '@prisma/client';
import type { ApiList, MealLogDto } from '@neo/shared-types';
import type {
  CreateMealLogInput,
  ListCoachMealLogsQuery,
  ListMealLogsQuery,
  ReviewMealLogInput,
  UpdateMealLogInput,
} from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, todayIn, utcToZoned, zonedTimeToUtc } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { mealLogInclude, toMealLogDto } from './nutrition.mapper';

/** Hora típica por tipo de comida, para cuando se registra un día pasado sin indicar la hora. */
const DEFAULT_TIME: Record<MealType, string> = {
  BREAKFAST: '08:00',
  MORNING_SNACK: '10:30',
  LUNCH: '13:00',
  AFTERNOON_SNACK: '16:00',
  DINNER: '19:30',
  OTHER: '12:00',
};
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const EDITABLE: MealLogStatus[] = [MealLogStatus.DRAFT, MealLogStatus.NEEDS_CHANGES];

@Injectable()
export class MealLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** HU-22: registra lo realmente consumido, haya o no relación con el plan. Nace como borrador. */
  async create(user: AuthenticatedUser, input: CreateMealLogInput): Promise<MealLogDto> {
    await this.assertLinks(user.id, input.plannedMealId, input.imageAssetId);
    const consumedAt = this.consumedAt(user.timezone, input.date, input.time, input.mealType);
    const row = await this.prisma.mealLog.create({
      data: {
        userId: user.id,
        mealType: input.mealType,
        description: input.description,
        plannedMealId: input.plannedMealId ?? null,
        imageAssetId: input.imageAssetId ?? null,
        consumedAt,
      },
      include: mealLogInclude,
    });
    return toMealLogDto(row);
  }

  async listMine(user: AuthenticatedUser, query: ListMealLogsQuery): Promise<MealLogDto[]> {
    const rows = await this.prisma.mealLog.findMany({
      where: { userId: user.id, consumedAt: this.range(user.timezone, query.from, query.to) },
      include: mealLogInclude,
      orderBy: [{ consumedAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
    return rows.map(toMealLogDto);
  }

  /** Editable solo en borrador o cuando la Coach pidió cambios (§4.5). */
  async update(user: AuthenticatedUser, id: string, input: UpdateMealLogInput): Promise<MealLogDto> {
    const current = await this.own(user.id, id);
    if (!EDITABLE.includes(current.status)) throw new ConflictException('Este registro ya fue enviado y no se puede editar');

    const description = input.description ?? current.description;
    const imageAssetId = input.imageAssetId === undefined ? current.imageAssetId : input.imageAssetId;
    if (!description && !imageAssetId) throw new BadRequestException('Describe lo que comiste o agrega una foto');
    await this.assertLinks(user.id, input.plannedMealId, input.imageAssetId);

    const data: Prisma.MealLogUncheckedUpdateInput = { description, imageAssetId };
    if (input.mealType) data.mealType = input.mealType;
    if (input.plannedMealId !== undefined) data.plannedMealId = input.plannedMealId;
    if (input.date || input.time || input.mealType) {
      const local = utcToZoned(current.consumedAt, user.timezone);
      data.consumedAt = this.consumedAt(user.timezone, input.date ?? local.date, input.time ?? local.time, input.mealType ?? current.mealType);
    }
    const row = await this.prisma.mealLog.update({ where: { id }, data, include: mealLogInclude });
    return toMealLogDto(row);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const current = await this.own(user.id, id);
    if (current.status !== MealLogStatus.DRAFT) throw new ConflictException('Solo se pueden eliminar borradores');
    await this.prisma.mealLog.delete({ where: { id } });
  }

  /** Envía a la Coach. Requiere descripción; el comentario de una revisión anterior se conserva. */
  async submit(user: AuthenticatedUser, id: string): Promise<MealLogDto> {
    const current = await this.own(user.id, id);
    if (!EDITABLE.includes(current.status)) throw new ConflictException('Este registro ya fue enviado');
    if (!current.description.trim()) throw new BadRequestException('Agrega una descripción antes de enviar');

    const claimed = await this.prisma.mealLog.updateMany({ where: { id, userId: user.id, status: { in: EDITABLE } }, data: { status: MealLogStatus.SUBMITTED } });
    if (claimed.count === 0) throw new ConflictException('Este registro ya fue enviado');
    await this.notifications.notifyCoachOf(user.id, {
      type: NotificationType.MEAL_LOG_PENDING_REVIEW,
      title: 'Registro de comida por revisar',
      message: '{name} envió un registro de comida.',
      data: { mealLogId: id },
    });
    return toMealLogDto(await this.prisma.mealLog.findUniqueOrThrow({ where: { id }, include: mealLogInclude }));
  }

  async listForCoach(coach: AuthenticatedUser, query: ListCoachMealLogsQuery): Promise<ApiList<MealLogDto>> {
    let tz = coach.timezone;
    if (query.userId) {
      const target = await this.prisma.user.findFirst({ where: { id: query.userId, role: UserRole.USER }, select: { timezone: true } });
      if (!target) throw new NotFoundException('Usuaria no encontrada');
      tz = target.timezone;
    }
    const where: Prisma.MealLogWhereInput = {
      // Los borradores son privados de la usuaria: la Coach solo ve lo que se envió.
      status: query.status ?? { not: MealLogStatus.DRAFT },
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? { consumedAt: this.range(tz, query.from ?? query.to!, query.to ?? query.from!) }
        : {}),
    };
    if (query.status === MealLogStatus.DRAFT) return { data: [], meta: { page: query.page, limit: query.limit, total: 0, totalPages: 1 } };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.mealLog.count({ where }),
      this.prisma.mealLog.findMany({
        where,
        include: mealLogInclude,
        // Lo pendiente de revisar primero y, dentro de cada grupo, lo más antiguo (cola de trabajo).
        orderBy: [{ status: 'asc' }, { consumedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(toMealLogDto),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  /** HU-13: aprobar o pedir cambios. Solo registros enviados. */
  async review(coach: AuthenticatedUser, id: string, input: ReviewMealLogInput): Promise<MealLogDto> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.mealLog.updateMany({
        where: { id, status: MealLogStatus.SUBMITTED },
        data: { status: input.status, coachComment: input.comment ?? null, reviewedAt: new Date(), reviewedById: coach.id },
      });
      if (claimed.count === 0) {
        const exists = await tx.mealLog.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!exists || exists.status === MealLogStatus.DRAFT) throw new NotFoundException('Registro no encontrado');
        throw new ConflictException('Solo se pueden revisar registros enviados y aún sin revisar');
      }
      await this.audit.record({ actorId: coach.id, action: 'MEAL_LOG_REVIEWED', resource: 'MealLog', resourceId: id, metadata: { status: input.status } }, tx);
      const row = await tx.mealLog.findUniqueOrThrow({ where: { id }, include: mealLogInclude });
      await this.notifications.notify(
        {
          userId: row.userId,
          type: NotificationType.MEAL_LOG_REVIEWED,
          title: input.status === MealLogStatus.REVIEWED ? 'Tu registro fue aprobado' : 'Tu Coach pidió cambios en un registro',
          message: input.comment ? input.comment.slice(0, 200) : 'Entra a tu diario para ver la revisión.',
          data: { mealLogId: id },
        },
        tx,
      );
      return toMealLogDto(row);
    });
  }

  // ── internos ──────────────────────────────────────────────────────────

  /** Un registro ajeno responde 404 (RNF-19), igual que uno inexistente. */
  private async own(userId: string, id: string) {
    const log = await this.prisma.mealLog.findFirst({ where: { id, userId } });
    if (!log) throw new NotFoundException('Registro no encontrado');
    return log;
  }

  /** La comida del plan debe pertenecer a un plan asignado a la usuaria, y la foto debe ser suya. */
  private async assertLinks(userId: string, plannedMealId?: string | null, imageAssetId?: string | null): Promise<void> {
    if (plannedMealId) {
      const meal = await this.prisma.nutritionPlanMeal.findFirst({
        where: { id: plannedMealId, day: { version: { assignments: { some: { userId } } } } },
        select: { id: true },
      });
      if (!meal) throw new BadRequestException('La comida del plan no es válida');
    }
    if (imageAssetId) {
      const asset = await this.prisma.mediaAsset.findFirst({ where: { id: imageAssetId, ownerId: userId }, select: { id: true } });
      if (!asset) throw new BadRequestException('La foto no es válida');
    }
  }

  private consumedAt(timeZone: string, date: string, time: string | null | undefined, mealType: MealType): Date {
    const now = new Date();
    const resolved = time ?? (date === todayIn(timeZone, now) ? utcToZoned(now, timeZone).time : DEFAULT_TIME[mealType]);
    const at = zonedTimeToUtc(date, resolved, timeZone);
    if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) throw new BadRequestException('No puedes registrar comidas en el futuro');
    return at;
  }

  /** [from 00:00, to+1 día 00:00) en la zona horaria dada. */
  private range(timeZone: string, from: string, to: string): Prisma.DateTimeFilter {
    return { gte: zonedTimeToUtc(from, '00:00', timeZone), lt: zonedTimeToUtc(addDays(to, 1), '00:00', timeZone) };
  }
}
