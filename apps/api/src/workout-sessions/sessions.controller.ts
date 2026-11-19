import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import {
  createFeedbackSchema,
  createSessionSchema,
  listSessionsQuerySchema,
  type CreateFeedbackInput,
  type CreateSessionInput,
  type ListSessionsQuery,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SessionsService } from './sessions.service';

@Controller('workout-sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Completar entrenamientos es solo de la usuaria (§13.4). 201 si se crea; 200 si es un reintento idempotente. */
  @Roles(UserRole.USER)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSessionSchema)) body: CreateSessionInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, created } = await this.sessions.create(user, body);
    res.status(created ? 201 : 200);
    return session;
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listSessionsQuerySchema)) query: ListSessionsQuery) {
    return this.sessions.list(user, query);
  }

  @Roles(UserRole.USER)
  @HttpCode(201)
  @Post(':id/feedback')
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createFeedbackSchema)) body: CreateFeedbackInput,
  ) {
    return this.sessions.createFeedback(user, id, body);
  }
}
