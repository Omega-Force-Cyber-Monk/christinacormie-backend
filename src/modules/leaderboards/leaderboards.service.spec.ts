import { LeaderboardsRepository } from './leaderboards.repository';
import { LeaderboardsService } from './leaderboards.service';

describe('LeaderboardsService foodie points', () => {
  const findFoodiePoints = jest.fn();
  const service = new LeaderboardsService({
    findFoodiePoints,
  } as unknown as LeaderboardsRepository);

  beforeEach(() => jest.clearAllMocks());

  it('returns lifetime-points ranks with offset pagination', async () => {
    findFoodiePoints.mockResolvedValue({
      items: [
        {
          userId: 'user-2',
          lifetimePoints: 1750,
          user: {
            profile: {
              displayName: 'Alex Rivera',
              firstName: null,
              lastName: null,
              avatarUrl: 'https://cdn.example.com/alex.jpg',
            },
          },
        },
      ],
      total: 5,
    });

    await expect(
      service.getFoodiePoints({ limit: 1, offset: 1 }),
    ).resolves.toEqual({
      items: [
        {
          rank: 2,
          userId: 'user-2',
          displayName: 'Alex Rivera',
          avatarUrl: 'https://cdn.example.com/alex.jpg',
          points: 1750,
        },
      ],
      total: 5,
      limit: 1,
      offset: 1,
      nextOffset: 2,
    });
    expect(findFoodiePoints).toHaveBeenCalledWith(1, 1);
  });

  it('falls back to the profile name and ends pagination', async () => {
    findFoodiePoints.mockResolvedValue({
      items: [
        {
          userId: 'user-1',
          lifetimePoints: 500,
          user: {
            profile: {
              displayName: null,
              firstName: 'Megan',
              lastName: 'Rapinoe',
              avatarUrl: null,
            },
          },
        },
      ],
      total: 1,
    });

    const result = await service.getFoodiePoints({});

    expect(result.items[0]).toMatchObject({
      rank: 1,
      displayName: 'Megan Rapinoe',
      points: 500,
    });
    expect(result.nextOffset).toBeNull();
  });
});
