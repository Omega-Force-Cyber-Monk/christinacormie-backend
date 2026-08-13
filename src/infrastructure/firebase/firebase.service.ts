import { Injectable, Logger } from '@nestjs/common';
import { getFirebaseConfig } from '../../config/firebase.config';

type PushMessageInput = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type FirebaseAdminModule = {
  credential: {
    cert: (serviceAccount: {
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }) => unknown;
  };
  apps: Array<{ name: string }>;
  initializeApp: (options: { credential: unknown }) => unknown;
  app: () => unknown;
  messaging: (app?: unknown) => {
    sendEachForMulticast: (payload: {
      tokens: string[];
      notification: { title: string; body: string };
      data?: Record<string, string>;
    }) => Promise<{
      responses: Array<{ success: boolean; error?: { code?: string; message?: string } }>;
      successCount: number;
      failureCount: number;
    }>;
  };
};

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private adminModule: FirebaseAdminModule | null = null;
  private app: unknown;

  async sendToTokens(tokens: string[], message: PushMessageInput) {
    if (!tokens.length) {
      return {
        sentCount: 0,
        failedCount: 0,
        invalidTokens: [] as string[],
      };
    }

    const admin = this.getAdminModule();

    if (!admin || !this.app) {
      return {
        sentCount: 0,
        failedCount: 0,
        invalidTokens: [] as string[],
      };
    }

    try {
      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
      });

      const invalidTokens = response.responses
        .map((item, index) => ({ item, token: tokens[index] }))
        .filter(
          ({ item }) =>
            !item.success &&
            ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(
              item.error?.code ?? '',
            ),
        )
        .map(({ token }) => token);

      return {
        sentCount: response.successCount,
        failedCount: response.failureCount,
        invalidTokens,
      };
    } catch (error: any) {
      this.logger.warn(
        `Firebase push delivery failed: ${error?.message ?? 'Unknown error'}`,
      );

      return {
        sentCount: 0,
        failedCount: tokens.length,
        invalidTokens: [] as string[],
      };
    }
  }

  private getAdminModule() {
    if (this.adminModule) {
      return this.adminModule;
    }

    const config = getFirebaseConfig();

    if (!config) {
      return null;
    }

    try {
      const admin = require('firebase-admin') as FirebaseAdminModule;

      if (!admin.apps.length) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(config),
        });
      } else {
        this.app = admin.app();
      }

      this.adminModule = admin;
      return admin;
    } catch (error: any) {
      this.logger.warn(
        `Firebase Admin SDK is unavailable: ${error?.message ?? 'Unknown error'}`,
      );
      return null;
    }
  }
}
