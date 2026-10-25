import { ForbiddenException } from '@nestjs/common';
import { PostStatusDto } from './dto/create-post.dto';
import { SocialService } from './social.service';

describe('SocialService post publishing eligibility', () => {
  const vendorUserId = 'vendor-user-id';
  const truckId = 'truck-id';

  const activeTruck = {
    id: truckId,
    vendorId: 'vendor-id',
    status: 'ACTIVE',
    deletedAt: null,
    vendor: {
      userId: vendorUserId,
      status: 'APPROVED',
      isVerified: false,
      deletedAt: null,
    },
  };

  const createService = () => {
    const repository = {
      findAuthorIdentity: jest.fn().mockResolvedValue({
        id: vendorUserId,
        userRoles: [{ role: 'VENDOR' }],
        vendor: {
          id: 'vendor-id',
          status: 'APPROVED',
          foodTrucks: [{ id: truckId, status: 'ACTIVE' }],
        },
      }),
      findFoodTruckById: jest.fn().mockResolvedValue(activeTruck),
      createPost: jest.fn().mockResolvedValue({
        id: 'post-id',
        status: 'PUBLISHED',
      }),
      findPostById: jest.fn(),
      updatePost: jest.fn(),
    };
    const notifications = {
      notifyFoodTruckUpdate: jest.fn(),
    };
    const service = new SocialService(
      repository as never,
      notifications as never,
      {} as never,
      {} as never,
    );

    return { service, repository, notifications };
  };

  it('allows an active truck to publish a post', async () => {
    const { service, repository } = createService();

    await expect(
      service.createPost(vendorUserId, {
        content: 'Today special',
        status: PostStatusDto.PUBLISHED,
      }),
    ).resolves.toMatchObject({ id: 'post-id' });

    expect(repository.createPost).toHaveBeenCalled();
  });

  it.each(['DRAFT', 'INACTIVE', 'SUSPENDED'])(
    'blocks a %s truck from publishing a post',
    async (status) => {
      const { service, repository } = createService();
      repository.findFoodTruckById.mockResolvedValue({
        ...activeTruck,
        status,
      });

      await expect(
        service.createPost(vendorUserId, {
          content: 'Today special',
          status: PostStatusDto.PUBLISHED,
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Complete your food truck setup before publishing posts',
        ),
      );

      expect(repository.createPost).not.toHaveBeenCalled();
    },
  );

  it('blocks publishing an existing draft post when the truck is not active', async () => {
    const { service, repository } = createService();
    repository.findPostById.mockResolvedValue({
      id: 'post-id',
      authorUserId: vendorUserId,
      foodTruckId: truckId,
      content: 'Draft post',
      status: 'DRAFT',
      deletedAt: null,
      media: [],
      tags: [],
    });
    repository.findFoodTruckById.mockResolvedValue({
      ...activeTruck,
      status: 'DRAFT',
    });

    await expect(
      service.updatePost(vendorUserId, 'post-id', {
        status: PostStatusDto.PUBLISHED,
      }),
    ).rejects.toThrow('Complete your food truck setup before publishing posts');

    expect(repository.updatePost).not.toHaveBeenCalled();
  });

  it('keeps customer posts independent from truck status', async () => {
    const { service, repository } = createService();
    repository.findAuthorIdentity.mockResolvedValue({
      id: 'customer-user-id',
      userRoles: [{ role: 'CUSTOMER' }],
      vendor: null,
    });

    await service.createPost('customer-user-id', {
      content: 'Foodie post',
      status: PostStatusDto.PUBLISHED,
    });

    expect(repository.findFoodTruckById).not.toHaveBeenCalled();
    expect(repository.createPost).toHaveBeenCalledWith(
      'customer-user-id',
      {},
      expect.any(Object),
    );
  });
});
