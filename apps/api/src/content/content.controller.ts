import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createContentSchema,
  listContentQuerySchema,
  updateContentSchema,
  type CreateContentInput,
  type ListContentQuery,
  type UpdateContentInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Roles(UserRole.COACH)
  @Post('coach/content')
  create(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(createContentSchema)) body: CreateContentInput) {
    return this.content.create(coach.id, body);
  }

  @Roles(UserRole.COACH)
  @Patch('coach/content/:id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateContentSchema)) body: UpdateContentInput,
  ) {
    return this.content.update(coach.id, id, body);
  }

  @Roles(UserRole.COACH)
  @Delete('coach/content/:id')
  remove(@CurrentUser() coach: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.remove(coach.id, id);
  }

  @Get('content')
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listContentQuerySchema)) query: ListContentQuery) {
    return this.content.list(user, query);
  }

  @Get('content/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.content.get(user, id);
  }
}
