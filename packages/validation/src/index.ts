import { z } from 'zod';
import { PAGINATION } from '@neo/config';
import {
  ContentCategory,
  ContentType,
  DayOfWeek,
  FeedbackCompletion,
  FoodUnit,
  MealLogStatus,
  MealType,
  UserStatus,
  VideoVisibility,
  WorkoutAssignmentStatus,
  WorkoutCategory,
  WorkoutDifficulty,
} from '@neo/shared-types';

/** Esquemas Zod compartidos por web y api. Fuente: docs/ESPECIFICACION.md §4, §8, §10. */

export const emailSchema = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo inválido');

/** Contraseñas triviales que se rechazan aunque cumplan el largo (listas de filtraciones: siempre las primeras en probarse). */
const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '0123456789', 'qwertyuiop', 'password12', 'password123', 'password1234', 'contrasena1', 'contrasena12', 'contrasena123',
  'abcdefghij', 'abc1234567', '1q2w3e4r5t', 'iloveyou12', 'passw0rd12', 'colombia123', 'bogota1234', 'neotraining', 'neotraining1', 'neotraining123',
]);

/** Mínimo 10 caracteres (NIST/OWASP priorizan el largo sobre las reglas de composición) y sin contraseñas triviales. */
export const passwordSchema = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(10, 'Mínimo 10 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()) && !/^(.)\1+$/.test(v), 'Esa contraseña es demasiado común; elige otra');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria').max(128, 'Máximo 128 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const timezoneSchema = z.string().min(1).refine((tz) => {
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Zona horaria inválida');

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(80),
  email: emailSchema,
  timezone: timezoneSchema.default('America/Bogota'),
  accessExpiresAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), 'La fecha de expiración debe ser futura')
    .optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const changeAccessSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().trim().max(250, 'Máximo 250 caracteres').optional(),
  accessExpiresAt: z.coerce.date().nullable().optional(),
});
export type ChangeAccessInput = z.infer<typeof changeAccessSchema>;

/** Listados con paginación, filtros y ordenamiento (§8). */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  search: z.string().trim().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** HU-05 (editar usuaria, Coach). */
export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(80),
    timezone: timezoneSchema,
    // Suposición (HU-16): meta semanal editable por la Coach.
    weeklyGoal: z.number().int().min(1, 'Mínimo 1').max(14, 'Máximo 14'),
  })
  .partial()
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Perfil propio (GET/PATCH /users/me). */
export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    timezone: timezoneSchema,
    /** Foto de perfil: id de un MediaAsset propio (se sube antes con POST /media/images). null la quita. */
    avatarAssetId: z.string().uuid().nullable(),
  })
  .partial()
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// ─── Entrenamientos (HU-09, HU-10, HU-18–20) ───────────────────────────

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Acepta el ID de 11 caracteres o una URL de YouTube (watch, youtu.be, embed, shorts, live)
 * y devuelve el ID, o null si no es reconocible. Solo se aceptan hosts de YouTube.
 */
export function extractYouTubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      id = m?.[2] ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const youtubeVideoSchema = z
  .string({ error: 'El video es obligatorio' })
  .trim()
  .min(1, 'El video es obligatorio')
  .transform((v, ctx) => {
    const id = extractYouTubeId(v);
    if (!id) {
      ctx.addIssue({ code: 'custom', message: 'Ingresa un enlace o ID de YouTube válido' });
      return z.NEVER;
    }
    return id;
  });

const lineList = (max: number, itemMax: number) =>
  z
    .array(z.string().trim().min(1).max(itemMax, `Máximo ${itemMax} caracteres por ítem`))
    .max(max, `Máximo ${max} ítems`);

export const workoutBaseSchema = z.object({
  title: z.string({ error: 'El título es obligatorio' }).trim().min(1, 'El título es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres').nullish(),
  durationMinutes: z
    .number({ error: 'La duración es obligatoria' })
    .int('Debe ser un número entero')
    .min(5, 'Mínimo 5 minutos')
    .max(240, 'Máximo 240 minutos'),
  difficulty: z.nativeEnum(WorkoutDifficulty, { error: 'Selecciona un nivel' }),
  category: z.nativeEnum(WorkoutCategory, { error: 'Selecciona una categoría' }),
  video: youtubeVideoSchema,
  videoVisibility: z.nativeEnum(VideoVisibility).default(VideoVisibility.UNLISTED),
  equipment: lineList(20, 80).default([]),
  tips: lineList(20, 200).default([]),
  isPublished: z.boolean().default(false),
});
export const createWorkoutSchema = workoutBaseSchema;
export type CreateWorkoutInput = z.output<typeof createWorkoutSchema>;

