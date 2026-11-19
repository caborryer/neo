import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
  type CreateAssignmentInput,
  type ListAssignmentsQuery,
  type UpdateAssignmentInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AssignmentsService } from './assignments.service';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles(UserRole.COACH)
  @Post('coach/workout-assignments')
  create(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(createAssignmentSchema)) body: CreateAssignmentInput) {
    return this.assignments.create(coach.id, body);
  }

  @Roles(UserRole.COACH)
  @Patch('coach/workout-assignments/:id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAssignmentSchema)) body: UpdateAssignmentInput,
  ) {
    return this.assignments.update(coach.id, id, body);
  }

  @Get('workout-assignments')
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listAssignmentsQuerySchema)) query: ListAssignmentsQuery) {
    return this.assignments.list(user, query);
  }

  @Get('workout-assignments/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assignments.get(user, id);
  }
}
