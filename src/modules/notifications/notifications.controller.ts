import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get notifications for current authenticated user' })
  @Get()
  getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.getMyNotifications(user.sub, query);
  }

  @ApiOperation({ summary: 'Get unread notification count for current user' })
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.sub);
  }
}
