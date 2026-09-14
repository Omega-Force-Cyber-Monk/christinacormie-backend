import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetInterestCuisinesDto } from './dto/set-interest-cuisines.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  listInterestCuisines() {
    return this.prisma.cuisine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true,
        pinColor: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const { phone, email, ...profileFields } = dto;

    if (email && email.toLowerCase() !== user.email?.toLowerCase()) {
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: userId },
          deletedAt: null,
        },
      });

      if (existingEmail) {
        throw new ConflictException(
          'Email address is already in use by another account',
        );
      }
    }

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      if (
        phone !== undefined ||
        (email && email.toLowerCase() !== user.email?.toLowerCase())
      ) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(phone !== undefined ? { phone } : {}),
            ...(email ? { email: email.toLowerCase() } : {}),
          },
        });
      }

      const profile = await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...profileFields,
        },
        update: profileFields,
      });

      return {
        ...profile,
        phone: phone !== undefined ? phone : user.phone,
        email: email ? email.toLowerCase() : user.email,
      };
    });

    if (this.isProfileComplete(updatedProfile)) {
      await this.rewardsService.awardPoints(
        userId,
        'PROFILE_COMPLETION',
        userId,
        {
          idempotencyKey: `PROFILE_COMPLETION:${userId}`,
          description: 'Completed profile setup',
        },
      );
    }

    return updatedProfile;
  }

  async uploadProfileAvatar(userId: string, file?: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!file) {
      throw new BadRequestException('Profile photo file is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException(
        'Only image files are allowed for profile photo',
      );
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      throw new BadRequestException('Profile photo must be 5MB or smaller');
    }

    const upload = await this.cloudinaryService.uploadBuffer(file.buffer, {
      folder: `bitedrop/users/${userId}/avatars`,
      resourceType: 'image',
    });

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        avatarUrl: upload.secure_url,
      },
      update: {
        avatarUrl: upload.secure_url,
      },
    });

    return {
      message: 'Profile photo uploaded successfully',
      avatarUrl: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      format: upload.format,
      resourceType: upload.resource_type,
      originalFilename: file.originalname,
      profile,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.ensureUserExists(userId);

    const settings = await this.prisma.userSetting.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: dto,
    });

    return settings;
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    await this.ensureUserExists(userId);

    const existing = await this.prisma.deviceToken.findFirst({
      where: {
        token: dto.token,
      },
    });

    if (existing) {
      return this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          userId,
          platform: dto.platform,
          deviceId: dto.deviceId,
          isActive: true,
        },
      });
    }

    return this.prisma.deviceToken.create({
      data: {
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceId: dto.deviceId,
        isActive: true,
      },
    });
  }

  async removeDeviceToken(userId: string, deviceTokenId: string) {
    await this.ensureUserExists(userId);

    const deviceToken = await this.prisma.deviceToken.findFirst({
      where: {
        id: deviceTokenId,
        userId,
      },
    });

    if (!deviceToken) {
      throw new NotFoundException('Device token not found');
    }

    await this.prisma.deviceToken.update({
      where: { id: deviceTokenId },
      data: {
        isActive: false,
      },
    });

    return {
      removed: true,
    };
  }

  async setInterestCuisines(userId: string, dto: SetInterestCuisinesDto) {
    await this.ensureUserExists(userId);

    const uniqueCuisineIds = [...new Set(dto.cuisineIds)];
    const cuisineCount = await this.prisma.cuisine.count({
      where: {
        id: { in: uniqueCuisineIds },
        isActive: true,
      },
    });

    if (cuisineCount !== uniqueCuisineIds.length) {
      throw new NotFoundException('One or more cuisines were not found');
    }

    await this.prisma.$transaction([
      this.prisma.userCuisineInterest.deleteMany({
        where: { userId },
      }),
      this.prisma.userCuisineInterest.createMany({
        data: uniqueCuisineIds.map((cuisineId) => ({
          userId,
          cuisineId,
        })),
      }),
    ]);

    return this.prisma.user
      .findUnique({
        where: { id: userId },
        include: this.userInclude(),
      })
      .then((user) => {
        if (!user) {
          throw new NotFoundException('User not found');
        }

        return this.toUserResponse(user);
      });
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    await this.ensureUserExists(userId);

    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: dto,
    });

    return preferences;
  }

  async deleteAccountPermanently(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { vendor: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.vendor) {
      throw new BadRequestException(
        'Vendor account deletion is not available from customer settings. Please contact support.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({
        where: {
          OR: [{ userId }, { actorUserId: userId }],
        },
      });
      await tx.notificationPreference.deleteMany({ where: { userId } });

      await tx.postCommentLike.deleteMany({ where: { userId } });
      await tx.postComment.deleteMany({ where: { userId } });
      await tx.postLike.deleteMany({ where: { userId } });
      await tx.savedPost.deleteMany({ where: { userId } });
      await tx.favoriteTruck.deleteMany({ where: { userId } });
      await tx.foodTruckFollow.deleteMany({ where: { userId } });

      await tx.communityRequestReaction.deleteMany({ where: { userId } });
      await tx.communityRequestComment.deleteMany({ where: { userId } });
      await tx.communityPostAction.deleteMany({ where: { userId } });

      await tx.message.deleteMany({ where: { senderId: userId } });
      await tx.conversationParticipant.deleteMany({ where: { userId } });
      await tx.conversation.deleteMany({ where: { createdById: userId } });

      await tx.bookingStatusHistory.updateMany({
        where: { changedById: userId },
        data: { changedById: null },
      });
      await tx.bookingHold.deleteMany({ where: { userId } });

      await tx.reviewReport.deleteMany({
        where: {
          OR: [{ reportedById: userId }, { reviewedById: userId }],
        },
      });
      await tx.review.deleteMany({
        where: {
          OR: [{ customerId: userId }, { moderatedById: userId }],
        },
      });

      await tx.promotionRedemption.deleteMany({ where: { userId } });
      await tx.rewardRedemption.deleteMany({ where: { userId } });
      await tx.loyaltyTransaction.deleteMany({
        where: { loyaltyAccount: { userId } },
      });
      await tx.userBadge.deleteMany({ where: { userId } });
      await tx.loyaltyAccount.deleteMany({ where: { userId } });

      await tx.referralReward.deleteMany({
        where: { beneficiaryUserId: userId },
      });
      await tx.referral.deleteMany({
        where: {
          OR: [{ referrerUserId: userId }, { referredUserId: userId }],
        },
      });
      await tx.referralCode.deleteMany({ where: { ownerUserId: userId } });

      await tx.qrScan.deleteMany({ where: { userId } });
      await tx.checkIn.deleteMany({ where: { userId } });

      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.userCuisineInterest.deleteMany({ where: { userId } });
      await tx.userSetting.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.passwordResetCode.deleteMany({ where: { userId } });
      await tx.emailVerificationCode.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.userRoleAssignment.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    });

    return {
      deleted: true,
      message: 'Account permanently deleted successfully',
    };
  }

  async updateAccountStatus(userId: string, status: AccountStatus) {
    const data: any = {
      status,
      deletedAt: status === AccountStatus.DEACTIVATED ? new Date() : null,
    };

    if (this.shouldRevokeSessions(status)) {
      data.refreshTokens = {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      };
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: this.userInclude(),
    });

    return this.toUserResponse(user);
  }

  private async ensureUserExists(userId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }

  private shouldRevokeSessions(status: AccountStatus): boolean {
    return [
      AccountStatus.SUSPENDED,
      AccountStatus.DEACTIVATED,
      AccountStatus.BLOCKED,
    ].includes(status);
  }

  private isProfileComplete(profile: any) {
    const hasName = Boolean(
      profile.displayName ||
        profile.firstName ||
        `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim(),
    );

    return Boolean(
      hasName &&
        profile.email &&
        profile.dateOfBirth,
    );
  }

  private toUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: (user.userRoles ?? []).map((userRole) => userRole.role),
      profile: user.profile,
      settings: user.settings,
      notificationPreference: user.notificationPreference,
      interestCuisines: (user.cuisineInterests ?? []).map(
        (interest) => interest.cuisine,
      ),
      vendor: user.vendor,
    };
  }

  private userInclude() {
    return {
      userRoles: true,
      profile: true,
      settings: true,
      notificationPreference: true,
      cuisineInterests: {
        include: {
          cuisine: true,
        },
      },
      vendor: true,
    };
  }
}
