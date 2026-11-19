import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  createFollowUpSchema,
  riskSettingsSchema,
  statsRangeSchema,
  type CreateFollowUpInput,
  type RiskSettingsInput,
  type StatsRangeQuery,
} from '@neo/validation';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { SettingsService } from './settings.service';
import { StatisticsService } from './statistics.service';

@Controller()
export class StatisticsController {
  constructor(
    private readonly stats: StatisticsService,
    private readonly settings: SettingsService,
  ) {}

  @Roles(UserRole.USER)
  @Get('dashboard')
  userDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.userDashboard(user);
  }

  @Roles(UserRole.COACH)
  @Get('coach/dashboard')
  coachDashboard(@CurrentUser() coach: AuthenticatedUser, @Query(new ZodValidationPipe(statsRangeSchema)) q: StatsRangeQuery) {
    return this.stats.coachDashboard(coach, q.range);
  }

  @Roles(UserRole.COACH)
  @Get('coach/users/:id/statistics')
  userStatistics(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(statsRangeSchema)) q: StatsRangeQuery) {
    return this.stats.userStatistics(id, q.range);
  }

  @Roles(UserRole.COACH)
  @Get('coach/users/:id/follow-ups')
  followUps(@Param('id', ParseUUIDPipe) id: string) {
    return this.stats.listFollowUps(id);
  }

  @Roles(UserRole.COACH)
  @Post('coach/users/:id/follow-ups')
  createFollowUp(
    @CurrentUser() coach: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createFollowUpSchema)) body: CreateFollowUpInput,
  ) {
    return this.stats.createFollowUp(coach.id, id, body);
  }

  @Roles(UserRole.COACH)
  @Get('coach/settings/risk')
  getRisk() {
    return this.settings.getRisk();
  }

  @Roles(UserRole.COACH)
  @Put('coach/settings/risk')
  updateRisk(@CurrentUser() coach: AuthenticatedUser, @Body(new ZodValidationPipe(riskSettingsSchema)) body: RiskSettingsInput) {
    return this.settings.updateRisk(coach.id, body);
  }
}
