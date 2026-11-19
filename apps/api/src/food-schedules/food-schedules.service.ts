import { Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import type { FoodScheduleDto, MealType as MealTypeDto } from '@neo/shared-types';
import type { UpsertFoodScheduleInput } from '@neo/validation';
import { PrismaService } from '../database/prisma.service';

/** Horas sugeridas hasta que la usuaria configure las suyas. "Otro" no tiene horario. */
export const DEFAULT_FOOD_TIMES: Partial<Record<MealType, string>> = {
  BREAKFAST: '08:00',
  MORNING_SNACK: '10:30',
  LUNCH: '13:00',
  AFTERNOON_SNACK: '16:00',
  DINNER: '19:30',
};

/**
 * HU-23: horarios de comida y recordatorios. Solo guarda la preferencia: en el MVP no hay envío
 * programado de recordatorios (no hay cola de trabajos, correo ni push); se muestran en la app.
 */
@Injectable()
export class FoodSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FoodScheduleDto[]> {
    const rows = await this.prisma.foodSchedule.findMany({ where: { userId } });
    const saved = new Map(rows.map((r) => [r.mealType, r]));
    return (Object.keys(DEFAULT_FOOD_TIMES) as MealType[]).map((mealType) => {
      const row = saved.get(mealType);
      return row
        ? { mealType: mealType as MealTypeDto, scheduledTime: row.scheduledTime, reminderEnabled: row.reminderEnabled, isDefault: false }
          : { mealType: mealType as MealTypeDto, scheduledTime: DEFAULT_FOOD_TIMES[mealType]!, reminderEnabled: false, isDefault: true };
    });
  }

  async upsert(userId: string, mealType: MealType, input: UpsertFoodScheduleInput): Promise<FoodScheduleDto> {
    const row = await this.prisma.foodSchedule.upsert({
      where: { userId_mealType: { userId, mealType } },
      create: { userId, mealType, scheduledTime: input.scheduledTime, reminderEnabled: input.reminderEnabled },
      update: { scheduledTime: input.scheduledTime, reminderEnabled: input.reminderEnabled },
    });
    return { mealType: mealType as MealTypeDto, scheduledTime: row.scheduledTime, reminderEnabled: row.reminderEnabled, isDefault: false };
  }
}
