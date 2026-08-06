import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Injectable()
export class LeaderboardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLeaderboards(query: LeaderboardQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    return this.prisma.leaderboard.findMany({
      where: {
        isActive: true,
        ...(query.marketId ? { marketId: query.marketId } : {}),
        ...(query.period ? { rule: { period: query.period as any } } : {}),
      },
      include: {
        market: { select: this.marketSelect() },
        rule: true,
        entries: {
          orderBy: { rank: 'asc' },
          take: limit,
          skip: offset,
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                status: true,
                isVerified: true,
                reliabilityScore: true,
              },
            },
            foodTruck: {
              select: this.foodTruckBasicSelect(),
            },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  findLeaderboardById(leaderboardId: string, limit = 20, offset = 0) {
    const safeLimit = Math.min(limit, 100);

    return this.prisma.leaderboard.findUnique({
      where: { id: leaderboardId },
      include: {
        market: { select: this.marketSelect() },
        rule: true,
        entries: {
          orderBy: { rank: 'asc' },
          take: safeLimit,
          skip: offset,
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                status: true,
                isVerified: true,
                reliabilityScore: true,
              },
            },
            foodTruck: {
              select: this.foodTruckBasicSelect(),
            },
          },
        },
      },
    });
  }

  findLeaderboardByType(type: string, query: LeaderboardQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;

    return this.prisma.leaderboard.findFirst({
      where: {
        isActive: true,
        rule: {
          type: type as any,
          ...(query.period ? { period: query.period as any } : {}),
        },
        ...(query.marketId ? { marketId: query.marketId } : {}),
      },
      include: {
        market: { select: this.marketSelect() },
        rule: true,
        entries: {
          orderBy: { rank: 'asc' },
          take: limit,
          skip: offset,
          include: {
            vendor: {
              select: {
                id: true,
                businessName: true,
                status: true,
                isVerified: true,
                reliabilityScore: true,
              },
            },
            foodTruck: {
              select: this.foodTruckBasicSelect(),
            },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  findActiveLeaderboards() {
    return this.prisma.leaderboard.findMany({
      where: { isActive: true },
      include: {
        rule: true,
      },
    });
  }

  findActiveRules() {
    return this.prisma.leaderboardRule.findMany({
      where: { isActive: true },
    });
  }

  findEligibleTrucks(marketId?: string) {
    return this.prisma.foodTruck.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(marketId ? { marketId } : {}),
        vendor: {
          status: 'APPROVED',
          deletedAt: null,
        },
      },
      select: {
        id: true,
        vendorId: true,
        marketId: true,
        name: true,
        slug: true,
        averageRating: true,
        totalReviews: true,
        totalBookings: true,
        totalCheckIns: true,
        followerCount: true,
        vendor: {
          select: {
            id: true,
            reliabilityScore: true,
          },
        },
      },
    });
  }

  async findExistingEntriesMap(leaderboardId: string): Promise<Map<string, number>> {
    const existing = await this.prisma.leaderboardEntry.findMany({
      where: { leaderboardId },
      select: { foodTruckId: true, rank: true },
    });

    const rankMap = new Map<string, number>();
    for (const entry of existing) {
      rankMap.set(entry.foodTruckId, entry.rank);
    }
    return rankMap;
  }

  replaceLeaderboardEntries(
    leaderboardId: string,
    entriesData: Array<{
      vendorId: string;
      foodTruckId: string;
      rank: number;
      previousRank: number | null;
      score: number;
      bookingScore: number;
      ratingScore: number;
      reliabilityScore: number;
      engagementScore: number;
      checkInScore: number;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.leaderboardEntry.deleteMany({
        where: { leaderboardId },
      });

      if (entriesData.length > 0) {
        await tx.leaderboardEntry.createMany({
          data: entriesData.map((e) => ({
            leaderboardId,
            vendorId: e.vendorId,
            foodTruckId: e.foodTruckId,
            rank: e.rank,
            previousRank: e.previousRank,
            score: e.score,
            bookingScore: e.bookingScore,
            ratingScore: e.ratingScore,
            reliabilityScore: e.reliabilityScore,
            engagementScore: e.engagementScore,
            checkInScore: e.checkInScore,
          })),
        });
      }

      return tx.leaderboard.update({
        where: { id: leaderboardId },
        data: { calculatedAt: new Date() },
      });
    });
  }

  private marketSelect() {
    return {
      id: true,
      name: true,
      city: true,
      state: true,
      country: true,
      timezone: true,
      operatingRadiusKm: true,
      status: true,
    };
  }

  private foodTruckBasicSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      profileImageUrl: true,
      coverImageUrl: true,
      averageRating: true,
      totalReviews: true,
      totalBookings: true,
      totalCheckIns: true,
      followerCount: true,
    };
  }
}
