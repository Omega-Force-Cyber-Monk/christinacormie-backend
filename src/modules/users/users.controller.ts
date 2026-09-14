import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetInterestCuisinesDto } from './dto/set-interest-cuisines.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UsersService } from './users.service';

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

const userResponseExample = {
  id: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  email: 'customer@example.com',
  phone: '+12025550123',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-09-08T06:00:00.000Z',
  phoneVerifiedAt: null,
  lastLoginAt: '2026-09-08T06:10:00.000Z',
  createdAt: '2026-09-08T05:50:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  roles: ['CUSTOMER'],
  profile: {
    id: '9a0c9420-0d7f-4b77-9f2b-57aa58b91541',
    userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
    firstName: 'Alex',
    lastName: 'Rivera',
    displayName: 'Alex Rivera',
    dateOfBirth: '1994-08-12T00:00:00.000Z',
    avatarUrl: 'https://cdn.bitedrop.com/avatars/alex.jpg',
    bio: 'Foodie & gourmet truck enthusiast',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    postalCode: '78701',
  },
  settings: {
    language: 'en',
    timezone: 'America/New_York',
    distanceUnit: 'MILES',
    locationPermissionGranted: true,
    pushPermissionGranted: true,
    marketingConsent: false,
  },
  notificationPreference: {
    nearbyDropAlerts: true,
    followedTruckUpdates: true,
    favoriteTruckAlerts: true,
    promotionAlerts: true,
    bookingAlerts: true,
    paymentAlerts: true,
    messageAlerts: true,
    rewardAlerts: true,
    checkInAlerts: false,
    marketingAlerts: false,
  },
  interestCuisines: [
    {
      id: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
      name: 'Mexican',
      slug: 'mexican',
      iconUrl: null,
      pinColor: '#FF5733',
    },
  ],
  vendor: null,
};

const profileResponseExample = {
  id: '9a0c9420-0d7f-4b77-9f2b-57aa58b91541',
  userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  firstName: 'Alex',
  lastName: 'Rivera',
  displayName: 'Alex Rivera',
  dateOfBirth: '1994-08-12T00:00:00.000Z',
  avatarUrl: 'https://cdn.bitedrop.com/avatars/alex.jpg',
  bio: 'Foodie & gourmet truck enthusiast',
  city: 'Austin',
  state: 'TX',
  country: 'USA',
  postalCode: '78701',
  email: 'alex@example.com',
  phone: '+12025550123',
};

const profileAvatarUploadResponseExample = {
  message: 'Profile photo uploaded successfully',
  avatarUrl:
    'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/users/user-id/avatars/avatar.jpg',
  publicId: 'bitedrop/users/user-id/avatars/avatar',
  width: 512,
  height: 512,
  format: 'jpg',
  resourceType: 'image',
  originalFilename: 'avatar.jpg',
  profile: {
    ...profileResponseExample,
    avatarUrl:
      'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/users/user-id/avatars/avatar.jpg',
  },
};

const settingsResponseExample = {
  id: '8a0c9420-0d7f-4b77-9f2b-57aa58b91541',
  userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  language: 'en',
  timezone: 'America/New_York',
  distanceUnit: 'MILES',
  locationPermissionGranted: true,
  pushPermissionGranted: true,
  marketingConsent: false,
  createdAt: '2026-09-08T05:50:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
};

const notificationPreferencesResponseExample = {
  id: '6a0c9420-0d7f-4b77-9f2b-57aa58b91541',
  userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  nearbyDropAlerts: true,
  followedTruckUpdates: true,
  favoriteTruckAlerts: true,
  promotionAlerts: true,
  bookingAlerts: true,
  paymentAlerts: true,
  messageAlerts: true,
  rewardAlerts: true,
  checkInAlerts: false,
  marketingAlerts: false,
  createdAt: '2026-09-08T05:50:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
};

const deviceTokenResponseExample = {
  id: '5a0c9420-0d7f-4b77-9f2b-57aa58b91541',
  userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  token: 'expo_push_token_or_fcm_token_here',
  platform: 'IOS',
  deviceId: 'iphone-15-pro-user-1',
  isActive: true,
  createdAt: '2026-09-08T05:50:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
};

