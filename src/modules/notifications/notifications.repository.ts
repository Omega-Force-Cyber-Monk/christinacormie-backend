import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type NotificationInput = {
  userId: string;
  actorUserId?: string;
  type: string;
  title: string;
  message: string;
  foodTruckId?: string;
  bookingId?: string;
  postId?: string;
  conversationId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(
    userId: string,
    options: { unreadOnly?: boolean; limit: number; offset?: number },
  ) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset ?? 0,
      include: {
        foodTruck: {
          select: {
            id: true,
            name: true,
            slug: true,
            profileImageUrl: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  findUserNotification(userId: string, notificationId: string) {
    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
  }

  markRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  findActiveDeviceTokens(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        token: true,
        platform: true,
        deviceId: true,
      },
    });
  }

  deactivateDeviceTokensByValue(tokens: string[]) {
    if (!tokens.length) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.deviceToken.updateMany({
      where: {
        token: { in: tokens },
      },
      data: {
        isActive: false,
      },
    });
  }

  create(data: NotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        actorUserId: data.actorUserId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        foodTruckId: data.foodTruckId,
        bookingId: data.bookingId,
        postId: data.postId,
        conversationId: data.conversationId,
        actionUrl: data.actionUrl,
        metadata: data.metadata as any,
      },
    });
  }

  async findFoodTruckUpdateRecipients(foodTruckId: string, actorUserId: string) {
    const [followers, favorites] = await this.prisma.$transaction([
      this.prisma.foodTruckFollow.findMany({
        where: {
          foodTruckId,
          notificationsEnabled: true,
          userId: { not: actorUserId },
        },
        select: {
          userId: true,
          user: {
            select: { notificationPreference: true },
          },
        },
      }),
      this.prisma.favoriteTruck.findMany({
        where: {
          foodTruckId,
          userId: { not: actorUserId },
        },
        select: {
          userId: true,
          user: {
            select: { notificationPreference: true },
          },
        },
      }),
    ]);

    const recipients = new Map<
      string,
      { userId: string; type: 'FOLLOWED_TRUCK_UPDATE' | 'FAVORITE_TRUCK_UPDATE' }
    >();

    for (const follow of followers) {
      if (follow.user.notificationPreference?.followedTruckUpdates === false) {
        continue;
      }

      recipients.set(follow.userId, {
        userId: follow.userId,
        type: 'FOLLOWED_TRUCK_UPDATE',
      });
    }

    for (const favorite of favorites) {
      if (
        recipients.has(favorite.userId) ||
        favorite.user.notificationPreference?.favoriteTruckAlerts === false
      ) {
        continue;
      }

      recipients.set(favorite.userId, {
        userId: favorite.userId,
        type: 'FAVORITE_TRUCK_UPDATE',
      });
    }

    return Array.from(recipients.values());
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }
}
