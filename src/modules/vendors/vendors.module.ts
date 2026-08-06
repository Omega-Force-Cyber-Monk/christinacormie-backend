import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { VendorsController } from './vendors.controller';
import { VendorsRepository } from './vendors.repository';
import { VendorsService } from './vendors.service';

@Module({
  imports: [JwtModule.register({}), CheckInsModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorsRepository, JwtAuthGuard, RolesGuard],
  exports: [VendorsService],
})
export class VendorsModule {}
