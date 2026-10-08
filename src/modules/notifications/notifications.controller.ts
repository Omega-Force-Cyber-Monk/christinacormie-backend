import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description:
      'Notifications returned as an array. Use metadata.entityType + metadata.entityId for app navigation. Supported entityType values include BOOKING, CONVERSATION, COMMUNITY_REQUEST, BOOKING_ISSUE, PAYMENT, REFUND, VENDOR_VERIFICATION, VENDOR, FOOD_TRUCK, PROMOTION, REWARD_REDEMPTION, REWARD, CHECK_IN, BADGE, POST, REVIEW, REPORT, and REFERRAL. Push notifications use the same keys in FCM data.',
    schema: {
      example: [
        {
          id: 'notification-id',
          userId: 'user-id',
          actorUserId: 'actor-user-id',
          type: 'BOOKING',
          title: 'New booking request',
          message: 'New booking request BD-20261001-ABC123 for your truck.',
          foodTruckId: 'food-truck-id',
          bookingId: 'booking-id',
          postId: null,
          conversationId: null,
          actionUrl: '/api/v1/bookings/booking-id',
          metadata: {
            eventType: 'BOOKING_CREATED',
            entityType: 'BOOKING',
            entityId: 'booking-id',
            bookingId: 'booking-id',
            foodTruckId: 'food-truck-id',
          },
          isRead: false,
          readAt: null,
          createdAt: '2026-10-07T10:00:00.000Z',
          foodTruck: {
            id: 'food-truck-id',
            name: 'Taco Paradise',
            slug: 'taco-paradise',
            profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco.jpg',
          },
          booking: {
            id: 'booking-id',
            bookingNumber: 'BD-20261001-ABC123',
            status: 'PENDING',
          },
          post: null,
        },
      ],
    },
  })
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
