import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationInput,
  NotificationsRepository,
} from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  getMyNotifications(userId: string, query: NotificationQueryDto) {
    return this.notificationsRepository.findForUser(userId, {
      unreadOnly: query.unreadOnly,
      limit: Math.min(query.limit ?? 20, 50),
    });
  }

  async getUnreadCount(userId: string) {
    return {
      unreadCount: await this.notificationsRepository.countUnread(userId),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notificationsRepository.findUserNotification(
      userId,
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    return this.notificationsRepository.markRead(notificationId);
  }

  async markAllRead(userId: string) {
    const result = await this.notificationsRepository.markAllRead(userId);

    return {
      updatedCount: result.count,
    };
  }

  async createNotification(data: NotificationInput) {
    const preferences = await this.notificationsRepository.getPreferences(data.userId);

    if (!this.isAllowedByPreference(data.type, preferences)) {
      return null;
    }

    return this.notificationsRepository.create(data);
  }

  async notifyFoodTruckUpdate(data: {
    actorUserId: string;
    foodTruckId: string;
    postId?: string;
    title?: string;
    message?: string;
  }) {
    const foodTruck = await this.notificationsRepository.findFoodTruckById(
      data.foodTruckId,
    );

    if (!foodTruck) {
      return { sentCount: 0 };
    }

    const recipients =
      await this.notificationsRepository.findFoodTruckUpdateRecipients(
        data.foodTruckId,
        data.actorUserId,
      );

    let sentCount = 0;
    for (const recipient of recipients) {
      const notification = await this.createNotification({
        userId: recipient.userId,
        actorUserId: data.actorUserId,
        type: recipient.type,
        title: data.title ?? `${foodTruck.name} posted an update`,
        message: data.message ?? `New update from ${foodTruck.name}.`,
        foodTruckId: foodTruck.id,
        postId: data.postId,
        actionUrl: `/api/v1/food-trucks/profile/${foodTruck.slug}`,
      });

      if (notification) {
        sentCount += 1;
      }
    }

    return { sentCount };
  }

  notifyBookingCreated(actorUserId: string, booking: any) {
    if (!booking?.vendor?.userId) {
      return null;
    }

    return this.createNotification({
      userId: booking.vendor.userId,
      actorUserId,
      type: 'BOOKING',
      title: 'New booking request',
      message: `New booking request ${booking.bookingNumber} for ${booking.foodTruck?.name ?? 'your truck'}.`,
      foodTruckId: booking.foodTruckId,
      bookingId: booking.id,
      actionUrl: `/api/v1/bookings/${booking.id}`,
    });
  }

  notifyCustomerBookingUpdate(actorUserId: string, booking: any, title: string) {
    return this.createNotification({
      userId: booking.customerId,
      actorUserId,
      type: 'BOOKING',
      title,
      message: `Booking ${booking.bookingNumber} is now ${booking.status}.`,
      foodTruckId: booking.foodTruckId,
      bookingId: booking.id,
      actionUrl: `/api/v1/bookings/${booking.id}`,
    });
  }

  notifyVendorBookingUpdate(actorUserId: string, booking: any, title: string) {
    if (!booking?.vendor?.userId) {
      return null;
    }

    return this.createNotification({
      userId: booking.vendor.userId,
      actorUserId,
      type: 'BOOKING',
      title,
      message: `Booking ${booking.bookingNumber} is now ${booking.status}.`,
      foodTruckId: booking.foodTruckId,
      bookingId: booking.id,
      actionUrl: `/api/v1/bookings/${booking.id}`,
    });
  }

  notifyPaymentUpdate(payment: any, title: string, message: string) {
    return this.createNotification({
      userId: payment.payerUserId,
      type: 'PAYMENT',
      title,
      message,
      bookingId: payment.bookingId,
      actionUrl: `/api/v1/payments/${payment.id}`,
      metadata: { paymentId: payment.id, status: payment.status },
    });
  }

  notifyVendorPaymentUpdate(payment: any, title: string, message: string) {
    if (!payment?.vendor?.userId) {
      return null;
    }

    return this.createNotification({
      userId: payment.vendor.userId,
      type: 'PAYMENT',
      title,
      message,
      bookingId: payment.bookingId,
      actionUrl: `/api/v1/payments/${payment.id}`,
      metadata: { paymentId: payment.id, status: payment.status },
    });
  }

  notifyReward(userId: string, title: string, message: string, metadata?: Record<string, unknown>) {
    return this.createNotification({
      userId,
      type: 'REWARD',
      title,
      message,
      metadata,
    });
  }

  notifyCheckIn(userId: string, checkIn: any) {
    return this.createNotification({
      userId,
      type: 'CHECK_IN',
      title: checkIn.status === 'VERIFIED' ? 'Check-in verified' : 'Check-in update',
      message:
        checkIn.status === 'VERIFIED'
          ? `Your check-in at ${checkIn.foodTruck?.name ?? 'this truck'} was verified.`
          : checkIn.rejectionReason ?? 'Your check-in could not be verified.',
      foodTruckId: checkIn.foodTruckId,
      actionUrl: `/api/v1/food-trucks/profile/${checkIn.foodTruck?.slug ?? ''}`,
      metadata: { checkInId: checkIn.id, status: checkIn.status },
    });
  }

  private isAllowedByPreference(type: string, preferences: any) {
    switch (type) {
      case 'NEARBY_DROP':
      case 'NEW_TRUCK_IN_AREA':
        return preferences.nearbyDropAlerts;
      case 'FOLLOWED_TRUCK_UPDATE':
        return preferences.followedTruckUpdates;
      case 'FAVORITE_TRUCK_UPDATE':
        return preferences.favoriteTruckAlerts;
      case 'PROMOTION':
        return preferences.promotionAlerts;
      case 'BOOKING':
        return preferences.bookingAlerts;
      case 'PAYMENT':
        return preferences.paymentAlerts;
      case 'MESSAGE':
        return preferences.messageAlerts;
      case 'REWARD':
      case 'REFERRAL':
      case 'BADGE':
        return preferences.rewardAlerts;
      case 'CHECK_IN':
        return preferences.checkInAlerts;
      default:
        return true;
    }
  }
}
