import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationEventType } from './enums/notification-event-type.enum';
import {
  NotificationInput,
  NotificationsRepository,
} from './notifications.repository';

type NotifyInput = NotificationInput & {
  pushPreferenceKey?:
    | 'bookingAlerts'
    | 'paymentAlerts'
    | 'followedTruckUpdates'
    | 'favoriteTruckAlerts'
    | 'rewardAlerts'
    | 'checkInAlerts';
  pushData?: Record<string, string>;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly firebaseService: FirebaseService,
  ) {}

  getMyNotifications(userId: string, query: NotificationQueryDto) {
    return this.notificationsRepository.findForUser(userId, {
      unreadOnly: query.unreadOnly,
      limit: Math.min(query.limit ?? 20, 50),
      offset: query.offset ?? 0,
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
    return this.notificationsRepository.create(data);
  }

  async notify(data: NotifyInput) {
    const notification = await this.createNotification(data);
    const preferences = await this.notificationsRepository.getPreferences(data.userId);

    if (
      data.pushPreferenceKey &&
      preferences[data.pushPreferenceKey] === false
    ) {
      return notification;
    }

    const deviceTokens = await this.notificationsRepository.findActiveDeviceTokens(
      data.userId,
    );

    const tokens = deviceTokens.map((token) => token.token);
    const result = await this.firebaseService.sendToTokens(tokens, {
      title: data.title,
      body: data.message,
      data: {
        notificationId: notification.id,
        type: data.type,
        ...(data.pushData ?? {}),
      },
    });

    if (result.invalidTokens.length) {
      await this.notificationsRepository.deactivateDeviceTokensByValue(
        result.invalidTokens,
      );
    }

    return notification;
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
      const notification = await this.notify({
        userId: recipient.userId,
        actorUserId: data.actorUserId,
        type: recipient.type,
        title: data.title ?? `${foodTruck.name} posted an update`,
        message: data.message ?? `New update from ${foodTruck.name}.`,
        foodTruckId: foodTruck.id,
        postId: data.postId,
        actionUrl: `/api/v1/food-trucks/profile/${foodTruck.slug}`,
        metadata: {
          eventType: NotificationEventType.TRUCK_POST_PUBLISHED,
          foodTruckId: foodTruck.id,
          postId: data.postId,
        },
        pushPreferenceKey:
          recipient.type === 'FOLLOWED_TRUCK_UPDATE'
            ? 'followedTruckUpdates'
            : 'favoriteTruckAlerts',
        pushData: {
          eventType: NotificationEventType.TRUCK_POST_PUBLISHED,
          foodTruckId: foodTruck.id,
          postId: data.postId ?? '',
        },
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

    return this.notify({
      userId: booking.vendor.userId,
      actorUserId,
      type: 'BOOKING',
      title: 'New booking request',
      message: `New booking request ${booking.bookingNumber} for ${booking.foodTruck?.name ?? 'your truck'}.`,
      foodTruckId: booking.foodTruckId,
      bookingId: booking.id,
      actionUrl: `/api/v1/bookings/${booking.id}`,
      metadata: {
        eventType: NotificationEventType.BOOKING_CREATED,
        bookingId: booking.id,
        foodTruckId: booking.foodTruckId,
        status: booking.status,
      },
      pushPreferenceKey: 'bookingAlerts',
      pushData: {
        eventType: NotificationEventType.BOOKING_CREATED,
        bookingId: booking.id,
        foodTruckId: booking.foodTruckId,
      },
    });
  }

  notifyCustomerBookingUpdate(
    actorUserId: string,
    booking: any,
    title: string,
    eventType:
      | NotificationEventType.BOOKING_ACCEPTED
      | NotificationEventType.BOOKING_REJECTED
      | NotificationEventType.QUOTE_CREATED,
  ) {
    return this.notify({
      userId: booking.customerId,
      actorUserId,
      type: 'BOOKING',
      title,
      message: `Booking ${booking.bookingNumber} is now ${booking.status}.`,
      foodTruckId: booking.foodTruckId,
      bookingId: booking.id,
      actionUrl: `/api/v1/bookings/${booking.id}`,
      metadata: {
        eventType,
        bookingId: booking.id,
        foodTruckId: booking.foodTruckId,
        status: booking.status,
      },
      pushPreferenceKey: 'bookingAlerts',
      pushData: {
        eventType,
        bookingId: booking.id,
        foodTruckId: booking.foodTruckId,
      },
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

  notifyPaymentUpdate(
    payment: any,
    title: string,
    message: string,
    eventType?:
      | NotificationEventType.PAYMENT_SUCCEEDED
      | NotificationEventType.PAYMENT_FAILED,
  ) {
    const basePayload = {
      userId: payment.payerUserId,
      type: 'PAYMENT',
      title,
      message,
      bookingId: payment.bookingId,
      actionUrl: `/api/v1/payments/${payment.id}`,
      metadata: {
        eventType,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        status: payment.status,
      },
    };

    if (!eventType) {
      return this.createNotification(basePayload);
    }

    return this.notify({
      ...basePayload,
      pushPreferenceKey: 'paymentAlerts',
      pushData: {
        eventType,
        paymentId: payment.id,
        bookingId: payment.bookingId,
      },
    });
  }

  notifyVendorPaymentUpdate(
    payment: any,
    title: string,
    message: string,
    eventType?:
      | NotificationEventType.PAYMENT_SUCCEEDED
      | NotificationEventType.PAYMENT_FAILED,
  ) {
    if (!payment?.vendor?.userId) {
      return null;
    }

    const basePayload = {
      userId: payment.vendor.userId,
      type: 'PAYMENT',
      title,
      message,
      bookingId: payment.bookingId,
      actionUrl: `/api/v1/payments/${payment.id}`,
      metadata: {
        eventType,
        paymentId: payment.id,
        bookingId: payment.bookingId,
        status: payment.status,
      },
    };

    if (!eventType) {
      return this.createNotification(basePayload);
    }

    return this.notify({
      ...basePayload,
      pushPreferenceKey: 'paymentAlerts',
      pushData: {
        eventType,
        paymentId: payment.id,
        bookingId: payment.bookingId,
      },
    });
  }

  notifyReward(userId: string, title: string, message: string, metadata?: Record<string, unknown>) {
    return this.notify({
      userId,
      type: 'REWARD',
      title,
      message,
      metadata: {
        eventType: NotificationEventType.REWARD_EARNED,
        ...(metadata ?? {}),
      },
      pushPreferenceKey: 'rewardAlerts',
      pushData: {
        eventType: NotificationEventType.REWARD_EARNED,
      },
    });
  }

  notifyCheckIn(userId: string, checkIn: any) {
    return this.notify({
      userId,
      type: 'CHECK_IN',
      title: checkIn.status === 'VERIFIED' ? 'Check-in verified' : 'Check-in update',
      message:
        checkIn.status === 'VERIFIED'
          ? `Your check-in at ${checkIn.foodTruck?.name ?? 'this truck'} was verified.`
          : checkIn.rejectionReason ?? 'Your check-in could not be verified.',
      foodTruckId: checkIn.foodTruckId,
      actionUrl: `/api/v1/food-trucks/profile/${checkIn.foodTruck?.slug ?? ''}`,
      metadata: {
        eventType: NotificationEventType.CHECK_IN_VERIFIED,
        checkInId: checkIn.id,
        foodTruckId: checkIn.foodTruckId,
        status: checkIn.status,
      },
      pushPreferenceKey: 'checkInAlerts',
      pushData: {
        eventType: NotificationEventType.CHECK_IN_VERIFIED,
        checkInId: checkIn.id,
        foodTruckId: checkIn.foodTruckId,
      },
    });
  }
}
