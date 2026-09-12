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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { GetFavoritesQueryDto } from './dto/get-favorites-query.dto';
import { SocialService } from './social.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const unauthorizedExample = errorExample(401, 'Unauthorized', 'Unauthorized');
const forbiddenRoleExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const vendorApprovalErrorExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);
const unavailableFoodTruckExample = errorExample(
  403,
  'Food truck is not available',
  'Forbidden',
);

const followExample = {
  id: 'follow-id',
  userId: 'customer-user-id',
  foodTruckId: 'food-truck-id',
  notificationsEnabled: true,
  createdAt: '2026-09-08T06:00:00.000Z',
};

const favoriteExample = {
  id: 'favorite-id',
  userId: 'customer-user-id',
  foodTruckId: 'food-truck-id',
  createdAt: '2026-09-08T06:00:00.000Z',
};

const favoriteListExample = {
  totalCount: 1,
  openCount: 1,
  closedCount: 0,
  items: [
    {
      id: 'food-truck-id',
      name: 'Taco Paradise',
      slug: 'taco-paradise',
      profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
      coverImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise-cover.jpg',
      cuisine: 'Mexican',
      averageRating: 4.8,
      totalReviews: 102,
      distance: '0.3 mi',
      distanceKm: 0.48,
      distanceMiles: 0.3,
      isOpen: true,
      operatingStatus: 'OPEN',
      statusText: 'Open till 09pm',
      isFavorite: true,
      followedSince: 'Following since today',
      followedAt: '2026-09-08T06:00:00.000Z',
    },
  ],
};

const postExample = {
  id: 'post-id',
  vendorId: 'vendor-id',
  foodTruckId: 'food-truck-id',
  content:
    'Fresh tacos ready at Downtown Plaza! Come visit us today for 20% off all combos.',
  status: 'PUBLISHED',
  isPromotion: true,
  isFollowerOnly: false,
  likeCount: 12,
  commentCount: 3,
  shareCount: 4,
  saveCount: 2,
  publishedAt: '2026-09-08T06:00:00.000Z',
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  media: [
    {
      id: 'media-id',
      postId: 'post-id',
      mediaType: 'IMAGE',
      mediaUrl: 'https://cdn.bitedrop.com/posts/taco-special.jpg',
      sortOrder: 0,
    },
  ],
  vendor: {
    id: 'vendor-id',
    businessName: 'Taco Paradise',
    logoUrl: 'https://cdn.bitedrop.com/vendors/taco-paradise-logo.png',
    isVerified: true,
  },
  foodTruck: {
    id: 'food-truck-id',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
    operatingStatus: 'OPEN',
  },
};

const feedExample = {
  items: [
    {
      ...postExample,
      isLiked: true,
      isSaved: false,
    },
  ],
  nextCursor: null,
};

const commentExample = {
  id: 'comment-id',
  postId: 'post-id',
  parentCommentId: null,
  content: 'Looks delicious! Will definitely visit today.',
  likeCount: 1,
  isLiked: false,
  createdAt: '2026-09-08T06:05:00.000Z',
  author: {
    id: 'customer-user-id',
    displayName: 'Alex Rivera',
    avatarUrl: 'https://cdn.bitedrop.com/users/alex.jpg',
  },
};

const commentsExample = {
  totalCount: 1,
  comments: [
    {
      ...commentExample,
      replies: [
        {
          id: 'reply-id',
          postId: 'post-id',
          parentCommentId: 'comment-id',
          content: 'See you there!',
          likeCount: 0,
          isLiked: false,
          createdAt: '2026-09-08T06:10:00.000Z',
          author: {
            id: 'vendor-user-id',
            displayName: 'Taco Paradise',
            avatarUrl:
              'https://cdn.bitedrop.com/vendors/taco-paradise-logo.png',
          },
        },
      ],
    },
  ],
};

const likeCommentExample = {
  liked: true,
  likeCount: 2,
};

const sharePostExample = {
  success: true,
  postId: 'post-id',
  shareCount: 5,
  shareUrl: '/api/v1/food-trucks/profile/taco-paradise/posts/post-id',
  shareText: 'Fresh tacos ready at Downtown Plaza!',
};

