import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';

type StripeRequestOptions = {
  idempotencyKey?: string;
};

@Injectable()
export class StripeClientService {
  private readonly apiBaseUrl = 'https://api.stripe.com/v1';

  async createConnectAccount(country = 'US') {
    try {
      return await this.post('/accounts', {
        type: 'express',
        country,
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
      });
    } catch (error: any) {
      const message = error?.message ?? '';

      if (
        message.includes('loss-liable') ||
        message.includes('country') ||
        message.includes('capabilities') ||
        message.includes('Connect')
      ) {
        throw new BadRequestException(
          `Stripe Connect Express account could not be created. Please make sure this Stripe platform account supports Express connected accounts for ${country} vendors. Stripe message: ${message}`,
        );
      }

      throw error;
    }
  }

  async retrieveConnectAccount(accountId: string) {
    return this.get(`/accounts/${accountId}`);
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ) {
    return this.post('/account_links', {
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
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
  ) {
    return this.post(
      '/payment_intents',
      {
        amount: String(params.amount),
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: 'true' },
        'metadata[paymentId]': params.paymentId,
        'metadata[bookingId]': params.bookingId,
      },
      options,
    );
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
  ) {
    return this.post(
      '/transfers',
      {
        amount: String(params.amount),
        currency: params.currency.toLowerCase(),
        destination: params.connectedAccountId,
        'metadata[paymentId]': params.paymentId,
        'metadata[bookingId]': params.bookingId,
      },
      options,
    );
  }

  async createRefund(
    params: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
      paymentId: string;
    },
    options?: StripeRequestOptions,
  ) {
    return this.post(
      '/refunds',
      {
        payment_intent: params.paymentIntentId,
        ...(params.amount ? { amount: String(params.amount) } : {}),
        ...(params.reason ? { reason: params.reason } : {}),
        'metadata[paymentId]': params.paymentId,
      },
      options,
    );
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }

    const signatureParts = this.parseStripeSignature(signatureHeader);
    const timestamp = signatureParts.get('t');
    const signatures = signatureParts.get('v1')?.split(',') ?? [];

    if (!timestamp || !signatures.length) {
      throw new Error('Invalid Stripe signature header');
    }

    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const isValid = signatures.some((signature) =>
      this.safeCompare(signature, expected),
    );

    if (!isValid) {
      throw new Error('Invalid Stripe webhook signature');
    }

    return JSON.parse(rawBody.toString('utf8'));
  }

  private async post(
    path: string,
    params: Record<string, unknown>,
    options?: StripeRequestOptions,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    if (secretKey.includes('change_me')) {
      if (path === '/accounts') {
        return {
          id: `acct_mock_${Date.now()}`,
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
        };
      }
      if (path === '/account_links') {
        return {
          url: 'https://connect.stripe.com/setup/s/mock_onboarding_url',
        };
      }
      if (path === '/payment_intents') {
        return {
          id: `pi_mock_${Date.now()}`,
          client_secret: `pi_mock_secret_${Date.now()}`,
          status: 'requires_payment_method',
          amount: params.amount,
          application_fee_amount: params.application_fee_amount,
        };
      }
      if (path === '/refunds') {
        return {
          id: `re_mock_${Date.now()}`,
          status: 'succeeded',
          amount: params.amount,
        };
      }
      if (path === '/transfers') {
        return {
          id: `tr_mock_${Date.now()}`,
          destination: params.destination,
          amount: params.amount,
          currency: params.currency,
        };
      }
    }

    const body = new URLSearchParams();
    this.appendParams(body, params);

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(options?.idempotencyKey
          ? { 'Idempotency-Key': options.idempotencyKey }
          : {}),
      },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error?.message ?? 'Stripe request failed',
      );
    }

    return data;
  }

  private async get(path: string) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    if (secretKey.includes('change_me')) {
      if (path.startsWith('/accounts/')) {
        return {
          id: path.split('/').pop(),
          type: 'express',
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: {
            currently_due: [],
            eventually_due: [],
            past_due: [],
            disabled_reason: null,
          },
        };
      }
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new BadRequestException(
        data?.error?.message ?? 'Stripe request failed',
      );
    }

    return data;
  }

  private appendParams(body: URLSearchParams, params: Record<string, unknown>) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [childKey, childValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          body.append(`${key}[${childKey}]`, String(childValue));
        }
        continue;
      }

      body.append(key, String(value));
    }
  }

  private parseStripeSignature(header: string) {
    const parts = new Map<string, string>();

    for (const segment of header.split(',')) {
      const [key, value] = segment.split('=');
      const existing = parts.get(key);
      parts.set(key, existing ? `${existing},${value}` : value);
    }

    return parts;
  }

  private safeCompare(value: string, expected: string) {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);

    return (
      valueBuffer.length === expectedBuffer.length &&
      timingSafeEqual(valueBuffer, expectedBuffer)
    );
  }
}
