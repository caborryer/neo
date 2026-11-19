import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from './users.service';

/** Gestión de usuarias por la Coach (HU-05). */
@Roles(UserRole.COACH)
@Controller('coach/users')
export class CoachUsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  async create(
    @CurrentUser() coach: AuthenticatedUser,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ) {
    const { user, invitationSent } = await this.users.create(coach.id, body);
    return { ...user, invitationSent };
  }

  @Get()
  list(@Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.users.update(coach.id, id, body);
  }

  @HttpCode(200)
  @Post(':id/resend-invitation')
  resendInvitation(@CurrentUser() coach: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resendInvitation(coach.id, id);
  }
}
