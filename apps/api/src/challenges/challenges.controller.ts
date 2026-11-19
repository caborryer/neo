import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createChallengeSchema,
  listChallengesQuerySchema,
  updateChallengeSchema,
  type CreateChallengeInput,
  type ListChallengesQuery,
  type UpdateChallengeInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChallengesService } from './challenges.service';

@Controller()
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Roles(UserRole.COACH)
  @Post('coach/challenges')
  create(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(createChallengeSchema)) body: CreateChallengeInput) {
    return this.challenges.create(coach, body);
  }

  @Roles(UserRole.COACH)
  @Get('coach/challenges')
  listForCoach(@CurrentUser() coach: AuthenticatedUser, @Query(new ZodValidationPipe(listChallengesQuerySchema)) query: ListChallengesQuery) {
    return this.challenges.listForCoach(coach, query);
  }

  @Roles(UserRole.COACH)
  @Get('coach/challenges/:id')
  getForCoach(@CurrentUser() coach: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.getForCoach(coach, id);
  }

  @Roles(UserRole.COACH)
  @Patch('coach/challenges/:id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateChallengeSchema)) body: UpdateChallengeInput,
  ) {
    return this.challenges.update(coach, id, body);
  }

  @Roles(UserRole.USER)
  @Get('challenges')
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listChallengesQuerySchema)) query: ListChallengesQuery) {
    return this.challenges.listForUser(user, query);
  }

  @Roles(UserRole.USER)
  @Get('challenges/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.getForUser(user, id);
  }

  @Roles(UserRole.USER)
  @Post('challenges/:id/join')
  join(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.join(user, id);
  }

  @Roles(UserRole.USER)
  @Post('challenges/:id/leave')
  leave(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.leave(user, id);
  }

  @Roles(UserRole.USER)
  @Get('challenges/:id/progress')
  progress(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.progress(user, id);
  }
}
