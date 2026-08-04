import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommentPostDto } from './dto/comment-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { ToggleFollowNotificationsDto } from './dto/toggle-follow-notifications.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SocialRepository } from './social.repository';

@Injectable()
export class SocialService {
  constructor(private readonly socialRepository: SocialRepository) {}

  async followFoodTruck(userId: string, foodTruckId: string) {
    await this.ensureFoodTruckExists(foodTruckId);
    return this.socialRepository.followFoodTruck(userId, foodTruckId);
  }

  async unfollowFoodTruck(userId: string, foodTruckId: string) {
    await this.ensureFoodTruckExists(foodTruckId);
    const follow = await this.socialRepository.unfollowFoodTruck(
      userId,
      foodTruckId,
    );

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

  async createPost(userId: string, dto: CreatePostDto) {
    const vendor = await this.ensureOwnFoodTruck(userId, dto.foodTruckId);
    return this.socialRepository.createPost(vendor.id, dto);
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
    await this.ensureOwnPost(userId, postId);
    return this.socialRepository.updatePost(postId, dto);
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
      items: items.map((post: any) => ({
        ...post,
        isLiked: Boolean(post.likes?.length),
        isSaved: Boolean(post.savedBy?.length),
        likes: undefined,
        savedBy: undefined,
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck = await this.socialRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.socialRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    const foodTruck = await this.ensureFoodTruckExists(foodTruckId);

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    return vendor;
  }

  private async ensureOwnPost(userId: string, postId: string) {
    const vendor = await this.socialRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    const post = await this.socialRepository.findPostById(postId);

    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    if (post.vendorId !== vendor.id) {
      throw new ForbiddenException('Post does not belong to this vendor');
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
}
