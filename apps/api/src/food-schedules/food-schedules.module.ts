import { Module } from '@nestjs/common';
import { FoodSchedulesController } from './food-schedules.controller';
import { FoodSchedulesService } from './food-schedules.service';

@Module({ controllers: [FoodSchedulesController], providers: [FoodSchedulesService] })
export class FoodSchedulesModule {}
