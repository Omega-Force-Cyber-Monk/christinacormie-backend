import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResendEmailCodeDto } from './dto/resend-email-code.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new customer account' })
  @Post('register/customer')
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @ApiOperation({ summary: 'Register a new vendor account' })
  @Post('register/vendor')
  registerVendor(@Body() dto: RegisterVendorDto) {
    return this.authService.registerVendor(dto);
  }

  @ApiOperation({ summary: 'Verify email with a 6-digit code and activate account' })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @ApiOperation({ summary: 'Resend the registration email verification code' })
  @Post('resend-verification-code')
  resendVerificationCode(@Body() dto: ResendEmailCodeDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.sub, dto.refreshToken);
  }
}
