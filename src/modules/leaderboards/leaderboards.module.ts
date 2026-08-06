import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsRepository } from './leaderboards.repository';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LeaderboardsController],
  providers: [LeaderboardsService, LeaderboardsRepository],
  exports: [LeaderboardsService],
})
export class LeaderboardsModule {}
