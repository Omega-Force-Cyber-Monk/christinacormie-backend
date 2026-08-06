import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CommentRequestDto } from './dto/comment-request.dto';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { CreateVendorOfferDto } from './dto/create-vendor-offer.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { ReactRequestDto } from './dto/react-request.dto';
import { RequestMediaDto } from './dto/request-media.dto';
import { CommunityService } from './community.service';

@ApiTags('Community')
@Controller('api/v1/community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @ApiOperation({ summary: 'Create a public community food truck request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('requests')
  createPublicRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityRequestDto,
  ) {
    return this.communityService.createPublicRequest(user.sub, dto);
  }

  @ApiOperation({ summary: 'Create a private request for a specific food truck' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/requests')
  createPrivateTruckRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
    @Body() dto: CreateCommunityRequestDto,
  ) {
    return this.communityService.createPrivateTruckRequest(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Add media image/video to a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('requests/:requestId/media')
  addRequestMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: RequestMediaDto,
  ) {
    return this.communityService.addRequestMedia(user.sub, requestId, dto);
  }

  @ApiOperation({ summary: 'Add a comment to a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('requests/:requestId/comments')
  commentOnRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: CommentRequestDto,
  ) {
    return this.communityService.commentOnRequest(user.sub, requestId, dto);
  }

  @ApiOperation({ summary: 'React (Like/Upvote) to a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('requests/:requestId/reactions')
  reactToRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReactRequestDto,
  ) {
    return this.communityService.reactToRequest(user.sub, requestId, dto);
  }

  @ApiOperation({ summary: 'Submit a vendor proposal offer for a community request (Vendor)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('requests/:requestId/offers')
  createVendorOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() dto: CreateVendorOfferDto,
  ) {
    return this.communityService.createVendorOffer(user.sub, requestId, dto);
  }

  @ApiOperation({ summary: 'Accept a vendor offer for a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('offers/:offerId/accept')
  acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId') offerId: string,
  ) {
    return this.communityService.acceptOffer(user.sub, offerId);
  }

  @ApiOperation({ summary: 'Reject a vendor offer for a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('offers/:offerId/reject')
  rejectOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId') offerId: string,
  ) {
    return this.communityService.rejectOffer(user.sub, offerId);
  }

  @ApiOperation({ summary: 'Withdraw a submitted vendor offer (Vendor)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('offers/:offerId/withdraw')
  withdrawOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId') offerId: string,
  ) {
    return this.communityService.withdrawOffer(user.sub, offerId);
  }

  @ApiOperation({ summary: 'Recommend a new food truck lead to the platform' })
  @Post('new-food-truck-leads')
  createNewFoodTruckLead(@Body() dto: NewFoodTruckLeadDto) {
    return this.communityService.createNewFoodTruckLead(dto);
  }
}
