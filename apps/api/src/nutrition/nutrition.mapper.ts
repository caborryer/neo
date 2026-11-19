import type { Prisma } from '@prisma/client';
import type {
  AssignmentPhase,
  MealLogDto,
  NutritionDayDto,
  NutritionPlanAssignmentDto,
  NutritionPlanDetailDto,
  NutritionPlanSummaryDto,
  NutritionVersionDto,
} from '@neo/shared-types';
import { formatDateOnly, utcToZoned } from '../common/dates';
import { mediaUrl } from '../storage/media.service';

/** Lunes a domingo ↔ 1 a 7 (§7.7). */
export const DAY_NUMBER = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 } as const;

export const versionTreeInclude = {
  days: {
    orderBy: { dayNumber: 'asc' },
    include: { meals: { orderBy: [{ scheduledTime: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }], include: { foods: { orderBy: { name: 'asc' } } } } },
  },
} satisfies Prisma.NutritionPlanVersionInclude;

type VersionTree = Prisma.NutritionPlanVersionGetPayload<{ include: typeof versionTreeInclude }>;

export function toDaysDto(days: VersionTree['days']): NutritionDayDto[] {
  return days.map((d) => ({
    id: d.id,
    dayNumber: d.dayNumber,
    dayName: (d.dayName ?? 'MONDAY') as NutritionDayDto['dayName'],
    meals: d.meals.map((m) => ({
      id: m.id,
      mealType: m.mealType as NutritionDayDto['meals'][number]['mealType'],
      title: m.title,
      scheduledTime: m.scheduledTime,
      instructions: m.instructions,
      foods: m.foods.map((f) => ({ id: f.id, name: f.name, quantity: Number(f.quantity), unit: f.unit as never, notes: f.notes })),
    })),
  }));
}

export function toVersionDto(v: VersionTree): NutritionVersionDto {
  return {
    id: v.id,
    planId: v.planId,
    versionNumber: v.versionNumber,
    notes: v.notes,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    days: toDaysDto(v.days),
  };
}

export const planInclude = {
  versions: {
    orderBy: { versionNumber: 'desc' },
    select: { id: true, versionNumber: true, notes: true, publishedAt: true, createdAt: true, _count: { select: { assignments: true } } },
  },
} satisfies Prisma.NutritionPlanInclude;

type PlanRow = Prisma.NutritionPlanGetPayload<{ include: typeof planInclude }>;

export function toPlanSummaryDto(p: PlanRow): NutritionPlanSummaryDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isTemplate: p.isTemplate,
    isActive: p.isActive,
    latestVersionNumber: p.versions[0]?.versionNumber ?? 0,
    hasDraft: p.versions.some((v) => v.publishedAt === null),
    publishedVersions: p.versions.filter((v) => v.publishedAt !== null).length,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPlanDetailDto(p: PlanRow): NutritionPlanDetailDto {
  return {
    ...toPlanSummaryDto(p),
    versions: p.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      notes: v.notes,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
      assignmentCount: v._count.assignments,
    })),
  };
}

export const assignmentInclude = {
  user: { select: { firstName: true, lastName: true, timezone: true } },
  version: { select: { versionNumber: true, planId: true, plan: { select: { name: true, description: true } } } },
} satisfies Prisma.NutritionPlanAssignmentInclude;

type AssignmentRow = Prisma.NutritionPlanAssignmentGetPayload<{ include: typeof assignmentInclude }>;

/** `today` es la fecha de hoy en la zona horaria de la usuaria (RNF-16). */
export function phaseOf(a: { status: string; startDate: Date; endDate: Date | null }, today: string): AssignmentPhase {
  if (a.status === 'ENDED') return 'ENDED';
  if (formatDateOnly(a.startDate) > today) return 'UPCOMING';
  if (a.endDate && formatDateOnly(a.endDate) < today) return 'PAST';
  return 'CURRENT';
}

export function toAssignmentDto(a: AssignmentRow, today: string): NutritionPlanAssignmentDto {
  return {
    id: a.id,
    userId: a.userId,
    userName: `${a.user.firstName} ${a.user.lastName}`.trim(),
    planId: a.version.planId,
    planName: a.version.plan.name,
    versionId: a.versionId,
    versionNumber: a.version.versionNumber,
    startDate: formatDateOnly(a.startDate),
    endDate: a.endDate ? formatDateOnly(a.endDate) : null,
    status: a.status as NutritionPlanAssignmentDto['status'],
    phase: phaseOf(a, today),
    createdAt: a.createdAt.toISOString(),
  };
}

export const mealLogInclude = {
  user: { select: { firstName: true, lastName: true, timezone: true } },
  plannedMeal: { select: { title: true } },
} satisfies Prisma.MealLogInclude;

type MealLogRow = Prisma.MealLogGetPayload<{ include: typeof mealLogInclude }>;

export function toMealLogDto(l: MealLogRow): MealLogDto {
  const local = utcToZoned(l.consumedAt, l.user.timezone);
  return {
    id: l.id,
    userId: l.userId,
    userName: `${l.user.firstName} ${l.user.lastName}`.trim(),
    plannedMealId: l.plannedMealId,
    plannedMealTitle: l.plannedMeal?.title ?? null,
    mealType: l.mealType as MealLogDto['mealType'],
    description: l.description,
    imageAssetId: l.imageAssetId,
    imageUrl: l.imageAssetId ? mediaUrl(l.imageAssetId) : null,
    consumedAt: l.consumedAt.toISOString(),
    date: local.date,
    time: local.time,
    status: l.status as MealLogDto['status'],
    coachComment: l.coachComment,
    reviewedAt: l.reviewedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}