export const updateWorkoutSchema = workoutBaseSchema.partial().strict();
export type UpdateWorkoutInput = z.output<typeof updateWorkoutSchema>;

export const listWorkoutsQuerySchema = paginationQuerySchema.extend({
  published: z.enum(['true', 'false']).optional(),
  category: z.nativeEnum(WorkoutCategory).optional(),
  difficulty: z.nativeEnum(WorkoutDifficulty).optional(),
});
export type ListWorkoutsQuery = z.output<typeof listWorkoutsQuerySchema>;

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)').refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}, 'Fecha inválida');

export const timeOnlySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');

export const createAssignmentSchema = z.object({
  workoutId: z.string().uuid('Clase inválida'),
  userIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos una usuaria').max(100, 'Máximo 100 usuarias por asignación'),
  scheduledDate: dateOnlySchema,
  scheduledTime: timeOnlySchema.nullish(),
});
export type CreateAssignmentInput = z.output<typeof createAssignmentSchema>;

/** Reprogramar (fecha/hora) o cancelar. No se puede mezclar con otros estados. */
export const updateAssignmentSchema = z
  .object({
    scheduledDate: dateOnlySchema.optional(),
    scheduledTime: timeOnlySchema.nullable().optional(),
    status: z.literal(WorkoutAssignmentStatus.CANCELLED).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios que guardar')
  .refine((v) => !(v.status && (v.scheduledDate || v.scheduledTime !== undefined)), 'Cancela o reprograma, no ambas a la vez');
export type UpdateAssignmentInput = z.output<typeof updateAssignmentSchema>;

export const listAssignmentsQuerySchema = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
    userId: z.string().uuid().optional(),
    status: z.nativeEnum(WorkoutAssignmentStatus).optional(),
  })
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'La fecha final debe ser posterior a la inicial' })
  .refine((v) => (new Date(`${v.to}T00:00:00Z`).getTime() - new Date(`${v.from}T00:00:00Z`).getTime()) / 86_400_000 <= 92, {
    path: ['to'],
    message: 'El rango máximo es de 92 días',
  });
export type ListAssignmentsQuery = z.output<typeof listAssignmentsQuerySchema>;

export const createSessionSchema = z.object({
  assignmentId: z.string().uuid('Asignación inválida'),
  /** Generada por el cliente al abrir la acción; un reintento HTTP con la misma clave no duplica. */
  idempotencyKey: z.string().uuid('Clave de idempotencia inválida'),
  startedAt: z.coerce.date().optional(),
});
export type CreateSessionInput = z.output<typeof createSessionSchema>;

export const listSessionsQuerySchema = paginationQuerySchema.pick({ page: true, limit: true }).extend({
  userId: z.string().uuid().optional(),
});
export type ListSessionsQuery = z.output<typeof listSessionsQuerySchema>;

export const createFeedbackSchema = z
  .object({
    completed: z.nativeEnum(FeedbackCompletion, { error: 'Indica si completaste la sesión' }),
    completionPercentage: z.number().int().min(1, 'Mínimo 1%').max(99, 'Máximo 99% (si fue 100%, elige Sí)').nullish(),
    notCompletedReason: z.string().trim().max(500, 'Máximo 500 caracteres').nullish(),
    feelingRating: z.number({ error: 'Califica cómo te sentiste' }).int().min(1, 'Entre 1 y 5').max(5, 'Entre 1 y 5'),
    feelingDescription: z.string().trim().max(500, 'Máximo 500 caracteres').nullish(),
    ateBeforeWorkout: z.boolean({ error: 'Indica si comiste antes' }),
    preWorkoutMeal: z.string().trim().max(300, 'Máximo 300 caracteres').nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.completed === FeedbackCompletion.PARTIAL && !v.completionPercentage) {
      ctx.addIssue({ code: 'custom', path: ['completionPercentage'], message: 'Indica el porcentaje completado' });
    }
    if (v.completed === FeedbackCompletion.NO && !v.notCompletedReason) {
      ctx.addIssue({ code: 'custom', path: ['notCompletedReason'], message: 'Cuéntanos el motivo' });
    }
    if (v.ateBeforeWorkout && !v.preWorkoutMeal) {
      ctx.addIssue({ code: 'custom', path: ['preWorkoutMeal'], message: 'Cuéntanos qué comiste' });
    }
  });
