import { UnauthorizedException } from '@nestjs/common';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('GoogleTokenVerifierService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let service: GoogleTokenVerifierService;

  beforeEach(() => {
    process.env = { ...originalEnv, GOOGLE_WEB_CLIENT_ID: 'web-client-id' };
    service = new GoogleTokenVerifierService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('verifies a valid Google token payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'web-client-id',
        email: 'USER@EXAMPLE.COM',
        email_verified: 'true',
        given_name: 'John',
        family_name: 'Doe',
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
      }),
    } as Response);

    await expect(service.verifyIdToken('token-123')).resolves.toEqual({
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('rejects token with wrong audience', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: 'other-client-id',
        email: 'user@example.com',
        email_verified: true,
      }),
    } as Response);

    await expect(service.verifyIdToken('token-123')).rejects.toThrow(
      new UnauthorizedException('Google token audience mismatch'),
    );
  });
});
