import {
  Body,
  Controller,
  Delete,
  Get,
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
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetInterestCuisinesDto } from './dto/set-interest-cuisines.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List available cuisine interests for onboarding (Public)',
  })
  @Get('interest-cuisines')
  listInterestCuisines() {
    return this.usersService.listInterestCuisines();
  }

  @ApiOperation({ summary: 'Get current authenticated user profile & details' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'Save selected cuisine interests for current user' })
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Update settings (timezone, language, units) for current user',
  })
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto);
  }

  @ApiOperation({ summary: 'Deactivate current user account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me/deactivate')
  deactivateAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateAccount(user.sub);
  }

  @ApiOperation({ summary: 'Update account status of a user (Admin)' })
  @ApiBearerAuth()
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
