import type { DayOfWeek, FoodUnit, MealLogStatus, MealType, NutritionAssignmentStatus } from './enums';

/** Planes nutricionales y diario. Fuente: docs/ESPECIFICACION.md §7.7 y §7.8. */

export interface NutritionFoodDto {
  id: string;
  name: string;
  quantity: number;
  unit: FoodUnit;
  notes: string | null;
}

export interface NutritionMealDto {
  id: string;
  mealType: MealType;
  title: string;
  scheduledTime: string | null;
  instructions: string | null;
  foods: NutritionFoodDto[];
}

export interface NutritionDayDto {
  id: string;
  dayNumber: number;
  dayName: DayOfWeek;
  meals: NutritionMealDto[];
}

/** Una versión publicada (publishedAt != null) es inmutable (RNF-18). */
export interface NutritionVersionDto {
  id: string;
  planId: string;
  versionNumber: number;
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  days: NutritionDayDto[];
}

export interface NutritionVersionSummaryDto {
  id: string;
  versionNumber: number;
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  assignmentCount: number;
}

export interface NutritionPlanSummaryDto {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  isActive: boolean;
  latestVersionNumber: number;
  /** Hay una versión sin publicar (borrador editable). */
  hasDraft: boolean;
  publishedVersions: number;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionPlanDetailDto extends NutritionPlanSummaryDto {
  versions: NutritionVersionSummaryDto[];
}

/** UPCOMING: aún no inicia · CURRENT: vigente hoy · PAST: venció por fecha · ENDED: finalizada o reemplazada por la Coach. */
export type AssignmentPhase = 'UPCOMING' | 'CURRENT' | 'PAST' | 'ENDED';

export interface NutritionPlanAssignmentDto {
  id: string;
  userId: string;
  userName: string;
  planId: string;
  planName: string;
  versionId: string;
  versionNumber: number;
  startDate: string;
  endDate: string | null;
  status: NutritionAssignmentStatus;
  phase: AssignmentPhase;
  createdAt: string;
}

export interface MyPlanDto {
  assignmentId: string;
  planName: string;
  planDescription: string | null;
  versionNumber: number;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  days: NutritionDayDto[];
}

export interface MyPlanResponse {
  current: MyPlanDto | null;
  /** Próximo plan, si ya fue asignado pero aún no inicia. */
  upcoming: { planName: string; startDate: string } | null;
}

export interface MealLogDto {
  id: string;
  userId: string;
  userName: string;
  plannedMealId: string | null;
  plannedMealTitle: string | null;
  mealType: MealType;
  description: string;
  imageAssetId: string | null;
  /** Ruta autenticada de la imagen (el bucket es privado, §9.2). */
  imageUrl: string | null;
  consumedAt: string;
  /** Fecha y hora locales de la usuaria (su zona horaria), para no depender de la zona del navegador. */
  date: string;
  time: string;
  status: MealLogStatus;
  coachComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetDto {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}
