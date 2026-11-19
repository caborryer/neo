import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccessManagementModule } from './access-management/access-management.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { AssignmentsModule } from './workout-assignments/assignments.module';
import { SessionsModule } from './workout-sessions/sessions.module';
import { StorageModule } from './storage/storage.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StatisticsModule } from './statistics/statistics.module';
import { ContentModule } from './content/content.module';
import { ChallengesModule } from './challenges/challenges.module';
import { FoodSchedulesModule } from './food-schedules/food-schedules.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'], validate: validateEnv }),
    // RNF-04 / §10.1: límite general; los endpoints de auth tendrán límites más estrictos (HU-01).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: () => config.get('DISABLE_RATE_LIMIT') === true,
      }),
    }),
    DatabaseModule,
    AuditModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AccessManagementModule,
    WorkoutsModule,
    AssignmentsModule,
    SessionsModule,
    StorageModule,
    NutritionModule,
    NotificationsModule,
    StatisticsModule,
    FoodSchedulesModule,
    ContentModule,
    ChallengesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // Orden de ejecución: límite de tasa → CSRF → sesión (JWT + estado en BD) → rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
