import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { MessagingPaginationDto } from './dto/messaging-query.dto';
import {
  MessagingMessageTypeDto,
  SendMessageDto,
} from './dto/send-message.dto';
import { MessagingRealtimeService } from './messaging-realtime.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: MessagingRealtimeService,
  ) {}

  async listConversations(userId: string, query: MessagingPaginationDto) {
    const limit = Math.min(query.limit ?? 20, 50);
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: { participants: { some: { userId } } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: this.conversationInclude(userId),
      }),
      this.prisma.conversation.count({
        where: { participants: { some: { userId } } },
      }),
    ]);

    const conversations = await Promise.all(
      items.map((conversation) =>
        this.presentConversation(conversation, userId),
      ),
    );

    return {
      message: 'Conversations retrieved successfully',
      items: conversations,
      total,
      nextOffset: offset + conversations.length < total ? offset + limit : null,
    };
  }

  async getConversation(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: this.conversationInclude(userId),
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      message: 'Conversation retrieved successfully',
      conversation: await this.presentConversation(conversation, userId),
    };
  }

  async createDirectConversation(
    userId: string,
    dto: CreateDirectConversationDto,
  ) {
    const targetUserId = await this.resolveDirectParticipant(dto);

    if (targetUserId === userId) {
      throw new BadRequestException(
        'You cannot start a conversation with yourself',
      );
    }

    await this.ensureUserCanChat(userId);
    await this.ensureUserCanChat(targetUserId, 'Chat recipient not found');

    const existing = await this.findExistingDirectConversation(
      userId,
      targetUserId,
    );

    if (existing) {
      return {
        message: 'Conversation already exists',
        conversation: await this.presentConversation(existing, userId),
      };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userId,
        title: dto.title?.trim() || null,
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: this.conversationInclude(userId),
    });

    return {
      message: 'Conversation created successfully',
      conversation: await this.presentConversation(conversation, userId),
    };
  }

  async createBookingConversation(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNumber: true,
        customerId: true,
        vendor: { select: { userId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const vendorUserId = booking.vendor.userId;
    if (booking.customerId !== userId && vendorUserId !== userId) {
      throw new ForbiddenException('Booking is not visible to this user');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { type: 'BOOKING', bookingId: booking.id },
      include: this.conversationInclude(userId),
    });

    if (existing) {
      return {
        message: 'Conversation already exists',
        conversation: await this.presentConversation(existing, userId),
      };
    }

    const participantIds = [...new Set([booking.customerId, vendorUserId])];
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'BOOKING',
        createdById: userId,
        bookingId: booking.id,
        title: `Booking ${booking.bookingNumber}`,
        participants: {
          create: participantIds.map((participantUserId) => ({
            userId: participantUserId,
          })),
        },
      },
      include: this.conversationInclude(userId),
    });

    return {
      message: 'Conversation created successfully',
      conversation: await this.presentConversation(conversation, userId),
    };
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: MessagingPaginationDto,
  ) {
    await this.ensureParticipant(userId, conversationId);

    const limit = Math.min(query.limit ?? 30, 100);
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: this.messageInclude(),
      }),
      this.prisma.message.count({
        where: { conversationId, deletedAt: null },
      }),
    ]);

    return {
      message: 'Messages retrieved successfully',
      items: items.map((item) => this.presentMessage(item)),
      total,
      nextOffset: offset + items.length < total ? offset + limit : null,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.ensureParticipant(userId, conversationId);

    if (conversation.isClosed) {
      throw new BadRequestException('This conversation is closed');
    }

    const messageType = dto.messageType ?? MessagingMessageTypeDto.TEXT;
    const content = dto.content?.trim();

    if (!content && !dto.attachmentUrl && !dto.vendorOfferId) {
      throw new BadRequestException(
        'Message content, attachmentUrl, or vendorOfferId is required',
      );
    }

    if (messageType === MessagingMessageTypeDto.TEXT && !content) {
      throw new BadRequestException('Text message content is required');
    }

    if (
      [MessagingMessageTypeDto.IMAGE, MessagingMessageTypeDto.FILE].includes(
        messageType,
      ) &&
      !dto.attachmentUrl
    ) {
      throw new BadRequestException(
        'attachmentUrl is required for image or file messages',
      );
    }

    if (messageType === MessagingMessageTypeDto.OFFER && !dto.vendorOfferId) {
      throw new BadRequestException(
        'vendorOfferId is required for offer messages',
      );
    }

    if (dto.vendorOfferId) {
      await this.ensureOfferCanBeShared(dto.vendorOfferId);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          messageType,
          content: content ?? null,
          attachmentUrl: dto.attachmentUrl,
          vendorOfferId: dto.vendorOfferId,
        },
        include: this.messageInclude(),
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });

      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { lastReadAt: created.createdAt },
      });

      return created;
    });

    const presentedMessage = this.presentMessage(message);
    this.realtimeService.emitNewMessage(conversationId, presentedMessage);
    await this.notifyOtherParticipants(conversationId, userId, message);

    return {
      message: 'Message sent successfully',
      item: presentedMessage,
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.ensureParticipant(userId, conversationId);

    const readAt = new Date();
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: readAt },
    });

    this.realtimeService.emitConversationRead(conversationId, {
      conversationId,
      userId,
      readAt: readAt.toISOString(),
    });

    return { message: 'Conversation marked as read' };
  }

  private async resolveDirectParticipant(dto: CreateDirectConversationDto) {
    const suppliedTargets = [
      dto.participantUserId,
      dto.vendorId,
      dto.foodTruckId,
    ].filter(Boolean);

    if (suppliedTargets.length !== 1) {
      throw new BadRequestException(
        'Provide exactly one of participantUserId, vendorId, or foodTruckId',
      );
    }

    if (dto.participantUserId) {
      return dto.participantUserId;
    }

    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, deletedAt: null },
        select: { userId: true },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      return vendor.userId;
    }

    const foodTruck = await this.prisma.foodTruck.findFirst({
      where: { id: dto.foodTruckId, deletedAt: null },
      select: { vendor: { select: { userId: true } } },
    });

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck.vendor.userId;
  }

  private async findExistingDirectConversation(
    userId: string,
    targetUserId: string,
  ) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: 'DIRECT',
        participants: { some: { userId } },
        AND: [{ participants: { some: { userId: targetUserId } } }],
      },
      include: this.conversationInclude(userId),
    });

    return (
      conversations.find(
        (conversation) =>
          conversation.participants.length === 2 &&
          conversation.participants.some((item) => item.userId === userId) &&
          conversation.participants.some(
            (item) => item.userId === targetUserId,
          ),
      ) ?? null
    );
  }

  private async ensureParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { userId, conversationId },
      select: {
        id: true,
        conversation: {
          select: {
            id: true,
            type: true,
            bookingId: true,
            communityRequestId: true,
            isClosed: true,
          },
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Conversation is not visible to this user');
    }

    return participant.conversation;
  }

  private async ensureUserCanChat(
    userId: string,
    notFoundMessage = 'User not found',
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new NotFoundException(notFoundMessage);
    }

    if (['SUSPENDED', 'DEACTIVATED', 'BLOCKED'].includes(user.status)) {
      throw new ForbiddenException('User account cannot use messaging');
    }
  }

  private async ensureOfferCanBeShared(vendorOfferId: string) {
    const offer = await this.prisma.vendorOffer.findUnique({
      where: { id: vendorOfferId },
      select: { id: true },
    });

    if (!offer) {
      throw new NotFoundException('Vendor offer not found');
    }
  }

  private async notifyOtherParticipants(
    conversationId: string,
    senderId: string,
    message: { id: string; content: string | null; messageType: string },
  ) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId }, isMuted: false },
      select: { userId: true },
    });

    for (const participant of participants) {
      try {
        await this.notificationsService.notify({
          userId: participant.userId,
          actorUserId: senderId,
          type: 'MESSAGE',
          title: 'New message',
          message: message.content ?? 'You received a new message.',
          conversationId,
          actionUrl: `/api/v1/messaging/conversations/${conversationId}`,
          metadata: {
            conversationId,
            messageId: message.id,
            messageType: message.messageType,
          },
          pushPreferenceKey: 'messageAlerts',
          pushData: {
            eventType: 'MESSAGE_CREATED',
            conversationId,
            messageId: message.id,
          },
        });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Unknown notification error';
        this.logger.warn(`Failed to notify message recipient: ${detail}`);
      }
    }
  }

  private conversationInclude(currentUserId: string) {
    return {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      },
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          foodTruck: { select: { id: true, name: true, slug: true } },
        },
      },
      communityRequest: { select: { id: true, title: true, status: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: this.messageInclude(),
      },
      _count: {
        select: {
          messages: { where: { deletedAt: null } },
        },
      },
    };
  }

  private messageInclude() {
    return {
      sender: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          vendor: {
            select: {
              id: true,
              businessName: true,
              logoUrl: true,
            },
          },
        },
      },
      vendorOffer: {
        select: {
          id: true,
          status: true,
          quotedAmount: true,
          depositAmount: true,
          paymentPreference: true,
        },
      },
    };
  }

  private async presentConversation(conversation: any, currentUserId: string) {
    const currentParticipant = conversation.participants.find(
      (participant: any) => participant.userId === currentUserId,
    );
    const lastReadAt = currentParticipant?.lastReadAt ?? null;
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        senderId: { not: currentUserId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      bookingId: conversation.bookingId,
      communityRequestId: conversation.communityRequestId,
      isClosed: conversation.isClosed,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      messageCount: conversation._count?.messages ?? 0,
      participants: conversation.participants.map((participant: any) => ({
        id: participant.id,
        userId: participant.userId,
        lastReadAt: participant.lastReadAt,
        isMuted: participant.isMuted,
        user: this.presentUser(participant.user),
      })),
      booking: conversation.booking ?? null,
      communityRequest: conversation.communityRequest ?? null,
      lastMessage: conversation.messages?.[0]
        ? this.presentMessage(conversation.messages[0])
        : null,
    };
  }

  private presentMessage(message: any) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageType: message.messageType,
      content: message.content,
      attachmentUrl: message.attachmentUrl,
      vendorOfferId: message.vendorOfferId,
      vendorOffer: message.vendorOffer ?? null,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      sender: this.presentUser(message.sender),
    };
  }

  private presentUser(user: any) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName:
        user.profile?.displayName ??
        [user.profile?.firstName, user.profile?.lastName]
          .filter(Boolean)
          .join(' ') ??
        null,
      avatarUrl: user.profile?.avatarUrl ?? user.vendor?.logoUrl ?? null,
      vendor: user.vendor
        ? {
            id: user.vendor.id,
            businessName: user.vendor.businessName,
            logoUrl: user.vendor.logoUrl,
          }
        : null,
    };
  }
}
