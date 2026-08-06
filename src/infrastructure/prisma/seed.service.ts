import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { PrismaService } from './prisma.service';

const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password123!';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.seedUsers();
    } catch (error) {
      this.logger.error('Failed to run seed service on application bootstrap', error);
    }
  }

  async seedUsers() {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, PASSWORD_SALT_ROUNDS);

    await this.seedCustomer(passwordHash);
    await this.seedVendor(passwordHash);
    await this.seedAdmin(passwordHash);
  }

  private async seedCustomer(passwordHash: string) {
    const email = 'customer@bitedrop.com';
    const existing = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existing) {
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        userRoles: {
          create: [{ role: UserRole.CUSTOMER }],
        },
        profile: {
          create: {
            firstName: 'Demo',
            lastName: 'Customer',
            displayName: 'Demo Customer',
          },
        },
        settings: {
          create: {
            timezone: 'America/New_York',
          },
        },
        notificationPreference: {
          create: {},
        },
      },
    });

    this.logger.log(`Created seed Customer account: ${email}`);
  }

  private async seedVendor(passwordHash: string) {
    const email = 'vendor@bitedrop.com';
    const existing = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existing) {
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        userRoles: {
          create: [{ role: UserRole.VENDOR }],
        },
        profile: {
          create: {
            firstName: 'Demo',
            lastName: 'Vendor',
            displayName: 'Demo Vendor',
          },
        },
        settings: {
          create: {
            timezone: 'America/New_York',
          },
        },
        notificationPreference: {
          create: {},
        },
        vendor: {
          create: {
            businessName: 'Demo Gourmet Bites',
            businessEmail: email,
            description: 'Default demo food truck vendor account',
            status: 'APPROVED',
            isVerified: true,
            verifiedAt: new Date(),
            approvedAt: new Date(),
          },
        },
      },
    });

    this.logger.log(`Created seed Vendor account: ${email}`);
  }

  private async seedAdmin(passwordHash: string) {
    const email = 'admin@bitedrop.com';
    const existing = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existing) {
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        userRoles: {
          create: [{ role: UserRole.ADMIN }],
        },
        profile: {
          create: {
            firstName: 'System',
            lastName: 'Admin',
            displayName: 'System Admin',
          },
        },
        settings: {
          create: {
            timezone: 'America/New_York',
          },
        },
        notificationPreference: {
          create: {},
        },
      },
    });

    this.logger.log(`Created seed Admin account: ${email}`);
  }
}
