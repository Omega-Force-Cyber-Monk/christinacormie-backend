import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseModule } from '../../infrastructure/firebase/firebase.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [JwtModule.register({}), FirebaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, JwtAuthGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
