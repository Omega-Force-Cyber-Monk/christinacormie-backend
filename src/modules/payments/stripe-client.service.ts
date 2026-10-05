import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

type StripeRequestOptions = {
  idempotencyKey?: string;
};

@Injectable()
export class StripeClientService {
  private stripeClient?: Stripe;

  async createConnectAccount(
    country = 'US',
    contactEmail?: string | null,
  ): Promise<any> {
    if (!contactEmail) {
      throw new BadRequestException(
        'Vendor email is required before Stripe Connect onboarding can start.',
      );
    }

    if (this.isMockMode()) {
      return {
        id: `acct_mock_${Date.now()}`,
        type: 'express',
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
      };
    }

    try {
      return await this.stripe().accounts.create({
        type: 'express',
        country,
        email: contactEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
    } catch (error: any) {
      const message = this.getStripeErrorMessage(error);

      if (
        message.includes('loss-liable') ||
        message.includes('country') ||
        message.includes('capabilities') ||
        message.includes('email') ||
        message.includes('Connect') ||
        message.includes('Accounts v1')
      ) {
        throw new BadRequestException(
          `Stripe Connect Express account could not be created. Please make sure this Stripe platform account supports Express connected accounts for ${country} vendors. Stripe message: ${message}`,
        );
      }

      throw this.wrapStripeError(error);
    }
  }

  async retrieveConnectAccount(accountId: string): Promise<any> {
    if (this.isMockMode()) {
      return {
        id: accountId,
        type: 'express',
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
          disabled_reason: null,
        },
      };
    }

    try {
      return await this.stripe().accounts.retrieve(accountId);
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        url: 'https://connect.stripe.com/setup/s/mock_onboarding_url',
      };
    }

    try {
      return await this.stripe().accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  async createLoginLink(accountId: string): Promise<any> {
    if (this.isMockMode()) {
      return {
        url: 'https://connect.stripe.com/express/mock_dashboard_url',
      };
    }

    try {
      return await this.stripe().accounts.createLoginLink(accountId);
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  async createPaymentIntent(
    params: {
      amount: number;
      currency: string;
      connectedAccountId?: string;
      applicationFeeAmount?: number;
      paymentId: string;
      bookingId: string;
    },
    options?: StripeRequestOptions,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_secret_${Date.now()}`,
        status: 'requires_payment_method',
        amount: params.amount,
      };
    }

    try {
      return await this.stripe().paymentIntents.create(
        {
          amount: params.amount,
          currency: params.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: {
            paymentId: params.paymentId,
            bookingId: params.bookingId,
          },
        },
        this.resolveRequestOptions(options),
      );
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  async createTransfer(
    params: {
      amount: number;
      currency: string;
      connectedAccountId: string;
      paymentId: string;
      bookingId: string;
    },
    options?: StripeRequestOptions,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        id: `tr_mock_${Date.now()}`,
        destination: params.connectedAccountId,
        amount: params.amount,
        currency: params.currency,
      };
    }

    try {
      return await this.stripe().transfers.create(
        {
          amount: params.amount,
          currency: params.currency.toLowerCase(),
          destination: params.connectedAccountId,
          metadata: {
            paymentId: params.paymentId,
            bookingId: params.bookingId,
          },
        },
        this.resolveRequestOptions(options),
      );
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  async createRefund(
    params: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
      paymentId: string;
    },
    options?: StripeRequestOptions,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        id: `re_mock_${Date.now()}`,
        status: 'succeeded',
        amount: params.amount,
      };
    }

    try {
      return await this.stripe().refunds.create(
        {
          payment_intent: params.paymentIntentId,
          amount: params.amount,
          reason: params.reason as Stripe.RefundCreateParams.Reason,
          metadata: {
            paymentId: params.paymentId,
          },
        },
        this.resolveRequestOptions(options),
      );
    } catch (error) {
      throw this.wrapStripeError(error);
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }

    try {
      return this.stripe().webhooks.constructEvent(
        rawBody,
        signatureHeader,
        secret,
      );
    } catch (error: any) {
      throw new Error(error?.message ?? 'Invalid Stripe webhook signature');
    }
  }

  private stripe() {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    this.stripeClient = new Stripe(secretKey);
    return this.stripeClient;
  }

  private isMockMode() {
    return process.env.STRIPE_SECRET_KEY?.includes('change_me') ?? false;
  }

  private resolveRequestOptions(options?: StripeRequestOptions) {
    return options?.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined;
  }

  private wrapStripeError(error: unknown) {
    return new BadRequestException(this.getStripeErrorMessage(error));
  }

  private getStripeErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Stripe request failed';
  }
}
