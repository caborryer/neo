import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  changeAccessSchema,
  paginationQuerySchema,
  type ChangeAccessInput,
  type PaginationQuery,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccessService } from './access.service';

@Roles(UserRole.COACH)
@Controller('coach/users/:id')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Patch('access')
  change(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeAccessSchema)) body: ChangeAccessInput,
  ) {
    return this.access.changeAccess(coach.id, id, body);
  }

  @Get('access-history')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.access.history(id, query);
  }
}