export type CreateFeedbackInput = z.output<typeof createFeedbackSchema>;

// ─── Nutrición (HU-11, HU-12) ───────────────────────────────────────────

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).nullish();

export const nutritionFoodSchema = z.object({
  name: z.string({ error: 'El alimento necesita un nombre' }).trim().min(1, 'El alimento necesita un nombre').max(100, 'Máximo 100 caracteres'),
  quantity: z
    .number({ error: 'Indica la cantidad' })
    .positive('La cantidad debe ser mayor que 0')
    .max(99_999, 'Cantidad demasiado grande')
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales'),
  unit: z.nativeEnum(FoodUnit, { error: 'Selecciona una unidad' }),
  notes: optionalText(300),
});

export const nutritionMealSchema = z.object({
  mealType: z.nativeEnum(MealType, { error: 'Selecciona el tipo de comida' }),
  title: z.string({ error: 'La comida necesita un título' }).trim().min(1, 'La comida necesita un título').max(100, 'Máximo 100 caracteres'),
  scheduledTime: timeOnlySchema.nullish(),
  instructions: optionalText(1000),
  foods: z.array(nutritionFoodSchema).max(30, 'Máximo 30 alimentos por comida').default([]),
});

export const nutritionDaySchema = z.object({
  dayName: z.nativeEnum(DayOfWeek, { error: 'Día inválido' }),
  meals: z.array(nutritionMealSchema).max(10, 'Máximo 10 comidas por día').default([]),
});

/** Contenido editable de una versión (borrador). La estructura es semanal: lunes a domingo (§4.4). */
export const nutritionContentSchema = z.object({
  notes: optionalText(2000),
  days: z
    .array(nutritionDaySchema)
    .max(7, 'Máximo 7 días')
    .default([])
    .refine((days) => new Set(days.map((d) => d.dayName)).size === days.length, 'Hay días repetidos'),
});
export type NutritionContentInput = z.output<typeof nutritionContentSchema>;
export type NutritionMealInput = z.output<typeof nutritionMealSchema>;

export const createNutritionPlanSchema = nutritionContentSchema.extend({
  name: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: optionalText(1000),
  isTemplate: z.boolean().default(false),
});
export type CreateNutritionPlanInput = z.output<typeof createNutritionPlanSchema>;

export const updateNutritionPlanSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres').optional(),
    description: optionalText(1000),
    isTemplate: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No hay cambios que guardar');
export type UpdateNutritionPlanInput = z.output<typeof updateNutritionPlanSchema>;

export const duplicateNutritionPlanSchema = z.object({
  name: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
  isTemplate: z.boolean().default(false),
});
export type DuplicateNutritionPlanInput = z.output<typeof duplicateNutritionPlanSchema>;

