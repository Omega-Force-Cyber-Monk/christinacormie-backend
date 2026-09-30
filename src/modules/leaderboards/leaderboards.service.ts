import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardsRepository } from './leaderboards.repository';

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly leaderboardsRepository: LeaderboardsRepository,
  ) {}

  async getLeaderboards(query: LeaderboardQueryDto) {
    const leaderboards =
      await this.leaderboardsRepository.findLeaderboards(query);

    return leaderboards.map((leaderboard) =>
      this.prioritizeCreditAcceptedEntries(leaderboard, query),
    );
  }

  async getLeaderboardById(
    leaderboardId: string,
    limit?: number,
    offset?: number,
  ) {
    const leaderboard = await this.leaderboardsRepository.findLeaderboardById(
      leaderboardId,
    );

    if (!leaderboard) {
      throw new NotFoundException('Leaderboard not found');
    }

    return this.prioritizeCreditAcceptedEntries(leaderboard, {
      limit,
      offset,
    });
  }

  async getLeaderboardByType(type: string, query: LeaderboardQueryDto) {
    const leaderboard = await this.leaderboardsRepository.findLeaderboardByType(
      type,
      query,
    );

    if (!leaderboard) {
      throw new NotFoundException(`Leaderboard for type '${type}' not found`);
    }

    return this.prioritizeCreditAcceptedEntries(leaderboard, query);
  }

  async recalculateLeaderboard(leaderboardId: string) {
    const leaderboard =
      await this.leaderboardsRepository.findLeaderboardById(leaderboardId);

    if (!leaderboard) {
      throw new NotFoundException('Leaderboard not found');
    }

    const rule = leaderboard.rule;
    if (!rule) {
      throw new NotFoundException('Leaderboard rule not found');
    }

    const eligibleTrucks = await this.leaderboardsRepository.findEligibleTrucks(
      leaderboard.marketId ?? undefined,
    );

    const bookingWeight = Number(rule.bookingWeight ?? 0);
    const ratingWeight = Number(rule.ratingWeight ?? 0);
    const reliabilityWeight = Number(rule.reliabilityWeight ?? 0);
    const engagementWeight = Number(rule.engagementWeight ?? 0);
    const checkInWeight = Number(rule.checkInWeight ?? 0);
    const minBookings = rule.minimumCompletedBookings ?? 0;

    const scoredTrucks = eligibleTrucks
      .filter((truck) => truck.totalBookings >= minBookings)
      .map((truck) => {
        const bookingScore = Number(truck.totalBookings) * bookingWeight;
        const ratingScore = Number(truck.averageRating) * ratingWeight;
        const reliabilityScore =
          Number(truck.vendor.reliabilityScore) * reliabilityWeight;
        const engagementScore = Number(truck.followerCount) * engagementWeight;
        const checkInScore = Number(truck.totalCheckIns) * checkInWeight;

        const totalScore =
          bookingScore +
          ratingScore +
          reliabilityScore +
          engagementScore +
          checkInScore;

        return {
          vendorId: truck.vendorId,
          foodTruckId: truck.id,
          score: Math.round(totalScore * 10000) / 10000,
          bookingScore: Math.round(bookingScore * 10000) / 10000,
          ratingScore: Math.round(ratingScore * 10000) / 10000,
          reliabilityScore: Math.round(reliabilityScore * 10000) / 10000,
          engagementScore: Math.round(engagementScore * 10000) / 10000,
          checkInScore: Math.round(checkInScore * 10000) / 10000,
        };
      });

    scoredTrucks.sort((a, b) => b.score - a.score);

    const previousRankMap =
      await this.leaderboardsRepository.findExistingEntriesMap(leaderboardId);

    const entriesData = scoredTrucks.map((item, index) => {
      const rank = index + 1;
      const previousRank = previousRankMap.get(item.foodTruckId) ?? null;

      return {
        vendorId: item.vendorId,
        foodTruckId: item.foodTruckId,
        rank,
        previousRank,
        score: item.score,
        bookingScore: item.bookingScore,
        ratingScore: item.ratingScore,
        reliabilityScore: item.reliabilityScore,
        engagementScore: item.engagementScore,
        checkInScore: item.checkInScore,
      };
    });

    await this.leaderboardsRepository.replaceLeaderboardEntries(
      leaderboardId,
      entriesData,
    );

    return {
      leaderboardId,
      totalEntries: entriesData.length,
      calculatedAt: new Date(),
    };
  }

  async recalculateAllActiveLeaderboards() {
    const leaderboards =
      await this.leaderboardsRepository.findActiveLeaderboards();

    let processed = 0;
    for (const lb of leaderboards) {
      await this.recalculateLeaderboard(lb.id);
      processed++;
    }

    return { processed };
  }

  private prioritizeCreditAcceptedEntries<T extends { entries?: any[] }>(
    leaderboard: T,
    query: Pick<LeaderboardQueryDto, 'limit' | 'offset'>,
  ): T {
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const entries = leaderboard.entries ?? [];

    const sortedEntries = [...entries].sort((a, b) => {
      const aAcceptsCredit = a.vendor?.creditAcceptanceEnabled !== false;
      const bAcceptsCredit = b.vendor?.creditAcceptanceEnabled !== false;

      if (aAcceptsCredit !== bAcceptsCredit) {
        return aAcceptsCredit ? -1 : 1;
      }

      return (
        (a.rank ?? Number.MAX_SAFE_INTEGER) -
        (b.rank ?? Number.MAX_SAFE_INTEGER)
      );
    });

    const paginatedEntries = sortedEntries
      .slice(offset, offset + limit)
      .map((entry, index) => ({
        ...entry,
        originalRank: entry.rank,
        rank: offset + index + 1,
        creditAccepted: entry.vendor?.creditAcceptanceEnabled !== false,
      }));

    return {
      ...leaderboard,
      entries: paginatedEntries,
    };
  }
}
