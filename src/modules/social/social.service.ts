import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommentPostDto } from './dto/comment-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ExploreFeedQueryDto } from './dto/explore-feed-query.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { ToggleFollowNotificationsDto } from './dto/toggle-follow-notifications.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { GetFavoritesQueryDto } from './dto/get-favorites-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { SocialRepository } from './social.repository';
import { ProfileSocialQueryDto } from './dto/profile-social-query.dto';
import { CreatePlaceDto, UpdatePlaceDto } from './dto/place.dto';
import { PlaceQueryDto } from './dto/place-query.dto';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';

@Injectable()
export class SocialService {
  private readonly vendorApprovalMessage =
    'Vendor onboarding must be completed before using this vendor feature.';
  private readonly truckSetupMessage =
    'Complete your food truck setup before publishing posts';

  constructor(
    private readonly socialRepository: SocialRepository,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async followFoodTruck(userId: string, foodTruckId: string) {
    const foodTruck = await this.ensureFoodTruckExists(foodTruckId);
    if (
      await this.socialRepository.hasBlockBetween(
        userId,
        foodTruck.vendor.userId,
      )
    ) {
      throw new ForbiddenException('This account cannot be followed');
    }
    const existing = await this.socialRepository.findFollow(
      userId,
      foodTruckId,
    );

    if (existing) {
      return existing;
    }

    const follow = await this.socialRepository.followFoodTruck(
      userId,
      foodTruckId,
    );
    if (foodTruck.vendor.userId !== userId) {
      await this.socialRepository.followUser(userId, foodTruck.vendor.userId);
    }

    await this.rewardsService.awardPoints(userId, 'FOLLOW_TRUCK', foodTruckId, {
      idempotencyKey: `FOLLOW_TRUCK:${userId}:${foodTruckId}`,
      description: 'Followed a food truck',
    });

    return follow;
  }

  async unfollowFoodTruck(userId: string, foodTruckId: string) {
    const foodTruck = await this.ensureFoodTruckExists(foodTruckId);
    const follow = await this.socialRepository.unfollowFoodTruck(
      userId,
      foodTruckId,
    );
    await this.socialRepository.unfollowUser(userId, foodTruck.vendor.userId);

    return {
      unfollowed: Boolean(follow),
    };
  }

  async updateFollowNotifications(
    userId: string,
    foodTruckId: string,
    dto: ToggleFollowNotificationsDto,
  ) {
    const follow = await this.socialRepository.findFollow(userId, foodTruckId);

    if (!follow) {
      throw new NotFoundException('Food truck follow not found');
    }

    return this.socialRepository.updateFollowNotifications(
      userId,
      foodTruckId,
      dto,
    );
  }

  async favoriteFoodTruck(userId: string, foodTruckId: string) {
    await this.ensureFoodTruckExists(foodTruckId);
    return this.socialRepository.favoriteFoodTruck(userId, foodTruckId);
  }

  async unfavoriteFoodTruck(userId: string, foodTruckId: string) {
    await this.ensureFoodTruckExists(foodTruckId);
    const favorite = await this.socialRepository.unfavoriteFoodTruck(
      userId,
      foodTruckId,
    );

    return {
      unfavorited: Boolean(favorite),
    };
  }

  getFavorites(userId: string, query: GetFavoritesQueryDto) {
    return this.socialRepository.getFavorites(userId, query);
  }

  async uploadPostMedia(userId: string, files: Express.Multer.File[]) {
    if (!files?.length)
      throw new BadRequestException('Select at least one image');
    if (files.length > 10)
      throw new BadRequestException('You can upload at most 10 images');
    for (const file of files) {
      const buffer = file.buffer;
      const validJpeg =
        file.mimetype === 'image/jpeg' &&
        buffer?.[0] === 0xff &&
        buffer?.[1] === 0xd8 &&
        buffer?.[2] === 0xff;
      const validPng =
        file.mimetype === 'image/png' &&
        buffer
          ?.subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!validJpeg && !validPng) {
        throw new BadRequestException(
          'Only valid JPG and PNG images are accepted',
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException('Each image must be 10 MB or smaller');
      }
    }
    if (!this.cloudinary.isConfigured()) {
      throw new ServiceUnavailableException(
        'Social uploads are not configured',
      );
    }
    const media = await Promise.all(
      files.map(async (file, sortOrder) => {
        const uploaded = await this.cloudinary.uploadBuffer(file.buffer, {
          folder: `bitedrop/social/${userId}`,
          resourceType: 'image',
        });
        return {
          mediaType: 'IMAGE',
          mediaUrl: uploaded.secure_url,
          sortOrder,
        };
      }),
    );
    return { media };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    this.ensurePostHasContent(dto.content, dto.media);
    const identity = await this.resolvePostIdentity(userId, dto.foodTruckId);
    if ((dto.status ?? 'PUBLISHED') === 'PUBLISHED' && identity.foodTruckId) {
      await this.ensureActivePostFoodTruck(identity.foodTruckId);
    }
    await this.validatePostRelations(userId, dto.locationId, dto.taggedUserIds);
    const post = await this.socialRepository.createPost(userId, identity, dto);

    if (post.status === 'PUBLISHED' && identity.foodTruckId) {
      await this.notificationsService.notifyFoodTruckUpdate({
        actorUserId: userId,
        foodTruckId: identity.foodTruckId,
        postId: post.id,
      });
    }

    if (post.status === 'PUBLISHED') {
      await this.notifyTaggedUsers(userId, post.id, dto.taggedUserIds ?? []);
    }

    return post;
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
    const existing = await this.ensureOwnPost(userId, postId);
    if (dto.status === 'PUBLISHED' && existing.foodTruckId) {
      await this.ensureActivePostFoodTruck(existing.foodTruckId);
    }
    await this.validatePostRelations(userId, dto.locationId, dto.taggedUserIds);
    if (dto.content !== undefined || dto.media !== undefined) {
      this.ensurePostHasContent(
        dto.content ?? existing.content,
        dto.media ?? existing.media,
      );
    }
    const post = await this.socialRepository.updatePost(postId, dto);
    const becamePublished =
      existing.status !== 'PUBLISHED' && dto.status === 'PUBLISHED';
    if (becamePublished) {
      await this.notifyTaggedUsers(
        userId,
        postId,
        dto.taggedUserIds ?? existing.tags.map((tag: any) => tag.taggedUserId),
      );
    } else if (existing.status === 'PUBLISHED' && dto.taggedUserIds) {
      const previousIds = new Set(
        existing.tags.map((tag: any) => tag.taggedUserId),
      );
      await this.notifyTaggedUsers(
        userId,
        postId,
        dto.taggedUserIds.filter((id) => !previousIds.has(id)),
      );
    }
    return post;
  }

  async deletePost(userId: string, postId: string) {
    await this.ensureOwnPost(userId, postId);
    await this.socialRepository.deletePost(postId);

    return {
      deleted: true,
    };
  }

  async likePost(userId: string, postId: string) {
    await this.ensureVisiblePost(userId, postId);
    return this.socialRepository.likePost(postId, userId);
  }

  async commentOnPost(userId: string, postId: string, dto: CommentPostDto) {
    await this.ensureVisiblePost(userId, postId);

    if (dto.parentCommentId) {
      const parentComment = await this.socialRepository.findCommentById(
        dto.parentCommentId,
      );

      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    return this.socialRepository.commentOnPost(postId, userId, dto);
  }

  async getCommentsForPost(
    userId: string | undefined,
    postId: string,
    query: GetCommentsQueryDto,
  ) {
    if (userId) {
      await this.ensureVisiblePost(userId, postId);
    }
    return this.socialRepository.findCommentsForPost(postId, userId, query);
  }

  async likeComment(userId: string, commentId: string) {
    const comment = await this.socialRepository.findCommentById(commentId);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.ensureVisiblePost(userId, comment.postId);
    return this.socialRepository.likeComment(commentId, userId);
  }

  async sharePost(userId: string | undefined, postId: string) {
    if (userId) {
      await this.ensureVisiblePost(userId, postId);
    }

    const post = await this.socialRepository.sharePost(postId);

    return {
      success: true,
      postId: post.id,
      shareCount: post.shareCount,
      shareUrl: `/api/v1/social/posts/${post.id}`,
      shareText:
        post.content.length > 80
          ? `${post.content.slice(0, 77)}...`
          : post.content,
    };
  }

  async savePost(userId: string, postId: string) {
    await this.ensureVisiblePost(userId, postId);
    return this.socialRepository.savePost(postId, userId);
  }

  async getFollowedFeed(userId: string, dto: FeedQueryDto) {
    const limit = dto.limit ?? 20;
    const posts = await this.socialRepository.findFollowedFeed(userId, dto);
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    return {
      items: items.map((post: any) => this.presentPost(post)),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async getExploreFeed(userId: string | undefined, dto: ExploreFeedQueryDto) {
    const limit = dto.limit ?? 20;
    const posts = await this.socialRepository.findExploreFeed(userId, dto);
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    return {
      items: items.map((post: any) => this.presentPost(post)),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async getMyPosts(userId: string, dto: FeedQueryDto) {
    const limit = dto.limit ?? 20;
    const posts = await this.socialRepository.findMyPosts(userId, dto);
    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    return {
      items: items.map((post: any) => this.presentPost(post)),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async getPublicProfile(userId: string, viewerUserId?: string) {
    const profile = await this.socialRepository.findPublicProfile(
      userId,
      viewerUserId,
    );
    if (!profile) throw new NotFoundException('Profile not found');
    return this.presentPublicProfile(profile);
  }

  async followUser(userId: string, targetUserId: string) {
    await this.ensureActiveTarget(userId, targetUserId);
    if (await this.socialRepository.hasBlockBetween(userId, targetUserId)) {
      throw new ForbiddenException('This account cannot be followed');
    }
    return this.socialRepository.followUser(userId, targetUserId);
  }

  async unfollowUser(userId: string, targetUserId: string) {
    const result = await this.socialRepository.unfollowUser(
      userId,
      targetUserId,
    );
    return { unfollowed: result.count > 0 };
  }

  async blockUser(userId: string, targetUserId: string) {
    await this.ensureActiveTarget(userId, targetUserId);
    const block = await this.socialRepository.blockUser(userId, targetUserId);
    await this.socialRepository.unfollowUser(userId, targetUserId);
    await this.socialRepository.unfollowUser(targetUserId, userId);
    return block;
  }

  async unblockUser(userId: string, targetUserId: string) {
    const result = await this.socialRepository.unblockUser(
      userId,
      targetUserId,
    );
    return { unblocked: result.count > 0 };
  }

  async listFollowers(
    profileUserId: string,
    viewerUserId: string,
    direction: 'followers' | 'following',
    query: ProfileSocialQueryDto,
  ) {
    await this.getPublicProfile(profileUserId);
    const result = await this.socialRepository.listFollowers(
      profileUserId,
      viewerUserId,
      direction,
      query,
    );
    return {
      ...result,
      items: result.items.map((item: any) => ({
        followedAt: item.createdAt,
        ...this.presentUser(item.follower ?? item.followed),
        isFollowing: Boolean(
          (item.follower ?? item.followed)?.followers?.length,
        ),
      })),
      nextOffset:
        result.offset + result.items.length < result.total
          ? result.offset + result.limit
          : null,
    };
  }

  getProfilePosts(
    profileUserId: string,
    viewerUserId: string,
    tab: 'posts' | 'tagged',
    query: FeedQueryDto,
  ) {
    return this.paginatePosts(
      tab === 'tagged'
        ? this.socialRepository.findTaggedPosts(
            profileUserId,
            viewerUserId,
            query,
          )
        : this.socialRepository.findAuthoredPosts(
            profileUserId,
            viewerUserId,
            query,
          ),
      query,
    );
  }

  async getPostDetail(userId: string, postId: string) {
    const post = await this.socialRepository.findPostDetail(postId, userId);
    if (!post) throw new NotFoundException('Post not found');
    return this.presentPost(post);
  }

  listPlaces(query: PlaceQueryDto, includeInactive = false) {
    return this.socialRepository.listPlaces(query, includeInactive);
  }

  createPlace(dto: CreatePlaceDto) {
    return this.socialRepository.createPlace(dto);
  }

  async updatePlace(placeId: string, dto: UpdatePlaceDto) {
    try {
      return await this.socialRepository.updatePlace(placeId, dto);
    } catch {
      throw new NotFoundException('Place not found');
    }
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck =
      await this.socialRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (
      foodTruck.status !== 'ACTIVE' ||
      foodTruck.vendor.deletedAt ||
      (foodTruck.vendor.status !== 'APPROVED' &&
        foodTruck.vendor.status !== 'PENDING_APPROVAL')
    ) {
      throw new ForbiddenException('Food truck is not available');
    }

    return foodTruck;
  }

  private async ensureActivePostFoodTruck(foodTruckId: string) {
    const foodTruck =
      await this.socialRepository.findFoodTruckById(foodTruckId);

    if (
      !foodTruck ||
      foodTruck.deletedAt ||
      foodTruck.status !== 'ACTIVE' ||
      foodTruck.vendor.deletedAt ||
      !['APPROVED', 'PENDING_APPROVAL'].includes(foodTruck.vendor.status)
    ) {
      throw new ForbiddenException(this.truckSetupMessage);
    }

    return foodTruck;
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.socialRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' && vendor.status !== 'PENDING_APPROVAL') {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    const foodTruck = await this.ensureFoodTruckExists(foodTruckId);

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    return vendor;
  }

  private async ensureOwnPost(userId: string, postId: string) {
    const post = await this.socialRepository.findPostById(postId);

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorUserId !== userId) {
      throw new ForbiddenException('Post does not belong to this user');
    }

    return post;
  }

  private async ensureVisiblePost(userId: string, postId: string) {
    const post = await this.socialRepository.findVisiblePost(postId, userId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private ensurePostHasContent(
    content?: string | null,
    media?: Array<unknown> | null,
  ) {
    if (!content?.trim() && !media?.length) {
      throw new BadRequestException(
        'Post content or at least one image is required',
      );
    }
  }

  private async resolvePostIdentity(
    userId: string,
    requestedFoodTruckId?: string,
  ) {
    const user = await this.socialRepository.findAuthorIdentity(userId);
    if (!user) throw new ForbiddenException('Active account is required');
    const isVendor = user.userRoles.some((item) => item.role === 'VENDOR');
    if (!isVendor) {
      if (requestedFoodTruckId) {
        throw new ForbiddenException('Customers cannot post as a food truck');
      }
      return {};
    }
    if (
      !user.vendor ||
      !['APPROVED', 'PENDING_APPROVAL'].includes(user.vendor.status)
    ) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }
    if (user.vendor.foodTrucks.length !== 1) {
      throw new ConflictException('Vendor must have exactly one food truck');
    }
    const foodTruck = user.vendor.foodTrucks[0];
    if (requestedFoodTruckId && requestedFoodTruckId !== foodTruck.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }
    return { vendorId: user.vendor.id, foodTruckId: foodTruck.id };
  }

  private async validatePostRelations(
    authorUserId: string,
    locationId?: string,
    taggedUserIds?: string[],
  ) {
    if (
      locationId &&
      !(await this.socialRepository.findActivePlace(locationId))
    ) {
      throw new BadRequestException('Location is not available');
    }
    const uniqueTagIds = [...new Set(taggedUserIds ?? [])];
    if (uniqueTagIds.includes(authorUserId)) {
      throw new BadRequestException('You cannot tag yourself');
    }
    if (!uniqueTagIds.length) return;
    const count = await this.socialRepository.countValidTagTargets(
      authorUserId,
      uniqueTagIds,
    );
    if (count !== uniqueTagIds.length) {
      throw new ForbiddenException(
        'Only followed active accounts can be tagged',
      );
    }
    for (const targetUserId of uniqueTagIds) {
      if (
        await this.socialRepository.hasBlockBetween(authorUserId, targetUserId)
      ) {
        throw new ForbiddenException('A blocked account cannot be tagged');
      }
    }
  }

  private async ensureActiveTarget(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot perform this action on yourself',
      );
    }
    const target = await this.socialRepository.findPublicProfile(targetUserId);
    if (!target) throw new NotFoundException('Profile not found');
    return target;
  }

  private async notifyTaggedUsers(
    actorUserId: string,
    postId: string,
    taggedUserIds: string[],
  ) {
    for (const userId of [...new Set(taggedUserIds)]) {
      await this.notificationsService.notify({
        userId,
        actorUserId,
        type: 'GENERAL',
        title: 'You were tagged in a post',
        message: 'Someone you follow tagged you in a post.',
        postId,
        actionUrl: `/api/v1/social/posts/${postId}`,
        metadata: { eventType: 'POST_TAGGED', postId },
        pushData: { eventType: 'POST_TAGGED', postId },
      });
    }
  }

  private async paginatePosts(
    postsPromise: Promise<any[]>,
    query: FeedQueryDto,
  ) {
    const posts = await postsPromise;
    const limit = query.limit ?? 20;
    const hasMore = posts.length > limit;
    const items = (hasMore ? posts.slice(0, limit) : posts).map((post) =>
      this.presentPost(post),
    );
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  private presentPost(post: any) {
    return {
      ...post,
      author: this.presentUser(post.author),
      taggedAccounts: (post.tags ?? []).map((tag: any) =>
        this.presentUser(tag.taggedUser),
      ),
      tags: undefined,
      isLiked: Boolean(post.likes?.length),
      isSaved: Boolean(post.savedBy?.length),
      likes: undefined,
      savedBy: undefined,
    };
  }

  private presentPublicProfile(profile: any) {
    return {
      ...this.presentUser(profile),
      bio: profile.profile?.bio ?? null,
      city: profile.profile?.city ?? null,
      state: profile.profile?.state ?? null,
      postCount: profile._count?.authoredPosts ?? 0,
      followerCount: profile._count?.followers ?? 0,
      followingCount: profile._count?.following ?? 0,
      isFollowing: Boolean(profile.followers?.length),
    };
  }

  private presentUser(user: any) {
    if (!user) return null;
    const truck = user.vendor?.foodTrucks?.[0];
    const isVendor = Boolean(user.vendor);
    const foodieName =
      (user.profile?.displayName ??
        [user.profile?.firstName, user.profile?.lastName]
          .filter(Boolean)
          .join(' ')) ||
      'Foodie';
    return {
      userId: user.id,
      accountType: isVendor ? 'VENDOR' : 'CUSTOMER',
      displayName: isVendor
        ? (truck?.name ?? user.vendor.businessName)
        : foodieName,
      avatarUrl: isVendor
        ? (truck?.profileImageUrl ?? user.vendor.logoUrl)
        : (user.profile?.avatarUrl ?? null),
      vendorId: user.vendor?.id ?? null,
      foodTruckId: truck?.id ?? null,
      foodTruckSlug: truck?.slug ?? null,
      isVerified: user.vendor?.isVerified ?? false,
    };
  }
}