export const listNutritionPlansQuerySchema = paginationQuerySchema.extend({
  template: z.enum(['true', 'false']).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export type ListNutritionPlansQuery = z.output<typeof listNutritionPlansQuerySchema>;

export const createPlanAssignmentSchema = z
  .object({
    versionId: z.string().uuid('Versión inválida'),
    userIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos una usuaria').max(50, 'Máximo 50 usuarias por asignación'),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.nullish(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'La fecha final no puede ser anterior al inicio' });
export type CreatePlanAssignmentInput = z.output<typeof createPlanAssignmentSchema>;

export const myPlanQuerySchema = z.object({ date: dateOnlySchema.optional() });
export type MyPlanQuery = z.output<typeof myPlanQuerySchema>;

// ─── Diario alimenticio (HU-13, HU-22) ──────────────────────────────────

export const mealLogBaseSchema = z.object({
  mealType: z.nativeEnum(MealType, { error: 'Selecciona el tipo de comida' }),
  description: z.string().trim().max(1000, 'Máximo 1000 caracteres').default(''),
  /** Fecha local de la usuaria. La hora es opcional: si falta se usa la actual (hoy) o una típica del tipo de comida. */
  date: dateOnlySchema,
  time: timeOnlySchema.nullish(),
  plannedMealId: z.string().uuid().nullish(),
  imageAssetId: z.string().uuid().nullish(),
});

export const createMealLogSchema = mealLogBaseSchema.refine((v) => v.description.length > 0 || !!v.imageAssetId, {
  path: ['description'],
  message: 'Describe lo que comiste o agrega una foto',
});
export type CreateMealLogInput = z.output<typeof createMealLogSchema>;

export const updateMealLogSchema = mealLogBaseSchema.partial().strict();
export type UpdateMealLogInput = z.output<typeof updateMealLogSchema>;

const rangeDays = (from: string, to: string) => (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000;

export const listMealLogsQuerySchema = z
  .object({ from: dateOnlySchema, to: dateOnlySchema })
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'La fecha final debe ser posterior a la inicial' })
  .refine((v) => rangeDays(v.from, v.to) <= 62, { path: ['to'], message: 'El rango máximo es de 62 días' });
export type ListMealLogsQuery = z.output<typeof listMealLogsQuerySchema>;

export const listCoachMealLogsQuerySchema = paginationQuerySchema
  .pick({ page: true, limit: true })
  .extend({
    userId: z.string().uuid().optional(),
    status: z.nativeEnum(MealLogStatus).optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: 'La fecha final debe ser posterior a la inicial' });
export type ListCoachMealLogsQuery = z.output<typeof listCoachMealLogsQuerySchema>;

export const reviewMealLogSchema = z
  .object({
    status: z.enum([MealLogStatus.REVIEWED, MealLogStatus.NEEDS_CHANGES], { error: 'Elige Aprobar o Solicitar cambios' }),
    comment: z.string().trim().max(1000, 'Máximo 1000 caracteres').nullish(),
  })
  .refine((v) => v.status !== MealLogStatus.NEEDS_CHANGES || !!v.comment, {
    path: ['comment'],
    message: 'Explica qué debe cambiar la usuaria',
  });
export type ReviewMealLogInput = z.output<typeof reviewMealLogSchema>;

/** Tipos de imagen aceptados (§9.2). La validación real es por contenido del archivo, no por extensión. */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ─── Fase 4: estadísticas, riesgo, notificaciones, perfil ───────────────

export const statsRangeSchema = z.object({
  range: z.coerce.number().int().refine((v) => [7, 30, 90].includes(v), 'Rango inválido (7, 30 o 90 días)').default(30),
});
export type StatsRangeQuery = z.output<typeof statsRangeSchema>;

/** Umbrales de las alertas de riesgo (§4.8); los valores por defecto son los del spec donde existen. */
export const riskSettingsSchema = z.object({
  inactivityDays: z.number().int().min(3, 'Mínimo 3 días').max(30, 'Máximo 30 días').default(7),
  consecutiveMissed: z.number().int().min(2, 'Mínimo 2').max(10, 'Máximo 10').default(3),
  noFoodLogDays: z.number().int().min(2, 'Mínimo 2 días').max(30, 'Máximo 30 días').default(5),
  adherenceDropPoints: z.number().int().min(10, 'Mínimo 10 puntos').max(80, 'Máximo 80 puntos').default(25),
});
export type RiskSettingsInput = z.output<typeof riskSettingsSchema>;
export const DEFAULT_RISK_SETTINGS: RiskSettingsInput = { inactivityDays: 7, consecutiveMissed: 3, noFoodLogDays: 5, adherenceDropPoints: 25 };

export const RISK_CODES = ['INACTIVITY', 'CONSECUTIVE_MISSED', 'NO_FOOD_LOGS', 'ADHERENCE_DROP'] as const;
export const createFollowUpSchema = z.object({
  note: z.string({ error: 'Escribe la acción de seguimiento' }).trim().min(3, 'Describe brevemente la acción').max(1000, 'Máximo 1000 caracteres'),
  reasons: z.array(z.enum(RISK_CODES)).max(4).default([]),
});
export type CreateFollowUpInput = z.output<typeof createFollowUpSchema>;

export const listNotificationsQuerySchema = paginationQuerySchema.pick({ page: true, limit: true }).extend({
  unread: z.enum(['true', 'false']).optional(),
});
export type ListNotificationsQuery = z.output<typeof listNotificationsQuerySchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual').max(128, 'Máximo 128 caracteres'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Las contraseñas no coinciden' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'La nueva contraseña debe ser distinta de la actual' });
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

export const upsertFoodScheduleSchema = z.object({
  scheduledTime: timeOnlySchema,
  reminderEnabled: z.boolean(),
});
export type UpsertFoodScheduleInput = z.output<typeof upsertFoodScheduleSchema>;
export const foodScheduleParamSchema = z.object({ mealType: z.nativeEnum(MealType) });

// ─── Contenido (HU-33) ─────────────────────────────────────────────────

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const contentBaseSchema = z.object({
  title: z.string({ error: 'El título es obligatorio' }).trim().min(1, 'El título es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: z.preprocess(emptyToNull, z.string().trim().max(500, 'Máximo 500 caracteres').nullish()),
  category: z.nativeEnum(ContentCategory, { error: 'Selecciona una categoría' }),
  type: z.nativeEnum(ContentType, { error: 'Selecciona el tipo' }),
  body: z.preprocess(emptyToNull, z.string().trim().max(20000, 'Máximo 20.000 caracteres').nullish()),
  /** Enlace o ID de YouTube; el esquema lo normaliza al ID. */
  video: z.preprocess(emptyToNull, youtubeVideoSchema.nullish()),
  thumbnailAssetId: z.preprocess(emptyToNull, z.string().uuid('Imagen inválida').nullish()),
  published: z.boolean().default(false),
});

/** Un artículo necesita texto y un video necesita enlace de YouTube. */
export function contentCompletenessIssue(c: { type: ContentType; body?: string | null; video?: string | null }): { path: string; message: string } | null {
  if (c.type === ContentType.ARTICLE && !c.body) return { path: 'body', message: 'Escribe el texto del artículo' };
  if (c.type === ContentType.VIDEO && !c.video) return { path: 'video', message: 'Ingresa un enlace o ID de YouTube' };
  return null;
}

export const createContentSchema = contentBaseSchema.superRefine((v, ctx) => {
  const issue = contentCompletenessIssue(v);
  if (issue) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
});
export type CreateContentInput = z.output<typeof createContentSchema>;

export const updateContentSchema = contentBaseSchema.partial().strict();
export type UpdateContentInput = z.output<typeof updateContentSchema>;

export const listContentQuerySchema = paginationQuerySchema.extend({
  published: z.enum(['true', 'false']).optional(),
  category: z.nativeEnum(ContentCategory).optional(),
  type: z.nativeEnum(ContentType).optional(),
});
export type ListContentQuery = z.output<typeof listContentQuerySchema>;

// ─── Retos (HU-29, HU-30) ──────────────────────────────────────────────

const challengeBaseSchema = z.object({
  name: z.string({ error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: z.preprocess(emptyToNull, z.string().trim().max(2000, 'Máximo 2000 caracteres').nullish()),
  category: z.string({ error: 'La categoría es obligatoria' }).trim().min(1, 'La categoría es obligatoria').max(40, 'Máximo 40 caracteres'),
  goal: z.number({ error: 'El objetivo es obligatorio' }).int('Debe ser un número entero').min(1, 'Mínimo 1 sesión').max(365, 'Máximo 365 sesiones'),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  published: z.boolean().default(false),
});

export const createChallengeSchema = challengeBaseSchema.refine((v) => v.endDate >= v.startDate, {
  path: ['endDate'],
  message: 'La fecha de fin no puede ser anterior al inicio',
});
export type CreateChallengeInput = z.output<typeof createChallengeSchema>;

export const updateChallengeSchema = challengeBaseSchema.partial().strict();
export type UpdateChallengeInput = z.output<typeof updateChallengeSchema>;

export const listChallengesQuerySchema = paginationQuerySchema.extend({
  published: z.enum(['true', 'false']).optional(),
});
export type ListChallengesQuery = z.output<typeof listChallengesQuerySchema>;
