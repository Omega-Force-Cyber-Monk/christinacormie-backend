import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PromotionsController } from './promotions.controller';
import { PromotionsRepository } from './promotions.repository';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PromotionsController],
  providers: [
    PromotionsService,
    PromotionsRepository,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class PromotionsModule {}
