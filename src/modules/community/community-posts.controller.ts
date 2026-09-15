import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CommunityPostsService } from './community-posts.service';
import { CommunityService } from './community.service';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import {
  CommunityInterestDto,
  CommunityPostQueryDto,
  UpdateCommunityPostDto,
} from './dto/community-post-query.dto';
import { CommentRequestDto } from './dto/comment-request.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { ReportCommunityPostDto } from './dto/report-community-post.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { CommunityErrorFilter } from './community-error.filter';

const error = (statusCode: number, message: string, error: string) => ({
  statusCode,
  message,
  error,
});
const examplePost = {
  id: 'd9ff4b0e-77e9-4ec5-9280-e73005770557',
  category: 'COMMUNITY',
  title: 'COMMUNITY',
  description: 'Food truck meetup this weekend!',
  status: 'OPEN',
  visibility: 'PUBLIC',
  media: [],
  author: { displayName: 'Alex Rivera', roles: ['CUSTOMER'] },
  counts: { comments: 0, reactions: 0, offers: 0, interestedVendors: 0 },
  viewer: { isOwner: true, isIgnored: false, isInterested: false },
};

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseFilters(CommunityErrorFilter)
@ApiResponse({
  status: 400,
  description:
    'Invalid category, missing category-specific fields, invalid UUID, query, or attachment.',
  schema: {
    example: error(
      400,
      'eventDate is required for a Need-a-Truck request',
      'Bad Request',
    ),
  },
})
@ApiResponse({
  status: 401,
  description: 'Missing, invalid, or expired access token.',
  schema: {
    example: error(401, 'Invalid or expired access token', 'Unauthorized'),
  },
})
@ApiResponse({
  status: 403,
  description:
    'Account approval, ownership, private visibility, or self-response check failed.',
  schema: {
    example: error(
      403,
      'You cannot send a quote to your own request',
      'Forbidden',
    ),
  },
})
@ApiResponse({
  status: 404,
  description: 'Post or request does not exist or was deleted.',
  schema: { example: error(404, 'Community post not found', 'Not Found') },
})
@ApiResponse({
  status: 409,
  description:
    'Duplicate interest/quote, closed request, or post already has offers.',
  schema: {
    example: error(
      409,
      'You have already sent interest to this callout',
      'Conflict',
    ),
  },
})
@ApiResponse({
  status: 500,
  description: 'Unexpected server failure.',
  schema: {
    example: error(
      500,
      'Unable to complete the Community request. Please try again or contact support',
      'Internal Server Error',
    ),
  },
})
@Controller('api/v1/community')
export class CommunityPostsController {
  constructor(
    private readonly posts: CommunityPostsService,
    private readonly community: CommunityService,
  ) {}

