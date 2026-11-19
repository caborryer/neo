import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { updateProfileSchema, type UpdateProfileInput } from '@neo/validation';
import { CurrentUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { toAuthUser } from './user.mapper';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return toAuthUser(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return toAuthUser(await this.users.updateProfile(user.id, body));
  }

  @HttpCode(200)
  @Post('me/privacy-consent')
  async acceptPrivacy(@CurrentUser() user: AuthenticatedUser) {
    return toAuthUser(await this.users.acceptPrivacy(user.id));
  }
}
