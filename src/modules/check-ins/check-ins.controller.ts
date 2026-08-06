import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { ScanQrDto } from './dto/scan-qr.dto';
import { CheckInsService } from './check-ins.service';

@ApiTags('Check-Ins & QR')
@Controller('api/v1/qr')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @ApiOperation({ summary: 'Get food truck profile linked to a QR code' })
  @Get(':code/profile')
  getQrProfile(@Param('code') code: string) {
    return this.checkInsService.getQrProfile(code);
  }

  @ApiOperation({ summary: 'Record an anonymous QR code scan' })
  @Post(':code/scans')
  recordAnonymousQrScan(@Param('code') code: string, @Body() dto: ScanQrDto) {
    return this.checkInsService.recordQrScan(undefined, code, dto);
  }

  @ApiOperation({ summary: 'Record an authenticated user QR code scan' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':code/scans/authenticated')
  recordAuthenticatedQrScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: ScanQrDto,
  ) {
    return this.checkInsService.recordQrScan(user.sub, code, dto);
  }

  @ApiOperation({ summary: 'Check-in at a food truck using QR code (Customer)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':code/check-ins')
  createCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: CreateCheckInDto,
  ) {
    return this.checkInsService.createCheckIn(user.sub, code, dto);
  }
}

@ApiTags('Check-Ins & QR')
@ApiBearerAuth()
@Controller('api/v1/check-ins')
export class CheckInAnalyticsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @ApiOperation({ summary: 'Get QR scan and check-in analytics for a food truck (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('food-trucks/:foodTruckId/qr-analytics')
  getQrAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.checkInsService.getQrAnalytics(user.sub, foodTruckId);
  }
}
