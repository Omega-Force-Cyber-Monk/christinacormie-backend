import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';

const PASSWORD_SALT_ROUNDS = 12;
const VERIFICATION_CODE_TTL = '10m';
const VERIFICATION_CODE_LENGTH = 6;
type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly googleTokenVerifier: GoogleTokenVerifierService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    await this.ensureUniqueAccount(dto.email, dto.phone);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          status: AccountStatus.PENDING,
          userRoles: {
            create: [{ role: UserRole.CUSTOMER }],
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
      throw new NotFoundException('Account not found');
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

    if (!verificationCode || verificationCode.expiresAt <= new Date()) {
      throw new BadRequestException('Verification code is invalid or expired');
    }

    const codeMatches = await bcrypt.compare(dto.code, verificationCode.codeHash);

    if (!codeMatches) {
      throw new BadRequestException('Verification code is invalid or expired');
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
      throw new NotFoundException('Account not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
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

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

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

  async loginWithGoogle(dto: GoogleAuthDto) {
    const googleProfile = await this.googleTokenVerifier.verifyIdToken(dto.idToken);

    let user = await this.prisma.user.findFirst({
      where: {
        email: googleProfile.email,
        deletedAt: null,
      },
      include: this.authUserInclude(),
    });

    if (!user) {
      const requestedRole = dto.role ?? UserRole.CUSTOMER;

      if (requestedRole === UserRole.ADMIN) {
        throw new ForbiddenException('Admin accounts cannot be created with Google sign-in');
      }

      if (requestedRole === UserRole.VENDOR && !dto.businessName) {
        throw new BadRequestException(
          'businessName is required for vendor Google sign-in registration',
        );
      }

      user = await this.prisma.user.create({
        data: {
          email: googleProfile.email,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          userRoles: {
            create: [{ role: requestedRole }],
          },
          profile: {
            create: {
              firstName: googleProfile.firstName ?? undefined,
              lastName: googleProfile.lastName ?? undefined,
              displayName: googleProfile.displayName ?? undefined,
              avatarUrl: googleProfile.avatarUrl ?? undefined,
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
                    businessEmail: googleProfile.email,
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

      const shouldUpdateProfile =
        !user.profile?.firstName ||
        !user.profile?.lastName ||
        !user.profile?.displayName ||
        !user.profile?.avatarUrl;

      if (shouldUpdateProfile || !user.emailVerifiedAt) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            profile: {
              upsert: {
                create: {
                  firstName: googleProfile.firstName ?? undefined,
                  lastName: googleProfile.lastName ?? undefined,
                  displayName: googleProfile.displayName ?? undefined,
                  avatarUrl: googleProfile.avatarUrl ?? undefined,
                  dateOfBirth: dto.dateOfBirth,
                },
                update: {
                  ...(user.profile?.firstName ? {} : { firstName: googleProfile.firstName ?? undefined }),
                  ...(user.profile?.lastName ? {} : { lastName: googleProfile.lastName ?? undefined }),
                  ...(user.profile?.displayName ? {} : { displayName: googleProfile.displayName ?? undefined }),
                  ...(user.profile?.avatarUrl ? {} : { avatarUrl: googleProfile.avatarUrl ?? undefined }),
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

    const tokenMatches = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);

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
      throw new ForbiddenException('Refresh token does not belong to this user');
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
        OR: [
          { email: email.toLowerCase() },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('An account already exists with this email or phone');
    }
  }

  private async issueEmailVerificationCode(userId: string, email: string | null) {
    if (!email) {
      throw new BadRequestException('Email verification requires an email address');
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
  }

  private createVerificationCode() {
    return Math.floor(
      10 ** (VERIFICATION_CODE_LENGTH - 1) +
        Math.random() * 9 * 10 ** (VERIFICATION_CODE_LENGTH - 1),
    ).toString();
  }

  private toPendingVerificationResponse(email: string | null) {
    return {
      success: true,
      status: AccountStatus.PENDING,
      message: 'Registration successful. Verify the 6-digit code sent to your email.',
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
      throw new ForbiddenException(`Account is ${status.toLowerCase()}`);
    }

    if (status === AccountStatus.PENDING) {
      throw new BadRequestException('Account is pending activation');
    }
  }

  private toAuthUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: this.getRoles(user),
      profile: user.profile,
      settings: user.settings,
      notificationPreference: user.notificationPreference,
      vendor: user.vendor,
    };
  }

  private getRoles(user: any): UserRole[] {
    return (user.userRoles ?? []).map((userRole) => userRole.role);
  }

  private authUserInclude() {
    return {
      userRoles: true,
      profile: true,
      settings: true,
      notificationPreference: true,
      vendor: true,
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
