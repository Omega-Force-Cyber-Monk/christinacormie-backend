import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';

type StripeRequestOptions = {
  idempotencyKey?: string;
};

@Injectable()
export class StripeClientService {
  private readonly apiBaseUrl = 'https://api.stripe.com/v1';

  async createConnectAccount(country = 'US') {
    return this.post('/accounts', {
      type: 'express',
      country,
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true',
    });
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
      connectedAccountId: string;
      applicationFeeAmount: number;
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
        application_fee_amount: String(params.applicationFeeAmount),
        'transfer_data[destination]': params.connectedAccountId,
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
      throw new Error(data?.error?.message ?? 'Stripe request failed');
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
