import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetInterestCuisinesDto } from './dto/set-interest-cuisines.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.ensureUserExists(userId);

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: dto,
    });

    return profile;
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

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    }).then((user) => {
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

  async deactivateAccount(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.DEACTIVATED,
        deletedAt: new Date(),
        refreshTokens: {
          updateMany: {
            where: { revokedAt: null },
            data: { revokedAt: new Date() },
          },
        },
      },
      include: this.userInclude(),
    });

    return this.toUserResponse(user);
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
      interestCuisines: (user.cuisineInterests ?? []).map((interest) => interest.cuisine),
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
