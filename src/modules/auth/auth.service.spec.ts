import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuthService } from './auth.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('AuthService Google login', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  } as any;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const googleTokenVerifier = {
    verifyIdToken: jest.fn(),
  } as unknown as GoogleTokenVerifierService;

  const mailService = {
    send: jest.fn(),
  } as unknown as MailService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwtService, googleTokenVerifier, mailService);
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
  });

  it('creates a new customer account from Google and returns auth tokens', async () => {
    (googleTokenVerifier.verifyIdToken as jest.Mock).mockResolvedValue({
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      phone: null,
      status: AccountStatus.ACTIVE,
      userRoles: [{ role: UserRole.CUSTOMER }],
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      settings: {},
      notificationPreference: {},
      vendor: null,
    });

    const result = await service.loginWithGoogle({
      idToken: 'google-token',
      role: UserRole.CUSTOMER,
    });

    expect(googleTokenVerifier.verifyIdToken).toHaveBeenCalledWith('google-token');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.roles).toEqual([UserRole.CUSTOMER]);
  });

  it('rejects new vendor Google sign-in without businessName', async () => {
    (googleTokenVerifier.verifyIdToken as jest.Mock).mockResolvedValue({
      email: 'vendor@example.com',
      emailVerified: true,
    });
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.loginWithGoogle({
        idToken: 'google-token',
        role: UserRole.VENDOR,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'businessName is required for vendor Google sign-in registration',
      ),
    );
  });
});
