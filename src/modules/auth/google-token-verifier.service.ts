import { Injectable, UnauthorizedException } from '@nestjs/common';

type GoogleProfile = {
  email: string;
  emailVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

@Injectable()
export class GoogleTokenVerifierService {
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const clientIds = this.googleClientIds();

    if (clientIds.length === 0) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    const tokenInfoUrl =
      'https://oauth2.googleapis.com/tokeninfo?id_token=' +
      encodeURIComponent(idToken);

    let payload: any;

    try {
      const response = await fetch(tokenInfoUrl);

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google token');
      }

      payload = await response.json();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Unable to verify Google token');
    }

    const audience = payload.aud as string | undefined;
    const email = payload.email as string | undefined;
    const emailVerified = payload.email_verified;

    if (!audience || !clientIds.includes(audience)) {
      throw new UnauthorizedException('Google token audience mismatch');
    }

    if (!email) {
      throw new UnauthorizedException('Google account email is required');
    }

    const isEmailVerified =
      emailVerified === true || emailVerified === 'true';

    if (!isEmailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return {
      email: email.toLowerCase(),
      emailVerified: true,
      firstName: payload.given_name ?? null,
      lastName: payload.family_name ?? null,
      displayName: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    };
  }

  private googleClientIds() {
    return [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
    ].filter((value): value is string => Boolean(value?.trim()));
  }
}