  @Post('posts')
  @ApiOperation({
    summary: 'Create a Community post (Customer or approved Vendor)',
  })
  @ApiBody({
    type: CreateCommunityRequestDto,
    examples: {
      needTruck: {
        value: {
          category: 'NEED_TRUCK',
          eventType: 'BIRTHDAY_PARTY',
          eventDate: '2026-12-20',
          startTime: '11:00',
          endTime: '14:00',
          address: 'Golden Gate Park, SF',
          latitude: 37.7694,
          longitude: -122.4862,
          guestCount: 50,
          budgetMin: 500,
          budgetMax: 800,
          description: 'Looking for tacos and vegetarian options.',
          preferredMenuItems: ['Tacos', 'Vegetarian platter'],
        },
      },
      callout: {
        value: {
          category: 'VENDOR_CALLOUT',
          description:
            'Offering spots at our neighborhood festival. Vendors keep their own sales.',
          spotsOpen: 6,
          attendanceMin: 2000,
          attendanceMax: 2500,
          media: [],
        },
      },
      forSale: {
        value: {
          category: 'FOR_SALE',
          title: 'Commercial flat top grill',
          description: 'Used grill in good condition.',
          media: [],
        },
      },
      hiring: {
        value: {
          category: 'HIRING_JOBS',
          description: 'Hiring a part-time cook.',
          media: [],
        },
      },
      help: {
        value: {
          category: 'COMMUNITY_HELP',
          description: 'Looking for a local equipment repair service.',
          media: [],
        },
      },
      community: {
        value: {
          category: 'COMMUNITY',
          description: 'Food truck meetup this weekend!',
          media: [],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Post created.',
    schema: {
      example: {
        message: 'Community post created successfully',
        post: examplePost,
      },
    },
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityRequestDto,
  ) {
    return this.posts.create(user.sub, dto);
  }

  @Get('posts')
  @ApiOperation({
    summary:
      'List Community posts with category, location, pagination, or Requests tab',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Community posts retrieved successfully',
        items: [examplePost],
        pagination: { total: 1, limit: 20, offset: 0, nextOffset: null },
      },
    },
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CommunityPostQueryDto,
  ) {
    return this.posts.list(user.sub, query);
  }

  @Get('posts/mine')
  @ApiOperation({ summary: 'List my Community posts (Customer or Vendor)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Community posts retrieved successfully',
        items: [examplePost],
        pagination: { total: 1, limit: 20, offset: 0, nextOffset: null },
      },
    },
  })
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CommunityPostQueryDto,
  ) {
    return this.posts.list(user.sub, { ...query, tab: 'MINE' });
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: 'Get post details and viewer actions' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Community post retrieved successfully',
        post: examplePost,
      },
    },
  })
  async details(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return {
      message: 'Community post retrieved successfully',
      post: await this.posts.details(user.sub, id),
    };
  }

  @Patch('posts/:postId')
  @ApiOperation({
    summary: 'Edit my open Community post; requests with quotes are locked',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Community post updated successfully',
        post: examplePost,
      },
    },
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunityPostDto,
  ) {
    return this.posts.update(user.sub, id, dto);
  }

  @Delete('posts/:postId')
  @ApiOperation({ summary: 'Soft-delete my open Community post' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Community post deleted successfully',
        deleted: true,
      },
    },
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return this.posts.remove(user.sub, id);
  }

  @Post('media/upload')
  @ApiOperation({
    summary: 'Upload up to five Community attachments, maximum 10 MB each',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: 5,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        message: 'Attachments uploaded successfully',
        media: [
          { mediaUrl: 'https://cdn.example.com/flyer.png', mediaType: 'IMAGE' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 413,
    schema: {
      example: error(
        413,
        'Each attachment must be 10 MB or smaller',
        'Payload Too Large',
      ),
    },
  })
  @ApiResponse({
    status: 503,
    schema: {
      example: error(
        503,
        'Community attachment upload failed. Please try again',
        'Service Unavailable',
      ),
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { files: 5, fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.posts.upload(user.sub, files);
  }

  @Post('posts/:postId/interests')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiOperation({
    summary:
      'Send vendor interest to a Callout; no booking or payment is created',
  })
  @ApiResponse({
    status: 201,
    schema: { example: { message: 'Your interest was sent to the organizer' } },
  })
  interest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: CommunityInterestDto,
  ) {
    return this.posts.action(user.sub, id, 'INTEREST', dto.message);
  }

  @Get('posts/:postId/interests')
  @ApiOperation({
    summary: 'Organizer lists interested vendors and their messages',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Vendor interests retrieved successfully',
        items: [],
        total: 0,
      },
    },
  })
  interests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Query() query: CommunityPostQueryDto,
  ) {
    return this.posts.interests(user.sub, id, query);
  }

  @Delete('posts/:postId/interests/me')
  @ApiOperation({ summary: 'Withdraw my interest' })
  @ApiResponse({
    status: 200,
    schema: { example: { message: 'Interest withdrawn successfully' } },
  })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return this.posts.undoAction(user.sub, id, 'INTEREST');
  }

  @Post('posts/:postId/ignore')
  @ApiOperation({ summary: 'Ignore/Pass a post persistently for my account' })
  @ApiResponse({
    status: 201,
    schema: { example: { message: 'Post hidden from your Community feed' } },
  })
  ignore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return this.posts.action(user.sub, id, 'IGNORE');
  }

  @Delete('posts/:postId/ignore')
  @ApiOperation({ summary: 'Undo Ignore/Pass' })
  @ApiResponse({
    status: 200,
    schema: { example: { message: 'Post restored to your Community feed' } },
  })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return this.posts.undoAction(user.sub, id, 'IGNORE');
  }

  @Post('posts/:postId/reports')
  @ApiOperation({
    summary: 'Report a visible Community post',
    description:
      'Stores a report for review. Reporting does not automatically hide the post; use POST /api/v1/community/posts/:postId/ignore if the user taps Hide this post.',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        message: 'Report submitted successfully',
        report: {
          id: 'report-id',
          postId: 'd9ff4b0e-77e9-4ec5-9280-e73005770557',
          reason: 'SPAM_OR_IRRELEVANT',
          status: 'PENDING',
          createdAt: '2026-09-15T09:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Report reason is missing or invalid.',
    schema: {
      example: error(
        400,
        [
          'reason must be one of: SPAM_OR_IRRELEVANT, INAPPROPRIATE_CONTENT, HARASSMENT, SCAM_OR_FRAUD, NOT_FOOD_TRUCK_RELATED',
        ].join(', '),
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'User is trying to report their own post.',
    schema: {
      example: error(403, 'You cannot report your own post', 'Forbidden'),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Community post was not found or is not available.',
    schema: {
      example: error(404, 'Community request not found', 'Not Found'),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User already reported this post.',
    schema: {
      example: error(409, 'You have already reported this post', 'Conflict'),
    },
  })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: ReportCommunityPostDto,
  ) {
    return this.posts.report(user.sub, id, dto);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Comment on a visible Community post' })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        message: 'Comment added successfully',
        comment: { content: 'Sounds great!' },
      },
    },
  })
  async comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: CommentRequestDto,
  ) {
    return {
      message: 'Comment added successfully',
      comment: await this.community.commentOnRequest(user.sub, id, dto),
    };
  }

  @Get('posts/:postId/comments')
  @ApiOperation({
    summary: 'Read paginated comments; parentCommentId identifies replies',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        message: 'Comments retrieved successfully',
        items: [],
        pagination: { total: 0, limit: 20, offset: 0, nextOffset: null },
      },
    },
  })
  comments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Query() query: CommunityPostQueryDto,
  ) {
    return this.posts.comments(user.sub, id, query);
  }

  @Post('posts/:postId/reactions')
  @ApiOperation({ summary: 'React to a visible Community post' })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        message: 'Reaction saved successfully',
        reaction: { reaction: 'LIKE' },
      },
    },
  })
  async react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: ReactRequestDto,
  ) {
    return {
      message: 'Reaction saved successfully',
      reaction: await this.community.reactToRequest(user.sub, id, dto),
    };
  }

  @Post('posts/:postId/offers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiOperation({
    summary:
      'Send a quote to another user’s Need-a-Truck post (approved Vendor)',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        message: 'Quote sent successfully',
        offer: {
          status: 'PENDING',
          quotedAmount: 1250,
          depositAmount: 250,
          balanceDueAtEvent: 1000,
        },
      },
    },
  })
  async quote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
    @Body() dto: CreateVendorOfferDto,
  ) {
    return {
      message: 'Quote sent successfully',
      offer: await this.community.createVendorOffer(user.sub, id, dto),
    };
  }

  @Get('posts/:postId/offers')
  @ApiOperation({
    summary: 'Organizer lists received quotes; vendors see their own quotes',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: { message: 'Quotes retrieved successfully', items: [] },
    },
  })
  async offers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseUUIDPipe) id: string,
  ) {
    return {
      message: 'Quotes retrieved successfully',
      items: await this.community.listRequestOffers(user.sub, id),
    };
  }
}
