import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardsRepository } from './leaderboards.repository';

@Injectable()
export class LeaderboardsService {
  constructor(private readonly leaderboardsRepository: LeaderboardsRepository) {}

  getLeaderboards(query: LeaderboardQueryDto) {
    return this.leaderboardsRepository.findLeaderboards(query);
  }

  async getLeaderboardById(
    leaderboardId: string,
    limit?: number,
    offset?: number,
  ) {
    const leaderboard = await this.leaderboardsRepository.findLeaderboardById(
      leaderboardId,
      limit,
      offset,
    );

    if (!leaderboard) {
      throw new NotFoundException('Leaderboard not found');
    }

    return leaderboard;
  }

  async getLeaderboardByType(type: string, query: LeaderboardQueryDto) {
    const leaderboard = await this.leaderboardsRepository.findLeaderboardByType(
      type,
      query,
    );

    if (!leaderboard) {
      throw new NotFoundException(`Leaderboard for type '${type}' not found`);
    }

    return leaderboard;
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
}
