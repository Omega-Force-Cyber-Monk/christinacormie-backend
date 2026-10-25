import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService.updateProfile', () => {
  const userId = 'user-id';

  const createService = () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          email: 'current@example.com',
          phone: '+12025550100',
          deletedAt: null,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };
    const service = new UsersService(
      prisma as never,
      { awardPoints: jest.fn() } as never,
      {} as never,
    );

    return { service, prisma };
  };

  it('returns a clear conflict when the phone belongs to another account', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue({
      email: 'other@example.com',
      phone: '+12025550199',
    });

    await expect(
      service.updateProfile(userId, { phone: '+12025550199' }),
    ).rejects.toEqual(
      new ConflictException(
        'Phone number is already in use by another account',
      ),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns a clear conflict when the email belongs to another account', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue({
      email: 'taken@example.com',
      phone: null,
    });

    await expect(
      service.updateProfile(userId, { email: 'TAKEN@example.com' }),
    ).rejects.toEqual(
      new ConflictException(
        'Email address is already in use by another account',
      ),
    );
  });

  it('does not write unchanged email and phone values', async () => {
    const { service, prisma } = createService();
    const profile = {
      userId,
      displayName: 'Updated Name',
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      avatarUrl: null,
      bio: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
    };
    const tx = {
      user: { update: jest.fn() },
      userProfile: { upsert: jest.fn().mockResolvedValue(profile) },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await service.updateProfile(userId, {
      email: 'CURRENT@example.com',
      phone: '+12025550100',
      displayName: 'Updated Name',
    });

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userProfile.upsert).toHaveBeenCalled();
  });
});
