import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService, SettingsService],
})
export class StatisticsModule {}
