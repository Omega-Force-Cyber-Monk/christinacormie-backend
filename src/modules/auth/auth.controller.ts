import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { LoginDto } from './dto/login.dto';
import { ResendEmailCodeDto } from './dto/resend-email-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const pendingVerificationExample = (email: string) => ({
  success: true,
  status: 'PENDING',
  message:
    'Registration successful. Verify the 6-digit code sent to your email.',
  email,
});

const codeSentExample = (message: string, email = 'customer@example.com') => ({
  success: true,
  message,
  email,
});

const simpleSuccessExample = (
  message = 'Operation completed successfully',
) => ({
  success: true,
  message,
});

const authResponseExample = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  user: {
    id: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
    email: 'customer@example.com',
    displayName: 'John Doe',
    roles: ['CUSTOMER'],
  },
};

const firebaseAuthResponseExample = {
  ...authResponseExample,
  authFlow: 'SIGN_UP',
  isNewUser: true,
  onboarding: {
    requiresProfileSetup: true,
    requiresVendorOnboarding: false,
    nextStep: 'PROFILE_SETUP',
    missingFields: ['dateOfBirth'],
  },
};

const vendorAuthResponseExample = {
  ...authResponseExample,
  user: {
    id: '12441f40-2dc9-456d-948a-c33135359c70',
    email: 'vendor@example.com',
    displayName: 'Taco Owner',
    roles: ['VENDOR'],
    vendor: {
      id: '12441f40-2dc9-456d-948a-c33135359c70',
      businessName: 'Taco Paradise',
    },
  },
  authFlow: 'SIGN_UP',
  isNewUser: true,
  onboarding: {
    requiresProfileSetup: true,
    requiresVendorOnboarding: true,
    nextStep: 'PROFILE_SETUP',
    missingFields: ['dateOfBirth', 'businessPhone'],
  },
};

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({
    status: 201,
    description:
      'Customer registration accepted. A 6-digit email verification code was sent.',
    schema: {
      example: pendingVerificationExample('customer@example.com'),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body or verification email delivery failed.',
    schema: {
      example: errorExample(
        400,
        ['name must be longer than or equal to 2 characters'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email address is already registered.',
    schema: {
      example: errorExample(
        409,
        'An account already exists with this email address',
        'Conflict',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Account was saved, but verification email could not be sent.',
    schema: {
      example: errorExample(
        500,
        'Registration was saved, but the verification email could not be sent. Please try resending the code.',
        'Internal Server Error',
      ),
    },
  })
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @Post('register/customer')
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @ApiOperation({ summary: 'Register a new vendor account' })
  @ApiResponse({
    status: 201,
    description:
      'Vendor registration accepted. A 6-digit email verification code was sent.',
    schema: {
      example: pendingVerificationExample('vendor@example.com'),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body or verification email delivery failed.',
    schema: {
      example: errorExample(
        400,
        ['phone must be a valid phone number'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email address or phone number is already registered.',
    schema: {
      example: errorExample(
        409,
        'An account already exists with this phone number',
        'Conflict',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Account was saved, but verification email could not be sent.',
    schema: {
      example: errorExample(
        500,
        'Registration was saved, but the verification email could not be sent. Please try resending the code.',
        'Internal Server Error',
      ),
    },
  })
  @ApiBody({
    type: RegisterVendorDto,
    examples: {
      minimal: {
        summary: 'Minimal Vendor Signup (Required Fields Only)',
        value: {
          email: 'vendor@example.com',
          phone: '+12025550199',
          password: 'Password123!',
        },
      },
      full: {
        summary: 'Full Vendor Signup (Optional Profile & Business Details)',
        value: {
          email: 'vendor@example.com',
          phone: '+12025550199',
          password: 'Password123!',
          dateOfBirth: '1994-08-12',
          businessName: 'Tasty Tacos Food Truck',
          businessEmail: 'contact@tastytacos.com',
          businessPhone: '+12025550199',
          description: 'Best gourmet tacos in town',
          websiteUrl: 'https://tastytacos.example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'JaneSmith',
          timezone: 'America/New_York',
        },
      },
    },
  })
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @Post('register/vendor')
  registerVendor(@Body() dto: RegisterVendorDto) {
    return this.authService.registerVendor(dto);
  }

  @ApiOperation({
    summary: 'Verify email with a 6-digit code and activate account',
  })
  @ApiResponse({
    status: 201,
    description:
      'Email verified successfully. Returns access and refresh tokens.',
    schema: {
      example: authResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Code is missing, incorrect, expired, or already verified.',
    schema: {
      example: errorExample(
        400,
        'Incorrect verification code. Please check the 6-digit code and try again.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No account exists for the submitted email.',
    schema: {
      example: errorExample(
        404,
        'No account found for this email address',
        'Not Found',
      ),
    },
  })
  @Throttle({ default: { ttl: 5 * 60_000, limit: 10 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @ApiOperation({ summary: 'Resend the registration email verification code' })
  @ApiResponse({
    status: 201,
    description: 'A fresh 6-digit email verification code was sent.',
    schema: {
      example: codeSentExample(
        'Verification code sent to your email.',
        'customer@example.com',
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email is already verified.',
    schema: {
      example: errorExample(
        400,
        'Email is already verified. Please login.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No account exists for the submitted email.',
    schema: {
      example: errorExample(
        404,
        'No account found for this email address',
        'Not Found',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Verification email could not be sent.',
    schema: {
      example: errorExample(
        500,
        'Registration was saved, but the verification email could not be sent. Please try resending the code.',
        'Internal Server Error',
      ),
    },
  })
  @Throttle({ default: { ttl: 10 * 60_000, limit: 3 } })
  @Post('resend-verification-code')
  resendVerificationCode(@Body() dto: ResendEmailCodeDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 201,
    description: 'Login successful. Returns access and refresh tokens.',
    schema: {
      example: authResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email verification is required before login.',
    schema: {
      example: errorExample(
        400,
        'Email verification is required before login. Please submit the 6-digit code sent to your email.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email or password is incorrect.',
    schema: {
      example: errorExample(401, 'Invalid email or password', 'Unauthorized'),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Account is suspended, deactivated, or blocked.',
    schema: {
      example: errorExample(
        403,
        'This account is suspended. Please contact support.',
        'Forbidden',
      ),
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Login staff account with email and 4-digit PIN' })
  @ApiResponse({
    status: 201,
    description: 'Staff login successful. Returns access and refresh tokens.',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        user: {
          id: 'staff-user-id',
          email: 'maria@example.com',
          displayName: 'maria',
          roles: ['VENDOR_STAFF'],
          staff: {
            id: 'staff-id',
            vendorId: 'vendor-id',
            businessName: 'Taco Paradise',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email/PIN is incorrect or staff account is inactive.',
    schema: {
      example: errorExample(401, 'Invalid email or PIN', 'Unauthorized'),
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('staff/login')
  staffLogin(@Body() dto: StaffLoginDto) {
    return this.authService.staffLogin(dto);
  }

  @ApiOperation({ summary: 'Send a 6-digit password reset code to email' })
  @ApiResponse({
    status: 201,
    description: 'Password reset code was sent to the account email.',
    schema: {
      example: codeSentExample(
        'Password reset code sent to your email.',
        'customer@example.com',
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Account cannot reset password with email code.',
    schema: {
      example: errorExample(
        400,
        'This account uses Firebase social sign-in. Please continue with Google or Apple sign-in.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Account is suspended, deactivated, or blocked.',
    schema: {
      example: errorExample(
        403,
        'This account is suspended. Please contact support.',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No account exists for the submitted email.',
    schema: {
      example: errorExample(
        404,
        'No account found for this email address',
        'Not Found',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Password reset email could not be sent.',
    schema: {
      example: errorExample(
        500,
        'Password reset code was created, but the email could not be sent. Please try again.',
        'Internal Server Error',
      ),
    },
  })
  @Throttle({ default: { ttl: 10 * 60_000, limit: 3 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({ summary: 'Verify a 6-digit password reset code' })
  @ApiResponse({
    status: 201,
    description: 'Password reset code verified.',
    schema: {
      example: codeSentExample(
        'Password reset code verified. You can now set a new password.',
        'customer@example.com',
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Reset code is missing, incorrect, expired, or already used.',
    schema: {
      example: errorExample(
        400,
        'Incorrect password reset code. Please check the 6-digit code and try again.',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No account exists for the submitted email.',
    schema: {
      example: errorExample(
        404,
        'No account found for this email address',
        'Not Found',
      ),
    },
  })
  @Throttle({ default: { ttl: 5 * 60_000, limit: 10 } })
  @Post('verify-reset-code')
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @ApiOperation({ summary: 'Set a new password using a verified reset code' })
  @ApiResponse({
    status: 201,
    description:
      'Password reset successfully. Existing refresh tokens are revoked.',
    schema: {
      example: simpleSuccessExample(
        'Password reset successfully. Please login with your new password.',
      ),
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Password confirmation fails, password is weak, or reset code is invalid.',
    schema: {
      example: errorExample(
        400,
        'New password and confirm password do not match',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No account exists for the submitted email.',
    schema: {
      example: errorExample(
        404,
        'No account found for this email address',
        'Not Found',
      ),
    },
  })
  @Throttle({ default: { ttl: 10 * 60_000, limit: 5 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({
    summary: 'Login or register with Firebase Auth ID token',
    description:
      'Use this for Flutter Firebase Auth. Supports Firebase Google and Apple sign-in tokens. Backend detects login vs signup using firebaseUid/email and returns onboarding flags for app navigation.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Firebase login/signup successful. Returns access and refresh tokens.',
    schema: {
      example: firebaseAuthResponseExample,
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Firebase auth is not configured, unsupported provider, unverified email, or invalid request body.',
    schema: {
      example: errorExample(
        400,
        'Only Google and Apple Firebase sign-in are supported',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Firebase token is missing, invalid, or expired.',
    schema: {
      example: errorExample(
        401,
        'Invalid or expired Firebase ID token',
        'Unauthorized',
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email is already linked to another Firebase account.',
    schema: {
      example: errorExample(
        409,
        'This email is already linked to another Firebase account',
        'Conflict',
      ),
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('firebase')
  loginWithFirebase(@Body() dto: FirebaseAuthDto) {
    return this.authService.loginWithFirebase(dto);
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 201,
    description:
      'Refresh successful. Old refresh token is revoked and new tokens are returned.',
    schema: {
      example: authResponseExample,
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is invalid, expired, revoked, or mismatched.',
    schema: {
      example: errorExample(
        401,
        'Invalid or expired refresh token',
        'Unauthorized',
      ),
    },
  })
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Logout successful. Refresh token is revoked if valid.',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: {
      example: errorExample(401, 'Unauthorized', 'Unauthorized'),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Refresh token belongs to a different authenticated user.',
    schema: {
      example: errorExample(
        403,
        'Refresh token does not belong to this user',
        'Forbidden',
      ),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Password changed successfully.',
    schema: {
      example: simpleSuccessExample('Password changed successfully'),
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Password confirmation fails, account has no password, or new password matches old password.',
    schema: {
      example: errorExample(
        400,
        'New password and confirm password do not match',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description:
      'Access token is missing/invalid, or current password is incorrect.',
    schema: {
      example: errorExample(
        401,
        'Current password is incorrect',
        'Unauthorized',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: {
      example: errorExample(404, 'User not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }
}
