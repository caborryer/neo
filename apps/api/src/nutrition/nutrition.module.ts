import { Module } from '@nestjs/common';
import { MealLogsService } from './meal-logs.service';
import { MyPlanService } from './my-plan.service';
import { CoachMealLogsController, MealLogsController, MyPlanController, NutritionPlansController } from './nutrition.controllers';
import { NutritionPlansService } from './plans.service';

@Module({
  controllers: [NutritionPlansController, MyPlanController, MealLogsController, CoachMealLogsController],
  providers: [NutritionPlansService, MyPlanService, MealLogsService],
})
export class NutritionModule {}
