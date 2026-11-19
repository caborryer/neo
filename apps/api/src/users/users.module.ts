import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachUsersController } from './coach-users.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, CoachUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
