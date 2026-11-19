import { BadRequestException, Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { foodScheduleParamSchema, upsertFoodScheduleSchema, type UpsertFoodScheduleInput } from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DEFAULT_FOOD_TIMES, FoodSchedulesService } from './food-schedules.service';

@Roles(UserRole.USER)
@Controller('food-schedules')
export class FoodSchedulesController {
  constructor(private readonly schedules: FoodSchedulesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.schedules.list(user.id);
  }

  @Put(':mealType')
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: Record<string, string>,
    @Body(new ZodValidationPipe(upsertFoodScheduleSchema)) body: UpsertFoodScheduleInput,
  ) {
    const parsed = foodScheduleParamSchema.safeParse(params);
    if (!parsed.success || !(parsed.data.mealType in DEFAULT_FOOD_TIMES)) throw new BadRequestException('Tipo de comida inválido');
    return this.schedules.upsert(user.id, parsed.data.mealType, body);
  }
}
