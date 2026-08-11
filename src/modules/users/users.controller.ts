import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetInterestCuisinesDto } from './dto/set-interest-cuisines.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current authenticated user profile & details' })
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.sub);
  }

  @ApiOperation({ summary: 'List available cuisine interests for onboarding' })
  @Get('interest-cuisines')
  listInterestCuisines() {
    return this.usersService.listInterestCuisines();
  }

  @ApiOperation({ summary: 'Save selected cuisine interests for current user' })
  @Patch('me/interests')
  setInterestCuisines(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetInterestCuisinesDto,
  ) {
    return this.usersService.setInterestCuisines(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update profile info for current user' })
  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update settings (timezone, language, units) for current user' })
  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update notification alert preferences for current user' })
  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.sub, dto);
  }

  @ApiOperation({ summary: 'Deactivate current user account' })
  @Patch('me/deactivate')
  deactivateAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateAccount(user.sub);
  }

  @ApiOperation({ summary: 'Update account status of a user (Admin)' })
  @Roles(UserRole.ADMIN)
  @Patch(':id/account-status')
  updateAccountStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.usersService.updateAccountStatus(userId, dto.status);
  }
}
