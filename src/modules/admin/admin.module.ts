import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [JwtModule.register({}), UsersModule, ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, JwtAuthGuard, RolesGuard],
})
export class AdminModule {}
