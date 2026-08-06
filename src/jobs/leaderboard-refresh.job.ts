import { Injectable, Logger } from '@nestjs/common';
import { LeaderboardsService } from '../modules/leaderboards/leaderboards.service';

@Injectable()
export class LeaderboardRefreshJob {
  private readonly logger = new Logger(LeaderboardRefreshJob.name);

  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  async execute() {
    this.logger.log('Starting leaderboard refresh job...');
    try {
      const result = await this.leaderboardsService.recalculateAllActiveLeaderboards();
      this.logger.log(
        `Leaderboard refresh job completed successfully. Processed ${result.processed} leaderboards.`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error executing leaderboard refresh job', error);
      throw error;
    }
  }
}
