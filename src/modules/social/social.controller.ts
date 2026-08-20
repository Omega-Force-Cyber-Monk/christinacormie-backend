import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CommentPostDto } from './dto/comment-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ExploreFeedQueryDto } from './dto/explore-feed-query.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { ToggleFollowNotificationsDto } from './dto/toggle-follow-notifications.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SocialService } from './social.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('api/v1/social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @ApiOperation({ summary: 'Follow a food truck' })
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/follow')
  followFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.followFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Unfollow a food truck' })
  @UseGuards(JwtAuthGuard)
  @Delete('food-trucks/:foodTruckId/follow')
  unfollowFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.unfollowFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Enable or disable push notifications for a followed food truck' })
  @UseGuards(JwtAuthGuard)
  @Patch('food-trucks/:foodTruckId/follow/notifications')
  updateFollowNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
    @Body() dto: ToggleFollowNotificationsDto,
  ) {
    return this.socialService.updateFollowNotifications(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Add a food truck to favorites' })
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/favorite')
  favoriteFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.favoriteFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Remove a food truck from favorites' })
  @UseGuards(JwtAuthGuard)
  @Delete('food-trucks/:foodTruckId/favorite')
  unfavoriteFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.unfavoriteFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Create a social post for a food truck (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('posts')
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.socialService.createPost(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update a social post (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('posts/:postId')
  updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.socialService.updatePost(user.sub, postId, dto);
  }

  @ApiOperation({ summary: 'Delete a social post (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Delete('posts/:postId')
  deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.deletePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Like or toggle like on a post' })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/like')
  likePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.likePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Get comments and 1-level replies for a post' })
  @UseGuards(JwtAuthGuard)
  @Get('posts/:postId/comments')
  getCommentsForPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.socialService.getCommentsForPost(user.sub, postId, query);
  }

  @ApiOperation({ summary: 'Comment on a post or reply to an existing comment (1-level nested)' })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  commentOnPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
    @Body() dto: CommentPostDto,
  ) {
    return this.socialService.commentOnPost(user.sub, postId, dto);
  }

  @ApiOperation({ summary: 'Like or toggle like on a comment' })
  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentId/like')
  likeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId') commentId: string,
  ) {
    return this.socialService.likeComment(user.sub, commentId);
  }

  @ApiOperation({ summary: 'Share a post (increments share count and returns deep link)' })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/share')
  sharePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.sharePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Bookmark / save a post' })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/save')
  savePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.savePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Get personalized social feed from followed food trucks (Following Tab)' })
  @UseGuards(JwtAuthGuard)
  @Get('feed/following')
  getFollowedFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedQueryDto,
  ) {
    return this.socialService.getFollowedFeed(user.sub, query);
  }

  @ApiOperation({ summary: 'Get explore social feed across all food trucks (Explore Tab - Newest & Trending)' })
  @UseGuards(JwtAuthGuard)
  @Get('feed/explore')
  getExploreFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExploreFeedQueryDto,
  ) {
    return this.socialService.getExploreFeed(user.sub, query);
  }
}
