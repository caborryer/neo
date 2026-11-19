import { describe, expect, it } from 'vitest';
import {
  createMealLogSchema,
  createNutritionPlanSchema,
  createPlanAssignmentSchema,
  listMealLogsQuerySchema,
  nutritionContentSchema,
  reviewMealLogSchema,
  updateMealLogSchema,
  updateNutritionPlanSchema,
} from './index';

const uuid = '3f2c1d4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f';
const food = { name: 'Avena', quantity: 50, unit: 'GRAMS' };
const meal = { mealType: 'BREAKFAST', title: 'Desayuno', scheduledTime: '07:00', foods: [food] };

describe('planes nutricionales (HU-11)', () => {
  it('acepta un plan semanal y completa los valores por defecto', () => {
    const r = createNutritionPlanSchema.parse({ name: ' Plan base ', days: [{ dayName: 'MONDAY', meals: [meal] }] });
    expect(r.name).toBe('Plan base');
    expect(r.isTemplate).toBe(false);
    expect(r.days[0]!.meals[0]!.foods).toHaveLength(1);
  });

  it('permite un borrador sin días', () => {
    expect(createNutritionPlanSchema.safeParse({ name: 'Borrador' }).success).toBe(true);
  });

  it('rechaza días repetidos, cantidades inválidas y horas malas', () => {
    expect(nutritionContentSchema.safeParse({ days: [{ dayName: 'MONDAY' }, { dayName: 'MONDAY' }] }).success).toBe(false);
    const bad = (f: object) => nutritionContentSchema.safeParse({ days: [{ dayName: 'MONDAY', meals: [{ ...meal, foods: [{ ...food, ...f }] }] }] }).success;
    expect(bad({ quantity: 0 })).toBe(false);
    expect(bad({ quantity: -3 })).toBe(false);
    expect(bad({ quantity: 1.234 })).toBe(false);
    expect(bad({ quantity: 1.25 })).toBe(true);
    expect(bad({ unit: 'LITROS' })).toBe(false);
    expect(nutritionContentSchema.safeParse({ days: [{ dayName: 'MONDAY', meals: [{ ...meal, scheduledTime: '7am' }] }] }).success).toBe(false);
  });

  it('exige nombre y limita el largo', () => {
    expect(createNutritionPlanSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(createNutritionPlanSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
  });

  it('actualizar el plan no admite campos extra ni vacío', () => {
    expect(updateNutritionPlanSchema.safeParse({}).success).toBe(false);
    expect(updateNutritionPlanSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateNutritionPlanSchema.safeParse({ createdById: uuid }).success).toBe(false);
  });
});

describe('asignación de planes (HU-12)', () => {
  const base = { versionId: uuid, userIds: [uuid], startDate: '2026-11-20' };
  it('acepta vigencia abierta o cerrada', () => {
    expect(createPlanAssignmentSchema.safeParse(base).success).toBe(true);
    expect(createPlanAssignmentSchema.safeParse({ ...base, endDate: '2026-12-20' }).success).toBe(true);
  });
  it('rechaza fin anterior al inicio, sin usuarias o fechas imposibles', () => {
    expect(createPlanAssignmentSchema.safeParse({ ...base, endDate: '2026-11-19' }).success).toBe(false);
    expect(createPlanAssignmentSchema.safeParse({ ...base, userIds: [] }).success).toBe(false);
    expect(createPlanAssignmentSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(false);
  });
});

describe('diario alimenticio (HU-22)', () => {
  const base = { mealType: 'LUNCH', description: 'Pollo con arroz', date: '2026-11-18' };
  it('crea con descripción o con solo foto', () => {
    expect(createMealLogSchema.safeParse(base).success).toBe(true);
    expect(createMealLogSchema.safeParse({ ...base, description: '', imageAssetId: uuid }).success).toBe(true);
  });
  it('rechaza un registro vacío', () => {
    expect(createMealLogSchema.safeParse({ ...base, description: '   ' }).success).toBe(false);
    expect(createMealLogSchema.safeParse({ mealType: 'LUNCH', date: '2026-11-18' }).success).toBe(false);
  });
  it('plannedMealId es opcional y debe ser UUID', () => {
    expect(createMealLogSchema.safeParse({ ...base, plannedMealId: null }).success).toBe(true);
    expect(createMealLogSchema.safeParse({ ...base, plannedMealId: 'x' }).success).toBe(false);
  });
  it('editar admite cambios parciales y no campos ajenos', () => {
    expect(updateMealLogSchema.safeParse({ description: 'otra' }).success).toBe(true);
    expect(updateMealLogSchema.safeParse({ status: 'REVIEWED' }).success).toBe(false);
  });
  it('el rango de consulta no pasa de 62 días', () => {
    expect(listMealLogsQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-07' }).success).toBe(true);
    expect(listMealLogsQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(false);
    expect(listMealLogsQuerySchema.safeParse({ from: '2026-11-08', to: '2026-11-07' }).success).toBe(false);
  });
});

describe('revisión de la Coach (HU-13)', () => {
  it('aprobar no exige comentario; pedir cambios sí', () => {
    expect(reviewMealLogSchema.safeParse({ status: 'REVIEWED' }).success).toBe(true);
    expect(reviewMealLogSchema.safeParse({ status: 'NEEDS_CHANGES' }).success).toBe(false);
    expect(reviewMealLogSchema.safeParse({ status: 'NEEDS_CHANGES', comment: 'Falta la porción' }).success).toBe(true);
  });
  it('no se puede revisar a un estado distinto', () => {
    expect(reviewMealLogSchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
    expect(reviewMealLogSchema.safeParse({ status: 'SUBMITTED' }).success).toBe(false);
  });
});

import { changePasswordSchema, createFollowUpSchema, riskSettingsSchema, statsRangeSchema, upsertFoodScheduleSchema, updateProfileSchema } from './index';

describe('fase 4 · esquemas', () => {
  it('rango de estadísticas: 7, 30 o 90 (por defecto 30)', () => {
    expect(statsRangeSchema.parse({}).range).toBe(30);
    expect(statsRangeSchema.parse({ range: '7' }).range).toBe(7);
    expect(statsRangeSchema.safeParse({ range: '15' }).success).toBe(false);
  });
  it('umbrales de riesgo con los valores por defecto del spec y límites', () => {
    expect(riskSettingsSchema.parse({})).toEqual({ inactivityDays: 7, consecutiveMissed: 3, noFoodLogDays: 5, adherenceDropPoints: 25 });
    expect(riskSettingsSchema.safeParse({ inactivityDays: 1 }).success).toBe(false);
    expect(riskSettingsSchema.safeParse({ consecutiveMissed: 2.5 }).success).toBe(false);
  });
  it('el seguimiento exige una nota y solo códigos conocidos', () => {
    expect(createFollowUpSchema.safeParse({ note: ' ' }).success).toBe(false);
    expect(createFollowUpSchema.safeParse({ note: 'Le escribí por WhatsApp', reasons: ['INACTIVITY'] }).success).toBe(true);
    expect(createFollowUpSchema.safeParse({ note: 'ok ok', reasons: ['OTRA'] }).success).toBe(false);
  });
  it('cambiar contraseña: coincidencia, mínimo y distinta de la actual', () => {
    const ok = { currentPassword: 'vieja-clave', newPassword: 'nueva-clave-1', confirmPassword: 'nueva-clave-1' };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'otra' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, newPassword: 'corta', confirmPassword: 'corta' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, newPassword: 'vieja-clave', confirmPassword: 'vieja-clave' }).success).toBe(false);
  });
  it('horario de comida: hora válida y recordatorio booleano', () => {
    expect(upsertFoodScheduleSchema.safeParse({ scheduledTime: '07:30', reminderEnabled: true }).success).toBe(true);
    expect(upsertFoodScheduleSchema.safeParse({ scheduledTime: '7:30', reminderEnabled: true }).success).toBe(false);
  });
  it('el perfil acepta foto (UUID o null) pero no campos de acceso', () => {
    expect(updateProfileSchema.safeParse({ avatarAssetId: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ avatarAssetId: 'x' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ role: 'COACH' }).success).toBe(false);
  });
});
