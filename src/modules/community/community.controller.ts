import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
  UseFilters,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateCommunityRequestDto } from './dto/create-community-request.dto';
import { NewFoodTruckLeadDto } from './dto/new-food-truck-lead.dto';
import { CommunityService } from './community.service';
import { CommunityErrorFilter } from './community-error.filter';

@ApiTags('Community')
@UseFilters(CommunityErrorFilter)
@ApiResponse({
  status: 400,
  description: 'Invalid request data.',
  schema: {
    example: {
      statusCode: 400,
      error: 'Bad Request',
      message: 'eventDate is required for a Need-a-Truck request',
    },
  },
})
@ApiResponse({
  status: 401,
  description: 'Authentication required.',
  schema: {
    example: {
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid or expired access token',
    },
  },
})
@ApiResponse({
  status: 403,
  description: 'Approval, ownership, or visibility check failed.',
  schema: {
    example: {
      statusCode: 403,
      error: 'Forbidden',
      message: 'You cannot send a quote to your own request',
    },
  },
})
@ApiResponse({
  status: 404,
  description: 'Requested resource was not found.',
  schema: {
    example: {
      statusCode: 404,
      error: 'Not Found',
      message: 'Community request not found',
    },
  },
})
@ApiResponse({
  status: 409,
  description: 'Conflicting quote or request state.',
  schema: {
    example: {
      statusCode: 409,
      error: 'Conflict',
      message: 'This request is no longer open for quotes',
    },
  },
})
@Controller('api/v1/community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @ApiOperation({
    summary: 'Create a private request for a specific food truck',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('food-trucks/:foodTruckId/requests')
  createPrivateTruckRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId', ParseUUIDPipe) foodTruckId: string,
    @Body() dto: CreateCommunityRequestDto,
  ) {
    return this.communityService.createPrivateTruckRequest(
      user.sub,
      foodTruckId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Accept a vendor offer for a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('offers/:offerId/accept')
  acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.communityService.acceptOffer(user.sub, offerId);
  }

  @ApiOperation({ summary: 'Reject a vendor offer for a community request' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('offers/:offerId/reject')
  rejectOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
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
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.communityService.withdrawOffer(user.sub, offerId);
  }

  @ApiOperation({ summary: 'Recommend a new food truck lead to the platform' })
  @Post('new-food-truck-leads')
  createNewFoodTruckLead(@Body() dto: NewFoodTruckLeadDto) {
    return this.communityService.createNewFoodTruckLead(dto);
  }
}