@ApiTags('Users')
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List available cuisine interests for onboarding (Public)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active cuisine interests returned successfully.',
    schema: {
      example: [
        {
          id: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
          name: 'Mexican',
          slug: 'mexican',
          iconUrl: null,
          pinColor: '#FF5733',
        },
      ],
    },
  })
  @Get('interest-cuisines')
  listInterestCuisines() {
    return this.usersService.listInterestCuisines();
  }

  @ApiOperation({ summary: 'Get current authenticated user profile & details' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Current user profile returned successfully.',
    schema: {
      example: userResponseExample,
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'Save selected cuisine interests for current user' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Cuisine interests saved successfully.',
    schema: {
      example: userResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['cuisineIds must contain at least 1 elements'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User or one/more cuisines were not found.',
    schema: {
      example: errorExample(
        404,
        'One or more cuisines were not found',
        'Not Found',
      ),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/interests')
  setInterestCuisines(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetInterestCuisinesDto,
  ) {
    return this.usersService.setInterestCuisines(user.sub, dto);
  }

  @ApiOperation({
    summary:
      'Register or reactivate a device/browser push token for current user',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Device token registered or reactivated successfully.',
    schema: {
      example: deviceTokenResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['platform must be one of the following values: ANDROID, IOS, WEB'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('me/device-tokens')
  registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.usersService.registerDeviceToken(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Deactivate a device/browser push token for current user',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Device token deactivated successfully.',
    schema: {
      example: {
        removed: true,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User or device token was not found.',
    schema: {
      example: errorExample(404, 'Device token not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('me/device-tokens/:id')
  removeDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') deviceTokenId: string,
  ) {
    return this.usersService.removeDeviceToken(user.sub, deviceTokenId);
  }

  @ApiOperation({ summary: 'Update profile info for current user' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
    schema: {
      example: profileResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(400, ['email must be an email'], 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email is already used by another account.',
    schema: {
      example: errorExample(
        409,
        'Email address is already in use by another account',
        'Conflict',
      ),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Upload and save current user profile photo',
    description:
      'Use this multipart endpoint from the Settings profile photo picker. It uploads the image to Cloudinary and saves the returned URL as profile.avatarUrl.',
  })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Profile photo uploaded and saved successfully.',
    schema: {
      example: profileAvatarUploadResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'File is missing, file is not an image, file is too large, or Cloudinary is not configured.',
    schema: {
      example: errorExample(
        400,
        'Only image files are allowed for profile photo',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('me/profile/avatar/upload')
  uploadProfileAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfileAvatar(user.sub, file);
  }

  @ApiOperation({
    summary: 'Update settings (timezone, language, units) for current user',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully.',
    schema: {
      example: settingsResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['language must be shorter than or equal to 10 characters'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Update notification alert preferences for current user',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully.',
    schema: {
      example: notificationPreferencesResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['nearbyDropAlerts must be a boolean value'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Permanently delete current customer account',
    description:
      'Use this from Settings > Delete account. This permanently removes the customer account and related customer data. Vendor accounts are blocked from this endpoint to avoid deleting business/truck data accidentally.',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Account permanently deleted successfully.',
    schema: {
      example: {
        deleted: true,
        message: 'Account permanently deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Vendor account cannot be deleted from customer settings.',
    schema: {
      example: errorExample(
        400,
        'Vendor account deletion is not available from customer settings. Please contact support.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('me')
  deleteMyAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteAccountPermanently(user.sub);
  }

  @ApiOperation({ summary: 'Update account status of a user (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'User account status updated successfully.',
    schema: {
      example: {
        ...userResponseExample,
        status: 'SUSPENDED',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        [
          'status must be one of the following values: PENDING, ACTIVE, SUSPENDED, DEACTIVATED, BLOCKED',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: unauthorizedExample,
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not an admin.',
    schema: {
      example: errorExample(403, 'Forbidden resource', 'Forbidden'),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Target user was not found.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/account-status')
  updateAccountStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.usersService.updateAccountStatus(userId, dto.status);
  }
}
