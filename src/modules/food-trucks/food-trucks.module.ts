import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FoodTrucksController } from './food-trucks.controller';
import { FoodTrucksRepository } from './food-trucks.repository';
import { FoodTrucksService } from './food-trucks.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FoodTrucksController],
  providers: [FoodTrucksService, FoodTrucksRepository, JwtAuthGuard, RolesGuard],
  exports: [FoodTrucksService],
})
export class FoodTrucksModule {}
