import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { PrismaService } from './prisma.service';

const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Password123!';

const DEMO_TRUCKS = [
  {
    name: 'Burger Bliss',
    slug: 'burger-bliss',
    truckCallName: 'Burger Bliss',
    averageRating: 4.9,
    totalReviews: 1234,
    totalBookings: 2156,
    followerCount: 12400,
    totalCheckIns: 1234,
    profileImageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
  },
  {
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    truckCallName: 'Taco Paradise',
    averageRating: 4.8,
    totalReviews: 2103,
    totalBookings: 2847,
    followerCount: 9800,
    totalCheckIns: 1200,
    profileImageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
  },
  {
    name: 'Pizza Wheels',
    slug: 'pizza-wheels',
    truckCallName: 'Pizza Wheels',
    averageRating: 4.9,
    totalReviews: 892,
    totalBookings: 1923,
    followerCount: 8200,
    totalCheckIns: 1234,
    profileImageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
  },
  {
    name: 'Seoul Street',
    slug: 'seoul-street',
    truckCallName: 'Seoul Street',
    averageRating: 4.7,
    totalReviews: 756,
    totalBookings: 1542,
    followerCount: 6700,
    totalCheckIns: 1000,
    profileImageUrl: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=400',
  },
  {
    name: 'Vegan Vibes',
    slug: 'vegan-vibes',
    truckCallName: 'Vegan Vibes',
    averageRating: 4.6,
    totalReviews: 543,
    totalBookings: 800,
    followerCount: 4300,
    totalCheckIns: 600,
    profileImageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  },
  {
    name: 'BBQ Bros',
    slug: 'bbq-bros',
    truckCallName: 'BBQ Bros',
    averageRating: 4.8,
    totalReviews: 489,
    totalBookings: 1234,
    followerCount: 5000,
    totalCheckIns: 900,
    profileImageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400',
  },
  {
    name: 'Sushi Roll',
    slug: 'sushi-roll',
    truckCallName: 'Sushi Roll',
    averageRating: 4.5,
    totalReviews: 621,
    totalBookings: 900,
    followerCount: 5900,
    totalCheckIns: 900,
    profileImageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400',
  },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.seedUsers();
      await this.seedLeaderboardsAndFoodTrucks();
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

  private async seedLeaderboardsAndFoodTrucks() {
    const defaultVendor = await this.prisma.vendor.findFirst();
    if (!defaultVendor) {
      return;
    }

    const createdTrucks: Array<{ id: string; vendorId: string }> = [];

    for (const item of DEMO_TRUCKS) {
      const truck = await this.prisma.foodTruck.upsert({
        where: { slug: item.slug },
        create: {
          vendorId: defaultVendor.id,
          name: item.name,
          slug: item.slug,
          truckCallName: item.truckCallName,
          description: `Top rated ${item.name} gourmet food truck`,
          status: 'ACTIVE',
          operatingStatus: 'OPEN',
          averageRating: item.averageRating,
          totalReviews: item.totalReviews,
          totalBookings: item.totalBookings,
          followerCount: item.followerCount,
          totalCheckIns: item.totalCheckIns,
          profileImageUrl: item.profileImageUrl,
          coverImageUrl: item.profileImageUrl,
        },
        update: {
          averageRating: item.averageRating,
          totalReviews: item.totalReviews,
          totalBookings: item.totalBookings,
          followerCount: item.followerCount,
          totalCheckIns: item.totalCheckIns,
          profileImageUrl: item.profileImageUrl,
        },
      });

      createdTrucks.push({ id: truck.id, vendorId: defaultVendor.id });
    }

    const leaderboardTypes = [
      { type: 'TOP_RATED', title: 'Top Rated Food Trucks' },
      { type: 'MOST_BOOKED', title: 'Most Booked Food Trucks' },
      { type: 'MOST_VISITED', title: 'Most Visited Food Trucks' },
      { type: 'TRENDING', title: 'Trending Food Trucks' },
      { type: 'RISING', title: 'Rising Food Trucks' },
    ] as const;

    for (const lbType of leaderboardTypes) {
      let rule = await this.prisma.leaderboardRule.findFirst({
        where: { type: lbType.type as any },
      });

      if (!rule) {
        rule = await this.prisma.leaderboardRule.create({
          data: {
            type: lbType.type as any,
            period: 'MONTHLY',
            bookingWeight: 1.0,
            ratingWeight: 1.0,
            reliabilityWeight: 1.0,
            engagementWeight: 1.0,
            checkInWeight: 1.0,
            algorithmVersion: '1.0',
            isActive: true,
          },
        });
      }

      let leaderboard = await this.prisma.leaderboard.findFirst({
        where: { ruleId: rule.id, isActive: true },
      });

      if (!leaderboard) {
        leaderboard = await this.prisma.leaderboard.create({
          data: {
            ruleId: rule.id,
            title: lbType.title,
            startsAt: new Date('2026-08-01'),
            endsAt: new Date('2026-08-31'),
            isActive: true,
            calculatedAt: new Date(),
          },
        });
      }

      const existingEntriesCount = await this.prisma.leaderboardEntry.count({
        where: { leaderboardId: leaderboard.id },
      });

      if (existingEntriesCount === 0) {
        const entriesData = createdTrucks.map((truck, idx) => ({
          leaderboardId: leaderboard.id,
          vendorId: truck.vendorId,
          foodTruckId: truck.id,
          rank: idx + 1,
          previousRank: idx + 1,
          score: 100 - idx * 5,
        }));

        await this.prisma.leaderboardEntry.createMany({
          data: entriesData,
        });
      }
    }

    this.logger.log('Seeded demo Food Trucks and Leaderboards successfully');
  }
}
