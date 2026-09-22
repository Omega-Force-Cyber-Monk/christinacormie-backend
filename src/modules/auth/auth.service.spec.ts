import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { FirebaseService } from '../../infrastructure/firebase/firebase.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuthService } from './auth.service';

describe('AuthService Firebase login', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    emailVerificationCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    passwordResetCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const mailService = {
    send: jest.fn(),
  } as unknown as MailService;

  const firebaseService = {
    verifyAuthToken: jest.fn(),
  } as unknown as FirebaseService;

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(prisma, jwtService, mailService, firebaseService);
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
    prisma.passwordResetCode.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operations: any) =>
      Promise.all(operations),
    );
  });

  it('creates a new customer account from Firebase Google and returns auth tokens', async () => {
    (firebaseService.verifyAuthToken as jest.Mock).mockResolvedValue({
      uid: 'firebase-user-1',
      email: 'user@example.com',
      email_verified: true,
      name: 'John Doe',
      picture: 'https://example.com/avatar.jpg',
      firebase: { sign_in_provider: 'google.com' },
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

    const result = await service.loginWithFirebase({
      idToken: 'firebase-token',
      role: UserRole.CUSTOMER,
    });

    expect(firebaseService.verifyAuthToken).toHaveBeenCalledWith(
      'firebase-token',
    );
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.roles).toEqual([UserRole.CUSTOMER]);
    expect(result.authFlow).toBe('SIGN_UP');
    expect(result.isNewUser).toBe(true);
    expect(result.onboarding.requiresProfileSetup).toBe(true);
  });

  it('rejects customer registration when the email is already registered', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
    });

    await expect(
      service.registerCustomer({
        name: 'John Doe',
        email: 'CUSTOMER@example.com',
        password: 'Password123!',
        dateOfBirth: new Date('1998-05-20'),
      }),
    ).rejects.toThrow(
      new ConflictException(
        'An account already exists with this email address',
      ),
    );
  });

  it('explains that pending accounts must verify email before login', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 1);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      passwordHash,
      status: AccountStatus.PENDING,
      userRoles: [{ role: UserRole.CUSTOMER }],
      profile: null,
      vendor: null,
    });

    await expect(
      service.login({
        email: 'customer@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Email verification is required before login. Please submit the 6-digit code sent to your email.',
      ),
    );
  });

  it('explains when the submitted email verification code is incorrect', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      emailVerifiedAt: null,
      status: AccountStatus.PENDING,
      userRoles: [{ role: UserRole.CUSTOMER }],
      profile: null,
      vendor: null,
    });
    prisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: 'code-1',
      codeHash: await bcrypt.hash('123456', 1),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });

    await expect(
      service.verifyEmailCode({
        email: 'customer@example.com',
        code: '654321',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Incorrect verification code. Please check the 6-digit code and try again.',
      ),
    );
  });

  it('sends a password reset code to an active password account', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      passwordHash: 'password-hash',
      status: AccountStatus.ACTIVE,
    });
    prisma.passwordResetCode.updateMany.mockResolvedValue({});
    prisma.passwordResetCode.create.mockResolvedValue({});
    (mailService.send as jest.Mock).mockResolvedValue({});

    await expect(
      service.forgotPassword('customer@example.com'),
    ).resolves.toEqual({
      success: true,
      message: 'Password reset code sent to your email.',
      email: 'customer@example.com',
    });

    expect(prisma.passwordResetCode.create).toHaveBeenCalled();
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Your BiteDrop password reset code',
      }),
    );
  });

  it('explains when the submitted password reset code is incorrect', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      passwordHash: 'password-hash',
      status: AccountStatus.ACTIVE,
    });
    prisma.passwordResetCode.findFirst.mockResolvedValue({
      id: 'code-1',
      codeHash: await bcrypt.hash('123456', 1),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });

    await expect(
      service.verifyResetCode({
        email: 'customer@example.com',
        code: '654321',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Incorrect password reset code. Please check the 6-digit code and try again.',
      ),
    );
  });

  it('resets password with a valid reset code and revokes refresh tokens', async () => {
    const passwordHash = await bcrypt.hash('OldPassword123!', 1);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.com',
      passwordHash,
      status: AccountStatus.ACTIVE,
    });
    prisma.passwordResetCode.findFirst.mockResolvedValue({
      id: 'code-1',
      codeHash: await bcrypt.hash('123456', 1),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });

    await expect(
      service.resetPassword({
        email: 'customer@example.com',
        code: '123456',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      }),
    ).resolves.toEqual({
      success: true,
      message:
        'Password reset successfully. Please login with your new password.',
    });

    expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
      where: { id: 'code-1' },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: expect.any(String) },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('creates draft vendor Firebase account without businessName and returns onboarding flags', async () => {
    (firebaseService.verifyAuthToken as jest.Mock).mockResolvedValue({
      uid: 'firebase-vendor-1',
      email: 'vendor@example.com',
      email_verified: true,
      name: 'Vendor Owner',
      firebase: { sign_in_provider: 'google.com' },
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'vendor-user-1',
      email: 'vendor@example.com',
      status: AccountStatus.ACTIVE,
      userRoles: [{ role: UserRole.VENDOR }],
      profile: {
        firstName: 'Vendor',
        lastName: 'Owner',
        displayName: 'Vendor Owner',
        avatarUrl: null,
        dateOfBirth: null,
      },
      settings: {},
      notificationPreference: {},
      vendor: {
        id: 'vendor-1',
        businessName: 'Vendor Owner',
        businessPhone: null,
        status: 'DRAFT',
      },
    });

    const result = await service.loginWithFirebase({
      idToken: 'firebase-token',
      role: UserRole.VENDOR,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendor: {
            create: expect.objectContaining({
              businessName: 'Vendor Owner',
              status: 'DRAFT',
            }),
          },
        }),
      }),
    );
    expect(result.authFlow).toBe('SIGN_UP');
    expect(result.isNewUser).toBe(true);
    expect(result.onboarding.requiresVendorOnboarding).toBe(true);
    expect(result.onboarding.missingFields).toEqual(
      expect.arrayContaining(['dateOfBirth', 'businessPhone']),
    );
  });
});
