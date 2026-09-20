import { createHmac, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';

type StripeRequestOptions = {
  idempotencyKey?: string;
  stripeVersion?: string;
};

@Injectable()
export class StripeClientService {
  private readonly apiBaseUrl = 'https://api.stripe.com/v1';

  async createConnectAccount(country = 'US') {
    const accountType =
      process.env.STRIPE_CONNECT_ACCOUNT_TYPE || 'express';

    const buildParams = (type: string) => {
      const params: Record<string, unknown> = {
        type,
        country,
      };
      if (type === 'express' || type === 'custom') {
        params['capabilities[card_payments][requested]'] = 'true';
        params['capabilities[transfers][requested]'] = 'true';
      }
      return params;
    };

    try {
      return await this.post('/accounts', buildParams(accountType));
    } catch (error: any) {
      if (
        accountType !== 'standard' &&
        error.message?.includes(
          'cannot create accounts where the platform is loss-liable',
        )
      ) {
        return await this.post('/accounts', buildParams('standard'));
      }
      throw error;
    }
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

  async createCustomer(params: {
    email?: string | null;
    name?: string | null;
    vendorId: string;
  }) {
    return this.post('/customers', {
      ...(params.email ? { email: params.email } : {}),
      ...(params.name ? { name: params.name } : {}),
      'metadata[vendorId]': params.vendorId,
    });
  }

  async createProduct(params: {
    name: string;
    description?: string | null;
    tierId: string;
    code: string;
  }) {
    return this.post('/products', {
      name: params.name,
      ...(params.description ? { description: params.description } : {}),
      'metadata[tierId]': params.tierId,
      'metadata[code]': params.code,
    });
  }

  async updateProduct(
    productId: string,
    params: {
      name?: string;
      description?: string | null;
      active?: boolean;
    },
  ) {
    return this.post(`/products/${productId}`, {
      ...(params.name ? { name: params.name } : {}),
      ...(params.description !== undefined
        ? { description: params.description ?? '' }
        : {}),
      ...(params.active !== undefined
        ? { active: String(params.active) }
        : {}),
    });
  }

  async createRecurringPrice(params: {
    productId: string;
    amountCents: number;
    currency?: string;
    tierId: string;
    code: string;
  }) {
    return this.post('/prices', {
      product: params.productId,
      unit_amount: String(params.amountCents),
      currency: (params.currency ?? 'USD').toLowerCase(),
      recurring: { interval: 'month' },
      'metadata[tierId]': params.tierId,
      'metadata[code]': params.code,
    });
  }

  async archivePrice(priceId: string) {
    return this.post(`/prices/${priceId}`, {
      active: 'false',
    });
  }

  async createEphemeralKey(customerId: string) {
    return this.post(
      '/ephemeral_keys',
      { customer: customerId },
      {
        stripeVersion:
          process.env.STRIPE_API_VERSION || '2025-07-30.basil',
      },
    );
  }

  async createSubscription(
    params: {
      customerId: string;
      priceId: string;
      vendorId: string;
      plan: string;
      tierId?: string;
      trialDays: number;
    },
    options?: StripeRequestOptions,
  ) {
    return this.post(
      '/subscriptions',
      {
        customer: params.customerId,
        'items[0][price]': params.priceId,
        payment_behavior: 'default_incomplete',
        collection_method: 'charge_automatically',
        trial_period_days: String(params.trialDays),
        'payment_settings[save_default_payment_method]': 'on_subscription',
        'metadata[vendorId]': params.vendorId,
        'metadata[plan]': params.plan,
        ...(params.tierId ? { 'metadata[tierId]': params.tierId } : {}),
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      },
      options,
    );
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.get('/subscriptions', subscriptionId, {
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    });
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
      if (path === '/customers') {
        return {
          id: `cus_mock_${Date.now()}`,
          email: params.email,
          name: params.name,
        };
      }
      if (path === '/products') {
        return {
          id: `prod_mock_${Date.now()}`,
          name: params.name,
          active: true,
        };
      }
      if (path.startsWith('/products/')) {
        return {
          id: path.split('/').pop(),
          ...params,
        };
      }
      if (path === '/prices') {
        return {
          id: `price_mock_${Date.now()}`,
          product: params.product,
          unit_amount: params.unit_amount,
          currency: params.currency,
          active: true,
        };
      }
      if (path.startsWith('/prices/')) {
        return {
          id: path.split('/').pop(),
          active: params.active !== 'false',
        };
      }
      if (path === '/ephemeral_keys') {
        return {
          id: `ephkey_mock_${Date.now()}`,
          secret: `ek_mock_secret_${Date.now()}`,
        };
      }
      if (path === '/subscriptions') {
        return {
          id: `sub_mock_${Date.now()}`,
          status: 'trialing',
          trial_start: Math.floor(Date.now() / 1000),
          trial_end: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
          current_period_end:
            Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
          pending_setup_intent: {
            id: `seti_mock_${Date.now()}`,
            client_secret: `seti_mock_secret_${Date.now()}`,
          },
          latest_invoice: null,
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
        ...(options?.stripeVersion
          ? { 'Stripe-Version': options.stripeVersion }
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

  private async get(
    path: string,
    id: string,
    params: Record<string, unknown> = {},
    options?: StripeRequestOptions,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    if (secretKey.includes('change_me')) {
      if (path === '/subscriptions') {
        return {
          id,
          status: 'trialing',
          trial_start: Math.floor(Date.now() / 1000),
          trial_end: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
          current_period_end:
            Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
          pending_setup_intent: {
            id: `seti_mock_${Date.now()}`,
            client_secret: `seti_mock_secret_${Date.now()}`,
          },
          latest_invoice: null,
        };
      }
    }

    const query = new URLSearchParams();
    this.appendParams(query, params);
    const queryString = query.toString();
    const response = await fetch(
      `${this.apiBaseUrl}${path}/${id}${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          ...(options?.stripeVersion
            ? { 'Stripe-Version': options.stripeVersion }
            : {}),
        },
      },
    );

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

      if (Array.isArray(value)) {
        for (const item of value) {
          body.append(`${key}[]`, String(item));
        }
        continue;
      }

      if (typeof value === 'object') {
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
