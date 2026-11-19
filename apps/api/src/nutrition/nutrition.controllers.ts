import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createMealLogSchema,
  createNutritionPlanSchema,
  createPlanAssignmentSchema,
  duplicateNutritionPlanSchema,
  listCoachMealLogsQuerySchema,
  listMealLogsQuerySchema,
  listNutritionPlansQuerySchema,
  myPlanQuerySchema,
  nutritionContentSchema,
  reviewMealLogSchema,
  updateMealLogSchema,
  updateNutritionPlanSchema,
  type CreateMealLogInput,
  type CreateNutritionPlanInput,
  type CreatePlanAssignmentInput,
  type DuplicateNutritionPlanInput,
  type ListCoachMealLogsQuery,
  type ListMealLogsQuery,
  type ListNutritionPlansQuery,
  type MyPlanQuery,
  type NutritionContentInput,
  type ReviewMealLogInput,
  type UpdateMealLogInput,
  type UpdateNutritionPlanInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MealLogsService } from './meal-logs.service';
import { MyPlanService } from './my-plan.service';
import { NutritionPlansService } from './plans.service';

const uuid = new ParseUUIDPipe();

/** HU-11 y HU-12: constructor de planes, versiones y asignaciones. Solo la Coach. */
@Roles(UserRole.COACH)
@Controller('coach')
export class NutritionPlansController {
  constructor(private readonly plans: NutritionPlansService) {}

  @Post('nutrition-plans')
  create(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(createNutritionPlanSchema)) body: CreateNutritionPlanInput) {
    return this.plans.create(coach.id, body);
  }

  @Get('nutrition-plans')
  list(@Query(new ZodValidationPipe(listNutritionPlansQuerySchema)) query: ListNutritionPlansQuery) {
    return this.plans.list(query);
  }

  @Get('nutrition-plans/:id')
  get(@Param('id', uuid) id: string) {
    return this.plans.get(id);
  }

  @Patch('nutrition-plans/:id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateNutritionPlanSchema)) body: UpdateNutritionPlanInput,
  ) {
    return this.plans.update(coach.id, id, body);
  }

  @Post('nutrition-plans/:id/duplicate')
  duplicate(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(duplicateNutritionPlanSchema)) body: DuplicateNutritionPlanInput,
  ) {
    return this.plans.duplicate(coach.id, id, body);
  }

  @Post('nutrition-plans/:id/versions')
  createVersion(@CurrentUser() coach: AuthenticatedUser, @Param('id', uuid) id: string) {
    return this.plans.createVersion(coach.id, id);
  }

  @Get('nutrition-plans/:id/versions/:versionId')
  getVersion(@Param('id', uuid) id: string, @Param('versionId', uuid) versionId: string) {
    return this.plans.getVersion(id, versionId);
  }

  @Put('nutrition-plans/:id/versions/:versionId')
  saveDraft(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('versionId', uuid) versionId: string,
    @Body(new ZodValidationPipe(nutritionContentSchema)) body: NutritionContentInput,
  ) {
    return this.plans.saveDraft(coach.id, id, versionId, body);
  }

  @Post('nutrition-plans/:id/versions/:versionId/publish')
  @HttpCode(200)
  publish(@CurrentUser() coach: AuthenticatedUser, @Param('id', uuid) id: string, @Param('versionId', uuid) versionId: string) {
    return this.plans.publish(coach.id, id, versionId);
  }

  @Post('nutrition-plans/:id/assignments')
  assign(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(createPlanAssignmentSchema)) body: CreatePlanAssignmentInput,
  ) {
    return this.plans.assign(coach.id, id, body);
  }

  @Get('nutrition-plans/:id/assignments')
  listAssignments(@Param('id', uuid) id: string) {
    return this.plans.listForPlan(id);
  }

  @Post('nutrition-assignments/:id/end')
  @HttpCode(200)
  endAssignment(@CurrentUser() coach: AuthenticatedUser, @Param('id', uuid) id: string) {
    return this.plans.endAssignment(coach.id, id);
  }

  @Get('users/:id/nutrition-plans')
  history(@Param('id', uuid) id: string) {
    return this.plans.listForUser(id);
  }
}

/** HU-21: la usuaria consulta su plan (solo lectura). */
@Roles(UserRole.USER)
@Controller('nutrition/my-plan')
export class MyPlanController {
  constructor(private readonly myPlan: MyPlanService) {}

  @Get()
  current(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(myPlanQuerySchema)) query: MyPlanQuery) {
    return this.myPlan.current(user, query.date);
  }

  @Get('history')
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.myPlan.history(user);
  }
}

/** HU-22: diario alimenticio de la usuaria. */
@Roles(UserRole.USER)
@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly logs: MealLogsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(createMealLogSchema)) body: CreateMealLogInput) {
    return this.logs.create(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listMealLogsQuerySchema)) query: ListMealLogsQuery) {
    return this.logs.listMine(user, query);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateMealLogSchema)) body: UpdateMealLogInput,
  ) {
    return this.logs.update(user, id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string) {
    return this.logs.submit(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', uuid) id: string) {
    await this.logs.remove(user, id);
  }
}

/** HU-13: la Coach revisa los registros enviados. */
@Roles(UserRole.COACH)
@Controller('coach')
export class CoachMealLogsController {
  constructor(private readonly logs: MealLogsService) {}

  @Get('meal-logs')
  list(@CurrentUser() coach: AuthenticatedUser, @Query(new ZodValidationPipe(listCoachMealLogsQuerySchema)) query: ListCoachMealLogsQuery) {
    return this.logs.listForCoach(coach, query);
  }

  @Get('users/:id/meal-logs')
  listForUser(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Query(new ZodValidationPipe(listCoachMealLogsQuerySchema)) query: ListCoachMealLogsQuery,
  ) {
    return this.logs.listForCoach(coach, { ...query, userId: id });
  }

  @Post('meal-logs/:id/review')
  @HttpCode(200)
  review(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(reviewMealLogSchema)) body: ReviewMealLogInput,
  ) {
    return this.logs.review(coach, id, body);
  }
}
