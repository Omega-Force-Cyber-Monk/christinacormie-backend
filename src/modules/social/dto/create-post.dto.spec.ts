import { validate } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

describe('CreatePostDto', () => {
  it('allows a Foodie post without a foodTruckId', async () => {
    const dto = Object.assign(new CreatePostDto(), {
      content: 'A Foodie post',
      taggedUserIds: [],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects captions longer than 2,200 characters', async () => {
    const dto = Object.assign(new CreatePostDto(), {
      content: 'a'.repeat(2201),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'content')).toBe(true);
  });

  it('rejects more than ten media items', async () => {
    const dto = Object.assign(new CreatePostDto(), {
      content: 'Post',
      media: Array.from({ length: 11 }, (_, sortOrder) => ({
        mediaType: 'IMAGE',
        mediaUrl: `https://cdn.example.com/${sortOrder}.jpg`,
        sortOrder,
      })),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'media')).toBe(true);
  });

  it('rejects more than twenty tagged accounts', async () => {
    const dto = Object.assign(new CreatePostDto(), {
      content: 'Post',
      taggedUserIds: Array.from(
        { length: 21 },
        (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      ),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'taggedUserIds')).toBe(
      true,
    );
  });
});