@ApiTags('Social')
@ApiBearerAuth()
@Controller('api/v1/social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @ApiOperation({ summary: 'Follow a food truck' })
  @ApiResponse({
    status: 201,
    description:
      'Food truck followed successfully. If already followed, existing follow is returned.',
    schema: { example: followExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck is inactive or vendor is not approved/verified.',
    schema: { example: unavailableFoodTruckExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/follow')
  followFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.followFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Unfollow a food truck' })
  @ApiResponse({
    status: 200,
    description:
      'Food truck unfollow request completed. Returns false if user was not following it.',
    schema: { example: { unfollowed: true } },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck is inactive or vendor is not approved/verified.',
    schema: { example: unavailableFoodTruckExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Delete('food-trucks/:foodTruckId/follow')
  unfollowFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.unfollowFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({
    summary: 'Enable or disable push notifications for a followed food truck',
  })
  @ApiResponse({
    status: 200,
    description: 'Follow notification preference updated successfully.',
    schema: {
      example: {
        ...followExample,
        notificationsEnabled: false,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['notificationsEnabled must be a boolean value'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description: 'User is not following this food truck.',
    schema: {
      example: errorExample(404, 'Food truck follow not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 201,
    description:
      'Food truck added to favorites. If already favorited, existing favorite is returned.',
    schema: { example: favoriteExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck is inactive or vendor is not approved/verified.',
    schema: { example: unavailableFoodTruckExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/favorite')
  favoriteFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.favoriteFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({ summary: 'Remove a food truck from favorites' })
  @ApiResponse({
    status: 200,
    description:
      'Food truck unfavorite request completed. Returns false if it was not favorited.',
    schema: { example: { unfavorited: true } },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck is inactive or vendor is not approved/verified.',
    schema: { example: unavailableFoodTruckExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Delete('food-trucks/:foodTruckId/favorite')
  unfavoriteFoodTruck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.socialService.unfavoriteFoodTruck(user.sub, foodTruckId);
  }

  @ApiOperation({
    summary: 'Get all favorite food trucks with open counts and filters',
  })
  @ApiResponse({
    status: 200,
    description:
      'Favorite and followed food trucks returned with open/closed counts.',
    schema: { example: favoriteListExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['tab must be one of the following values: ALL, OPEN, CLOSED'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getFavorites(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFavoritesQueryDto,
  ) {
    return this.socialService.getFavorites(user.sub, query);
  }

  @ApiOperation({ summary: 'Create a social post for a food truck (Vendor)' })
  @ApiResponse({
    status: 201,
    description:
      'Social post created successfully. Published posts also notify followers.',
    schema: { example: postExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(400, ['foodTruckId must be a UUID'], 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing/not approved, or food truck belongs to another vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Social post updated successfully.',
    schema: {
      example: {
        ...postExample,
        content: 'Updated post content with new taco specials!',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['status must be one of the following values: DRAFT, PUBLISHED'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing/not approved, or post belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Post does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Post was not found.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Social post deleted successfully.',
    schema: { example: { deleted: true } },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing/not approved, or post belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Post does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Post was not found.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description:
      'Post liked successfully. If already liked, existing like is returned.',
    schema: {
      example: {
        id: 'post-like-id',
        postId: 'post-id',
        userId: 'customer-user-id',
        createdAt: '2026-09-08T06:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Post was not found or is not visible to the authenticated user.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/like')
  likePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.likePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Get comments and 1-level replies for a post' })
  @ApiResponse({
    status: 200,
    description: 'Comments and one-level replies returned successfully.',
    schema: { example: commentsExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be greater than 50'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Post was not found or is not visible to the authenticated user.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Get('posts/:postId/comments')
  getCommentsForPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.socialService.getCommentsForPost(user.sub, postId, query);
  }

  @ApiOperation({
    summary:
      'Comment on a post or reply to an existing comment (1-level nested)',
  })
  @ApiResponse({
    status: 201,
    description: 'Comment created successfully.',
    schema: { example: commentExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(400, ['content must be a string'], 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Post was not found, post is not visible, or parent comment was not found.',
    schema: {
      example: errorExample(404, 'Parent comment not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Comment like toggled successfully.',
    schema: { example: likeCommentExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Comment was not found, related post was not found, or post is not visible.',
    schema: { example: errorExample(404, 'Comment not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentId/like')
  likeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId') commentId: string,
  ) {
    return this.socialService.likeComment(user.sub, commentId);
  }

  @ApiOperation({
    summary: 'Share a post (increments share count and returns deep link)',
  })
  @ApiResponse({
    status: 201,
    description: 'Post shared successfully and share count incremented.',
    schema: { example: sharePostExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Post was not found or is not visible to the authenticated user.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/share')
  sharePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.sharePost(user.sub, postId);
  }

  @ApiOperation({ summary: 'Bookmark / save a post' })
  @ApiResponse({
    status: 201,
    description: 'Post save toggled successfully.',
    schema: { example: { saved: true } },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description:
      'Post was not found or is not visible to the authenticated user.',
    schema: { example: errorExample(404, 'Post not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/save')
  savePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId') postId: string,
  ) {
    return this.socialService.savePost(user.sub, postId);
  }

  @ApiOperation({
    summary:
      'Get personalized social feed from followed food trucks (Following Tab)',
  })
  @ApiResponse({
    status: 200,
    description: 'Following feed returned successfully.',
    schema: { example: feedExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be greater than 100'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('feed/following')
  getFollowedFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FeedQueryDto,
  ) {
    return this.socialService.getFollowedFeed(user.sub, query);
  }

  @ApiOperation({
    summary:
      'Get explore social feed across all food trucks (Explore Tab - Newest & Trending)',
  })
  @ApiResponse({
    status: 200,
    description: 'Explore feed returned successfully.',
    schema: { example: feedExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['sortBy must be one of the following values: newest, trending'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('feed/explore')
  getExploreFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExploreFeedQueryDto,
  ) {
    return this.socialService.getExploreFeed(user.sub, query);
  }
}
