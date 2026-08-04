import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { addDuration } from '../../common/utils/date.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';

const PASSWORD_SALT_ROUNDS = 12;
type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
          status: AccountStatus.ACTIVE,
          userRoles: {
            create: [{ role: UserRole.CUSTOMER }],
          },
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              displayName: dto.displayName,
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

    return this.createAuthResponse(user);
  }

  async registerVendor(dto: RegisterVendorDto) {
    await this.ensureUniqueAccount(dto.email, dto.phone);
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          status: AccountStatus.ACTIVE,
          userRoles: {
            create: [{ role: UserRole.VENDOR }],
          },
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              displayName: dto.displayName,
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
              businessName: dto.businessName,
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

    return this.createAuthResponse(user);
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
