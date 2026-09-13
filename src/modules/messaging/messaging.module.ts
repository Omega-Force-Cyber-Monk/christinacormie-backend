import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { MessagingRealtimeService } from './messaging-realtime.service';
import { MessagingService } from './messaging.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule, NotificationsModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingRealtimeService,
    MessagingGateway,
    JwtAuthGuard,
  ],
})
export class MessagingModule {}
