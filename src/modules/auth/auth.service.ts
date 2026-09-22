import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { addDuration } from '../../common/utils/date.util';
import { MailService } from '../../infrastructure/mail/mail.service';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FirebaseAuthDto } from './dto/firebase-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';

const PASSWORD_SALT_ROUNDS = 12;
const VERIFICATION_CODE_TTL = '10m';
const PASSWORD_RESET_CODE_TTL = '10m';
const VERIFICATION_CODE_LENGTH = 6;
type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    await this.ensureUniqueAccount(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const profileName = this.parseProfileName(dto.name);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          status: AccountStatus.PENDING,
          userRoles: {
            create: [{ role: UserRole.CUSTOMER }],
          },
          profile: {
            create: {
              firstName: profileName.firstName,
              lastName: profileName.lastName,
              displayName: dto.name,
              dateOfBirth: dto.dateOfBirth,
            },
          },
          settings: {
            create: {},
          },
          notificationPreference: {
            create: {},
          },
        },
        include: this.authUserInclude(),
      });

      return createdUser;
    });

    await this.issueEmailVerificationCode(user.id, user.email);
    return this.toPendingVerificationResponse(user.email);
  }

  async registerVendor(dto: RegisterVendorDto) {
    await this.ensureUniqueAccount(dto.email, dto.phone);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const businessName =
      (dto.businessName ??
        dto.displayName ??
        `${dto.firstName ?? 'Vendor'} ${dto.lastName ?? ''}`.trim()) ||
      dto.email.split('@')[0];

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          status: AccountStatus.PENDING,
          userRoles: {
            create: [{ role: UserRole.VENDOR }],
          },
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              displayName: dto.displayName,
              dateOfBirth: dto.dateOfBirth,
            },
          },
          settings: {
            create: {
              timezone: dto.timezone,
            },
          },
          notificationPreference: {
            create: {},
          },
          vendor: {
            create: {
              businessName,
              businessEmail: dto.businessEmail ?? dto.email.toLowerCase(),
              businessPhone: dto.businessPhone ?? dto.phone,
              description: dto.description,
              websiteUrl: dto.websiteUrl,
              status: 'DRAFT',
            },
          },
        },
        include: this.authUserInclude(),
      });

      return createdUser;
    });

    await this.issueEmailVerificationCode(user.id, user.email);
    return this.toPendingVerificationResponse(user.email);
  }

  async verifyEmailCode(dto: VerifyEmailCodeDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
      include: this.authUserInclude(),
    });

    if (!user) {
      throw new NotFoundException('No account found for this email address');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified. Please login.');
    }

    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verificationCode) {
      throw new BadRequestException(
        'No active verification code found. Please request a new code.',
      );
    }

    if (verificationCode.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new code.',
      );
    }

    const codeMatches = await bcrypt.compare(
      dto.code,
      verificationCode.codeHash,
    );

    if (!codeMatches) {
      throw new BadRequestException(
        'Incorrect verification code. Please check the 6-digit code and try again.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    const activatedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: this.authUserInclude(),
    });

    return this.createAuthResponse(activatedUser);
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('No account found for this email address');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified. Please login.');
    }

    await this.issueEmailVerificationCode(user.id, user.email);

    return this.toPendingVerificationResponse(user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
      include: this.authUserInclude(),
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.ensureAccountCanAuthenticate(user.status);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createAuthResponse(user);
  }

  async staffLogin(dto: StaffLoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
      include: this.authUserInclude(),
    });

    const staff = user?.vendorStaff;

    if (!user || !staff || staff.deletedAt || staff.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or PIN');
    }

    const pinMatches = await bcrypt.compare(dto.pin, staff.pinHash);

    if (!pinMatches) {
      throw new UnauthorizedException('Invalid email or PIN');
    }

    this.ensureAccountCanAuthenticate(user.status);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createAuthResponse(user);
  }

  async forgotPassword(email: string) {
    const user = await this.getPasswordResetUser(email);

    await this.issuePasswordResetCode(user.id, user.email);

    return {
      success: true,
      message: 'Password reset code sent to your email.',
      email: user.email,
    };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    const user = await this.getPasswordResetUser(dto.email);

    await this.getValidPasswordResetCode(user.id, dto.code);

    return {
      success: true,
      message: 'Password reset code verified. You can now set a new password.',
      email: user.email,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    const user = await this.getPasswordResetUser(dto.email);
    const resetCode = await this.getValidPasswordResetCode(user.id, dto.code);

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash!,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );

    await this.prisma.$transaction([
      this.prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      message:
        'Password reset successfully. Please login with your new password.',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.confirmNewPassword && dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Account was created via social login and has no password set',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async loginWithFirebase(dto: FirebaseAuthDto) {
    const decoded = await this.firebaseService.verifyAuthToken(dto.idToken);
    const provider = decoded.firebase?.sign_in_provider ?? 'firebase';

    if (!['google.com', 'apple.com'].includes(provider)) {
      throw new BadRequestException(
        'Only Google and Apple Firebase sign-in are supported',
      );
    }

    const email = decoded.email?.toLowerCase() ?? null;
    if (email && decoded.email_verified === false) {
      throw new BadRequestException('Firebase account email is not verified');
    }

    const authProvider = provider === 'apple.com' ? 'apple' : 'google';
    const lookupConditions = [
      { firebaseUid: decoded.uid },
      ...(email ? [{ email }] : []),
    ];

    let user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: lookupConditions,
      },
      include: this.authUserInclude(),
    });

    if (user?.firebaseUid && user.firebaseUid !== decoded.uid) {
      throw new ConflictException(
        'This email is already linked to another Firebase account',
      );
    }

    if (!user) {
      const requestedRole = dto.role ?? UserRole.CUSTOMER;

      if (requestedRole === UserRole.ADMIN) {
        throw new ForbiddenException(
          'Admin accounts cannot be created with Firebase sign-in',
        );
      }

      if (requestedRole === UserRole.VENDOR && !dto.businessName) {
        throw new BadRequestException(
          'Business name is required when registering as a vendor with Firebase sign-in',
        );
      }

      const displayName =
        decoded.name ?? email?.split('@')[0] ?? `${authProvider} user`;
      const profileName = this.parseProfileName(displayName);

      user = await this.prisma.user.create({
        data: {
          email,
          firebaseUid: decoded.uid,
          authProvider,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: email ? new Date() : null,
          userRoles: {
            create: [{ role: requestedRole }],
          },
          profile: {
            create: {
              firstName: profileName.firstName,
              lastName: profileName.lastName,
              displayName,
              avatarUrl: decoded.picture,
              dateOfBirth: dto.dateOfBirth,
            },
          },
          settings: {
            create: {},
          },
          notificationPreference: {
            create: {},
          },
          ...(requestedRole === UserRole.VENDOR
            ? {
                vendor: {
                  create: {
                    businessName: dto.businessName!,
                    businessEmail: email,
                    status: 'DRAFT',
                  },
                },
              }
            : {}),
        },
        include: this.authUserInclude(),
      });
    } else {
      this.ensureAccountCanAuthenticate(user.status);

      const displayName =
        decoded.name ??
        user.profile?.displayName ??
        email?.split('@')[0] ??
        `${authProvider} user`;
      const profileName = this.parseProfileName(displayName);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: user.firebaseUid ?? decoded.uid,
          authProvider: user.authProvider ?? authProvider,
          emailVerifiedAt: user.emailVerifiedAt ?? (email ? new Date() : null),
          lastLoginAt: new Date(),
          profile: {
            upsert: {
              create: {
                firstName: profileName.firstName,
                lastName: profileName.lastName,
                displayName,
                avatarUrl: decoded.picture,
                dateOfBirth: dto.dateOfBirth,
              },
              update: {
                ...(user.profile?.firstName
                  ? {}
                  : { firstName: profileName.firstName }),
                ...(user.profile?.lastName
                  ? {}
                  : { lastName: profileName.lastName }),
                ...(user.profile?.displayName ? {} : { displayName }),
                ...(user.profile?.avatarUrl || !decoded.picture
                  ? {}
                  : { avatarUrl: decoded.picture }),
                ...(user.profile?.dateOfBirth || !dto.dateOfBirth
                  ? {}
                  : { dateOfBirth: dto.dateOfBirth }),
              },
            },
          },
        },
      });

      user = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: this.authUserInclude(),
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenId: payload.jti },
      include: {
        user: {
          include: this.authUserInclude(),
        },
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.userId !== payload.sub ||
      tokenRecord.revokedAt ||
      tokenRecord.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      tokenRecord.tokenHash,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    this.ensureAccountCanAuthenticate(tokenRecord.user.status);

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.createAuthResponse(tokenRecord.user);
  }

  async logout(userId: string, refreshToken: string) {
    let payload: { sub: string; jti: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      return { success: true };
    }

    if (payload.sub !== userId) {
      throw new ForbiddenException(
        'Refresh token does not belong to this user',
      );
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenId: payload.jti,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async createAuthResponse(user: any) {
    const roles = this.getRoles(user);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        roles,
      },
      {
        secret: this.accessSecret(),
        expiresIn: this.accessTokenTtl(),
      },
    );

    const refreshTokenId = randomUUID();
    const refreshTokenTtl = this.refreshTokenTtl();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti: refreshTokenId,
      },
      {
        secret: this.refreshSecret(),
        expiresIn: refreshTokenTtl,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenId: refreshTokenId,
        tokenHash: await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS),
        expiresAt: addDuration(new Date(), refreshTokenTtl),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private async ensureUniqueAccount(email: string, phone?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, ...(phone ? [{ phone }] : [])],
      },
    });

    if (existingUser) {
      const normalizedEmail = email.toLowerCase();

      if (existingUser.email?.toLowerCase() === normalizedEmail) {
        throw new ConflictException(
          'An account already exists with this email address',
        );
      }

      throw new ConflictException(
        'An account already exists with this phone number',
      );
    }
  }

  private async issueEmailVerificationCode(
    userId: string,
    email: string | null,
  ) {
    if (!email) {
      throw new BadRequestException(
        'Email verification requires an email address',
      );
    }

    const code = this.createVerificationCode();
    const codeHash = await bcrypt.hash(code, PASSWORD_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.updateMany({
        where: {
          userId,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationCode.create({
        data: {
          userId,
          codeHash,
          expiresAt: addDuration(new Date(), VERIFICATION_CODE_TTL),
        },
      }),
    ]);

    this.logger.log(`Email verification code for ${email}: ${code}`);

    try {
      await this.mailService.send({
        to: email,
        subject: 'Your BiteDrop verification code',
        text: `Your BiteDrop verification code is ${code}. It will expire in 10 minutes.`,
        html: `<p>Your BiteDrop verification code is <strong>${code}</strong>.</p><p>It will expire in 10 minutes.</p>`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email delivery error';
      this.logger.error(
        `Failed to deliver verification email to ${email}: ${message}`,
      );
      throw new InternalServerErrorException(
        'Registration was saved, but the verification email could not be sent. Please try resending the code.',
      );
    }
  }

  private async issuePasswordResetCode(userId: string, email: string | null) {
    if (!email) {
      throw new BadRequestException('Password reset requires an email address');
    }

    const code = this.createVerificationCode();
    const codeHash = await bcrypt.hash(code, PASSWORD_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordResetCode.updateMany({
        where: {
          userId,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.passwordResetCode.create({
        data: {
          userId,
          codeHash,
          expiresAt: addDuration(new Date(), PASSWORD_RESET_CODE_TTL),
        },
      }),
    ]);

    this.logger.log(`Password reset code for ${email}: ${code}`);

    try {
      await this.mailService.send({
        to: email,
        subject: 'Your BiteDrop password reset code',
        text: `Your BiteDrop password reset code is ${code}. It will expire in 10 minutes.`,
        html: `<p>Your BiteDrop password reset code is <strong>${code}</strong>.</p><p>It will expire in 10 minutes.</p>`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email delivery error';
      this.logger.error(
        `Failed to deliver password reset email to ${email}: ${message}`,
      );
      throw new InternalServerErrorException(
        'Password reset code was created, but the email could not be sent. Please try again.',
      );
    }
  }

  private async getPasswordResetUser(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('No account found for this email address');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Firebase social sign-in. Please continue with Google or Apple sign-in.',
      );
    }

    this.ensureAccountCanResetPassword(user.status);

    return user;
  }

  private async getValidPasswordResetCode(userId: string, code: string) {
    const resetCode = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!resetCode) {
      throw new BadRequestException(
        'No active password reset code found. Please request a new code.',
      );
    }

    if (resetCode.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Password reset code has expired. Please request a new code.',
      );
    }

    const codeMatches = await bcrypt.compare(code, resetCode.codeHash);

    if (!codeMatches) {
      throw new BadRequestException(
        'Incorrect password reset code. Please check the 6-digit code and try again.',
      );
    }

    return resetCode;
  }

  private createVerificationCode() {
    return Math.floor(
      10 ** (VERIFICATION_CODE_LENGTH - 1) +
        Math.random() * 9 * 10 ** (VERIFICATION_CODE_LENGTH - 1),
    ).toString();
  }

  private parseProfileName(name: string) {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const [firstName, ...lastNameParts] = normalizedName.split(' ');

    return {
      firstName,
      lastName: lastNameParts.join(' ') || undefined,
    };
  }

  private toPendingVerificationResponse(email: string | null) {
    return {
      success: true,
      status: AccountStatus.PENDING,
      message:
        'Registration successful. Verify the 6-digit code sent to your email.',
      email,
    };
  }

  private ensureAccountCanAuthenticate(status: string) {
    if (
      [
        AccountStatus.SUSPENDED,
        AccountStatus.DEACTIVATED,
        AccountStatus.BLOCKED,
      ].includes(status as AccountStatus)
    ) {
      throw new ForbiddenException(
        `This account is ${status.toLowerCase()}. Please contact support.`,
      );
    }

    if (status === AccountStatus.PENDING) {
      throw new BadRequestException(
        'Email verification is required before login. Please submit the 6-digit code sent to your email.',
      );
    }
  }

  private ensureAccountCanResetPassword(status: string) {
    if (
      [
        AccountStatus.SUSPENDED,
        AccountStatus.DEACTIVATED,
        AccountStatus.BLOCKED,
      ].includes(status as AccountStatus)
    ) {
      throw new ForbiddenException(
        `This account is ${status.toLowerCase()}. Please contact support.`,
      );
    }

    if (status === AccountStatus.PENDING) {
      throw new BadRequestException(
        'Email verification is required before resetting password. Please verify your account first.',
      );
    }
  }

  private toAuthUser(user: any) {
    const roles = this.getRoles(user);
    const isVendor = roles.includes(UserRole.VENDOR);
    const isStaff = roles.includes(UserRole.VENDOR_STAFF);

    const displayName =
      (user.profile?.displayName ??
        `${user.profile?.firstName ?? ''} ${user.profile?.lastName ?? ''}`.trim()) ||
      user.email?.split('@')[0] ||
      'User';

    return {
      id: user.id,
      email: user.email,
      displayName,
      roles,
      ...(isVendor && user.vendor
        ? {
            vendor: {
              id: user.vendor.id,
              businessName: user.vendor.businessName,
            },
          }
        : {}),
      ...(isStaff && user.vendorStaff
        ? {
            staff: {
              id: user.vendorStaff.id,
              vendorId: user.vendorStaff.vendorId,
              businessName: user.vendorStaff.vendor?.businessName,
            },
          }
        : {}),
    };
  }

  private getRoles(user: any): UserRole[] {
    return (user.userRoles ?? []).map((userRole) => userRole.role);
  }

  private authUserInclude() {
    return {
      userRoles: true,
      profile: true,
      vendor: true,
      vendorStaff: {
        include: {
          vendor: true,
        },
      },
    };
  }

  private accessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  }

  private refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  }

  private accessTokenTtl(): JwtDuration {
    return (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as JwtDuration;
  }

  private refreshTokenTtl(): JwtDuration {
    return (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as JwtDuration;
  }
}
