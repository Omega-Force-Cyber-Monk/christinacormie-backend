import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CommentPostDto } from './dto/comment-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import {
  ExploreFeedQueryDto,
  ExploreSortBy,
} from './dto/explore-feed-query.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { ToggleFollowNotificationsDto } from './dto/toggle-follow-notifications.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FavoriteTab, GetFavoritesQueryDto } from './dto/get-favorites-query.dto';

@Injectable()
export class SocialRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true, status: true, isVerified: true },
    });
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        vendorId: true,
        status: true,
        deletedAt: true,
        vendor: {
          select: {
            status: true,
            isVerified: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  findFollow(userId: string, foodTruckId: string) {
    return this.prisma.foodTruckFollow.findUnique({
      where: {
        userId_foodTruckId: {
          userId,
          foodTruckId,
        },
      },
    });
  }

  async followFoodTruck(userId: string, foodTruckId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.foodTruckFollow.findUnique({
        where: {
          userId_foodTruckId: {
            userId,
            foodTruckId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      const follow = await tx.foodTruckFollow.create({
        data: {
          userId,
          foodTruckId,
        },
      });

      await tx.foodTruck.update({
        where: { id: foodTruckId },
        data: {
          followerCount: { increment: 1 },
        },
      });

      return follow;
    });
  }

  async unfollowFoodTruck(userId: string, foodTruckId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.foodTruckFollow.findUnique({
        where: {
          userId_foodTruckId: {
            userId,
            foodTruckId,
          },
        },
      });

      if (!existing) {
        return null;
      }

      await tx.foodTruckFollow.delete({
        where: { id: existing.id },
      });

      await tx.$executeRaw`
        UPDATE food_trucks
        SET follower_count = GREATEST(follower_count - 1, 0)
        WHERE id = ${foodTruckId}::uuid
      `;

      return existing;
    });
  }

  updateFollowNotifications(
    userId: string,
    foodTruckId: string,
    dto: ToggleFollowNotificationsDto,
  ) {
    return this.prisma.foodTruckFollow.update({
      where: {
        userId_foodTruckId: {
          userId,
          foodTruckId,
        },
      },
      data: {
        notificationsEnabled: dto.notificationsEnabled,
      },
    });
  }

  favoriteFoodTruck(userId: string, foodTruckId: string) {
    return this.prisma.favoriteTruck.upsert({
      where: {
        userId_foodTruckId: {
          userId,
          foodTruckId,
        },
      },
      create: {
        userId,
        foodTruckId,
      },
      update: {},
    });
  }

  async unfavoriteFoodTruck(userId: string, foodTruckId: string) {
    const existing = await this.prisma.favoriteTruck.findUnique({
      where: {
        userId_foodTruckId: {
          userId,
          foodTruckId,
        },
      },
    });

    if (!existing) {
      return null;
    }

    return this.prisma.favoriteTruck.delete({
      where: { id: existing.id },
    });
  }

  createPost(vendorId: string, dto: CreatePostDto) {
    const status = dto.status ?? 'PUBLISHED';
    const data: any = {
      vendorId,
      foodTruckId: dto.foodTruckId,
      content: dto.content,
      status: status as any,
      isPromotion: dto.isPromotion ?? false,
      isFollowerOnly: dto.isFollowerOnly ?? false,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    };

    if (dto.media?.length) {
      data.media = {
        create: dto.media.map((media) => ({
          mediaType: media.mediaType,
          mediaUrl: media.mediaUrl,
          sortOrder: media.sortOrder ?? 0,
        })),
      };
    }

    return this.prisma.post.create({
      data,
      include: this.postInclude(),
    });
  }

  findPostById(postId: string) {
    return this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        foodTruck: {
          select: {
            id: true,
            vendorId: true,
          },
        },
      },
    });
  }

  findVisiblePost(postId: string, userId: string) {
    return this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        status: 'PUBLISHED',
        OR: [
          { isFollowerOnly: false },
          {
            foodTruck: {
              follows: {
                some: { userId },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
  }

  async updatePost(postId: string, dto: UpdatePostDto) {
    const data: any = {};

    if (dto.content !== undefined) {
      data.content = dto.content;
    }

    if (dto.status !== undefined) {
      data.status = dto.status as any;
      data.publishedAt = dto.status === 'PUBLISHED' ? new Date() : null;
    }

    if (dto.isPromotion !== undefined) {
      data.isPromotion = dto.isPromotion;
    }

    if (dto.isFollowerOnly !== undefined) {
      data.isFollowerOnly = dto.isFollowerOnly;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.media !== undefined) {
        await tx.postMedia.deleteMany({
          where: { postId },
        });

        if (dto.media.length) {
          await tx.postMedia.createMany({
            data: dto.media.map((media) => ({
              postId,
              mediaType: media.mediaType,
              mediaUrl: media.mediaUrl,
              sortOrder: media.sortOrder ?? 0,
            })),
          });
        }
      }

      if (Object.keys(data).length) {
        return tx.post.update({
          where: { id: postId },
          data,
          include: this.postInclude(),
        });
      }

      return tx.post.findUnique({
        where: { id: postId },
        include: this.postInclude(),
      });
    });
  }

  deletePost(postId: string) {
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        status: 'REMOVED' as any,
        deletedAt: new Date(),
      },
    });
  }

  async likePost(postId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (existing) {
        return existing;
      }

      const like = await tx.postLike.create({
        data: {
          postId,
          userId,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          likeCount: { increment: 1 },
        },
      });

      return like;
    });
  }

  findCommentById(commentId: string) {
    return this.prisma.postComment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
      },
      select: {
        id: true,
        postId: true,
        parentCommentId: true,
      },
    });
  }

  async findCommentsForPost(
    postId: string,
    userId?: string,
    dto?: GetCommentsQueryDto,
  ) {
    const limit = dto?.limit ?? 20;
    const offset = dto?.offset ?? 0;

    const [totalCount, topLevelComments] = await Promise.all([
      this.prisma.postComment.count({
        where: {
          postId,
          deletedAt: null,
        },
      }),
      this.prisma.postComment.findMany({
        where: {
          postId,
          parentCommentId: null,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          likes: userId
            ? {
                where: { userId },
                select: { id: true },
              }
            : false,
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      displayName: true,
                      firstName: true,
                      lastName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              likes: userId
                ? {
                    where: { userId },
                    select: { id: true },
                  }
                : false,
            },
          },
        },
      }),
    ]);

    const formattedComments = topLevelComments.map((comment) => {
      const isLiked = Boolean(comment.likes && comment.likes.length > 0);
      const displayName =
        (comment.user.profile?.displayName ??
          `${comment.user.profile?.firstName ?? ''} ${comment.user.profile?.lastName ?? ''}`.trim()) ||
        'Customer';

      const formattedReplies = (comment.replies || []).map((reply) => {
        const replyIsLiked = Boolean(reply.likes && reply.likes.length > 0);
        const replyDisplayName =
          (reply.user.profile?.displayName ??
            `${reply.user.profile?.firstName ?? ''} ${reply.user.profile?.lastName ?? ''}`.trim()) ||
          'Customer';

        return {
          id: reply.id,
          postId: reply.postId,
          parentCommentId: reply.parentCommentId,
          content: reply.content,
          likeCount: reply.likeCount,
          isLiked: replyIsLiked,
          createdAt: reply.createdAt,
          author: {
            id: reply.user.id,
            displayName: replyDisplayName,
            avatarUrl: reply.user.profile?.avatarUrl ?? null,
          },
        };
      });

      return {
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        likeCount: comment.likeCount,
        isLiked,
        createdAt: comment.createdAt,
        author: {
          id: comment.user.id,
          displayName,
          avatarUrl: comment.user.profile?.avatarUrl ?? null,
        },
        replies: formattedReplies,
      };
    });

    return {
      totalCount,
      comments: formattedComments,
    };
  }

  async commentOnPost(postId: string, userId: string, dto: CommentPostDto) {
    let effectiveParentCommentId: string | null = dto.parentCommentId ?? null;

    if (dto.parentCommentId) {
      const parent = await this.findCommentById(dto.parentCommentId);
      if (parent?.parentCommentId) {
        // Flatten to top-level parent comment for 1-level depth
        effectiveParentCommentId = parent.parentCommentId;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.postComment.create({
        data: {
          postId,
          userId,
          parentCommentId: effectiveParentCommentId,
          content: dto.content,
        },
        include: {
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          commentCount: { increment: 1 },
        },
      });

      const displayName =
        (comment.user.profile?.displayName ??
          `${comment.user.profile?.firstName ?? ''} ${comment.user.profile?.lastName ?? ''}`.trim()) ||
        'Customer';

      return {
        id: comment.id,
        postId: comment.postId,
        parentCommentId: comment.parentCommentId,
        content: comment.content,
        likeCount: comment.likeCount,
        isLiked: false,
        createdAt: comment.createdAt,
        author: {
          id: comment.user.id,
          displayName,
          avatarUrl: comment.user.profile?.avatarUrl ?? null,
        },
      };
    });
  }

  async likeComment(commentId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.postCommentLike.findUnique({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      });

      if (existing) {
        await tx.postCommentLike.delete({
          where: { id: existing.id },
        });

        const updated = await tx.postComment.update({
          where: { id: commentId },
          data: {
            likeCount: { decrement: 1 },
          },
          select: { id: true, likeCount: true },
        });

        return {
          liked: false,
          likeCount: Math.max(0, updated.likeCount),
        };
      }

      await tx.postCommentLike.create({
        data: {
          commentId,
          userId,
        },
      });

      const updated = await tx.postComment.update({
        where: { id: commentId },
        data: {
          likeCount: { increment: 1 },
        },
        select: { id: true, likeCount: true },
      });

      return {
        liked: true,
        likeCount: updated.likeCount,
      };
    });
  }

  async sharePost(postId: string) {
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        shareCount: { increment: 1 },
      },
      select: {
        id: true,
        shareCount: true,
        content: true,
        foodTruck: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async savePost(postId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.savedPost.findUnique({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });

      if (existing) {
        await tx.savedPost.delete({
          where: { id: existing.id },
        });

        await tx.post.update({
          where: { id: postId },
          data: {
            saveCount: { decrement: 1 },
          },
        });

        return { saved: false };
      }

      await tx.savedPost.create({
        data: {
          postId,
          userId,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          saveCount: { increment: 1 },
        },
      });

      return { saved: true };
    });
  }

  findFollowedFeed(userId: string, dto: FeedQueryDto) {
    const take = (dto.limit ?? 20) + 1;

    return this.prisma.post.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        foodTruck: {
          follows: {
            some: { userId },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take,
      ...(dto.cursor
        ? {
            cursor: { id: dto.cursor },
            skip: 1,
          }
        : {}),
      include: this.postInclude(userId),
    });
  }

  findExploreFeed(userId: string | undefined, dto: ExploreFeedQueryDto) {
    const limit = dto.limit ?? 20;
    const take = limit + 1;

    const orderBy: any =
      dto.sortBy === ExploreSortBy.TRENDING
        ? [
            { likeCount: 'desc' },
            { commentCount: 'desc' },
            { createdAt: 'desc' },
          ]
        : [{ createdAt: 'desc' }];

    return this.prisma.post.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        isFollowerOnly: false,
      },
      orderBy,
      take,
      ...(dto.cursor
        ? {
            cursor: { id: dto.cursor },
            skip: 1,
          }
        : {}),
      include: this.postInclude(userId),
    });
  }

  private postInclude(userId?: string): any {
    const include: any = {
      media: {
        orderBy: { sortOrder: 'asc' as const },
      },
      vendor: {
        select: {
          id: true,
          businessName: true,
          logoUrl: true,
          isVerified: true,
        },
      },
      foodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          profileImageUrl: true,
          operatingStatus: true,
        },
      },
    };

    if (userId) {
      include.likes = {
        where: { userId },
        select: { id: true },
      };
      include.savedBy = {
        where: { userId },
        select: { id: true },
      };
    }

    return include;
  }

  async getFavorites(userId: string, query: GetFavoritesQueryDto) {
    const search = query.search?.trim();
    const currentDayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

    const hasCoords =
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      !isNaN(query.latitude) &&
      !isNaN(query.longitude);

    const distanceSql = hasCoords
      ? `ROUND((ST_Distance(f.current_location, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) / 1000)::numeric, 2) AS "distanceKm",`
      : `NULL::numeric AS "distanceKm",`;

    const searchSql = search
      ? `AND (
          f.name ILIKE $2
          OR f.truck_call_name ILIKE $2
          OR EXISTS (
            SELECT 1 FROM food_truck_cuisines ftc2
            INNER JOIN cuisines c2 ON c2.id = ftc2.cuisine_id
            WHERE ftc2.food_truck_id = f.id AND c2.name ILIKE $2
          )
        )`
      : '';

    const queryParams: any[] = [userId];
    if (search) {
      queryParams.push(`%${search}%`);
    }

    const rawQuery = `
      WITH user_trucks AS (
        SELECT food_truck_id, MIN(created_at) AS followed_at, bool_or(is_fav) AS is_fav
        FROM (
          SELECT food_truck_id, created_at, true AS is_fav
          FROM favorite_trucks
          WHERE user_id = $1::uuid
          UNION ALL
          SELECT food_truck_id, created_at, false AS is_fav
          FROM food_truck_follows
          WHERE user_id = $1::uuid
        ) combined
        GROUP BY food_truck_id
      )
      SELECT
        ut.followed_at AS "followedAt",
        ut.is_fav AS "isFavorite",
        f.id,
        f.name,
        f.slug,
        f.description,
        COALESCE(img.image_url, f.profile_image_url) AS "profileImageUrl",
        f.cover_image_url AS "coverImageUrl",
        f.current_address AS "currentAddress",
        f.operating_status AS "operatingStatus",
        f.average_rating AS "averageRating",
        f.total_reviews AS "totalReviews",
        f.follower_count AS "followerCount",
        ST_Y(f.current_location::geometry) AS latitude,
        ST_X(f.current_location::geometry) AS longitude,
        ${distanceSql}
        c.name AS "cuisine",
        CASE
          WHEN toh.id IS NOT NULL THEN jsonb_build_object(
            'dayOfWeek', toh.day_of_week,
            'openingTime', toh.opening_time::text,
            'closingTime', toh.closing_time::text,
            'isClosed', toh.is_closed
          )
          ELSE NULL
        END AS "todayOperatingHours"
      FROM user_trucks ut
      INNER JOIN food_trucks f ON f.id = ut.food_truck_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM food_truck_images
        WHERE food_truck_id = f.id
        ORDER BY sort_order ASC
        LIMIT 1
      ) img ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.name
        FROM food_truck_cuisines ftc
        INNER JOIN cuisines c ON c.id = ftc.cuisine_id
        WHERE ftc.food_truck_id = f.id
        ORDER BY ftc.is_primary DESC, c.name ASC
        LIMIT 1
      ) c ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, day_of_week, opening_time, closing_time, is_closed
        FROM truck_operating_hours
        WHERE food_truck_id = f.id AND day_of_week = ${currentDayOfWeek}
        LIMIT 1
      ) toh ON TRUE
      WHERE f.status = 'ACTIVE'
        ${searchSql}
      ORDER BY ut.followed_at DESC;
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      rawQuery,
      ...queryParams,
    );

    const allItems = rows.map((row) => {
      const isOpen =
        row.operatingStatus === 'OPEN' &&
        (!row.todayOperatingHours || !row.todayOperatingHours.isClosed);

      let statusText = 'Closed';
      if (row.operatingStatus === 'OPEN') {
        if (row.todayOperatingHours?.closingTime) {
          statusText = `Open till ${this.formatClosingTime(row.todayOperatingHours.closingTime)}`;
        } else {
          statusText = 'Open till 09pm';
        }
      }

      let distance: string | null = null;
      let distanceMiles: number | null = null;
      if (row.distanceKm != null) {
        const miles = Number(row.distanceKm) * 0.621371;
        distanceMiles = Number(miles.toFixed(2));
        distance = miles < 0.1 ? '< 0.1 mi' : `${miles.toFixed(1)} mi`;
      }

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        profileImageUrl: row.profileImageUrl,
        coverImageUrl: row.coverImageUrl,
        cuisine: row.cuisine || 'General',
        averageRating: Number(Number(row.averageRating || 0).toFixed(1)),
        totalReviews: Number(row.totalReviews || 0),
        distance,
        distanceKm: row.distanceKm != null ? Number(row.distanceKm) : null,
        distanceMiles,
        isOpen,
        operatingStatus: row.operatingStatus,
        statusText,
        isFavorite: true,
        followedSince: this.formatFollowingSince(row.followedAt),
        followedAt: row.followedAt,
      };
    });

    const totalCount = allItems.length;
    const openCount = allItems.filter((item) => item.isOpen).length;
    const closedCount = totalCount - openCount;

    let filteredItems = allItems;
    if (query.tab === FavoriteTab.OPEN) {
      filteredItems = allItems.filter((item) => item.isOpen);
    } else if (
      query.tab === FavoriteTab.CLOSED ||
      (query.tab as string) === 'CLOSE'
    ) {
      filteredItems = allItems.filter((item) => !item.isOpen);
    }

    return {
      totalCount,
      openCount,
      closedCount,
      items: filteredItems,
    };
  }

  private formatClosingTime(timeStr?: string | null): string {
    if (!timeStr) return '09pm';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      const minute = parseInt(parts[1], 10);
      const ampm = hour >= 12 ? 'pm' : 'am';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
      if (minute === 0) {
        return `${hourStr}${ampm}`;
      } else {
        const minStr = minute < 10 ? `0${minute}` : `${minute}`;
        return `${hourStr}:${minStr}${ampm}`;
      }
    }
    return '09pm';
  }

  private formatFollowingSince(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      if (diffDays <= 0) return 'Following since today';
      return `Following since ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) {
      return `Following since ${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `Following since ${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    }
    const diffYears = Math.floor(diffDays / 365);
    return `Following since ${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  }
}
