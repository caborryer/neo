import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createWorkoutSchema,
  listWorkoutsQuerySchema,
  updateWorkoutSchema,
  type CreateWorkoutInput,
  type ListWorkoutsQuery,
  type UpdateWorkoutInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { WorkoutsService } from './workouts.service';

@Controller()
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Roles(UserRole.COACH)
  @Post('coach/workouts')
  create(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(createWorkoutSchema)) body: CreateWorkoutInput) {
    return this.workouts.create(coach.id, body);
  }

  @Roles(UserRole.COACH)
  @Patch('coach/workouts/:id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateWorkoutSchema)) body: UpdateWorkoutInput,
  ) {
    return this.workouts.update(coach.id, id, body);
  }

  @Get('workouts')
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listWorkoutsQuerySchema)) query: ListWorkoutsQuery) {
    return this.workouts.list(user, query);
  }

  @Get('workouts/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.get(user, id);
  }
}
