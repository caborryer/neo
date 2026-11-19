import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptLimiter } from './login-attempt-limiter';
import { PasswordTokenService } from './password-token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordTokenService, LoginAttemptLimiter],
  exports: [PasswordTokenService, JwtModule],
})
export class AuthModule {}
