export type NotificationNavigationInput = {
  bookingId?: string | null;
  conversationId?: string | null;
  foodTruckId?: string | null;
  postId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const ENTITY_RULES: Array<{ entityType: string; keys: string[] }> = [
  { entityType: 'CONVERSATION', keys: ['conversationId'] },
  { entityType: 'COMMUNITY_REQUEST', keys: ['communityRequestId'] },
  { entityType: 'BOOKING_ISSUE', keys: ['issueId'] },
  { entityType: 'PAYMENT', keys: ['paymentId'] },
  { entityType: 'REFUND', keys: ['refundId'] },
  { entityType: 'VENDOR_VERIFICATION', keys: ['verificationRequestId'] },
  { entityType: 'BOOKING', keys: ['bookingId'] },
  { entityType: 'VENDOR', keys: ['vendorId'] },
  { entityType: 'FOOD_TRUCK', keys: ['foodTruckId'] },
  { entityType: 'PROMOTION', keys: ['promotionId'] },
  {
    entityType: 'REWARD_REDEMPTION',
    keys: ['rewardRedemptionId', 'redemptionId'],
  },
  { entityType: 'REWARD', keys: ['rewardRuleId', 'rewardId'] },
  { entityType: 'CHECK_IN', keys: ['checkInId'] },
  { entityType: 'BADGE', keys: ['badgeId'] },
  { entityType: 'POST', keys: ['postId'] },
  { entityType: 'REVIEW', keys: ['reviewId'] },
  { entityType: 'REPORT', keys: ['reportId'] },
  { entityType: 'REFERRAL', keys: ['referralId', 'referralCode'] },
];

export function withNotificationEntityMetadata(
  input: NotificationNavigationInput,
) {
  const metadata = { ...(input.metadata ?? {}) };
  const navigationData = buildNotificationNavigationData(input);

  return {
    ...metadata,
    ...navigationData,
  };
}

export function buildNotificationNavigationData(
  input: NotificationNavigationInput,
): Record<string, string> {
  const metadata = input.metadata ?? {};
  const source = {
    ...metadata,
    bookingId: input.bookingId ?? metadata.bookingId,
    conversationId: input.conversationId ?? metadata.conversationId,
    foodTruckId: input.foodTruckId ?? metadata.foodTruckId,
    postId: input.postId ?? metadata.postId,
  };

  const explicitEntityType = toStringValue(metadata.entityType);
  const explicitEntityId = toStringValue(metadata.entityId);
  const data: Record<string, string> = {};

  for (const key of [
    'bookingId',
    'conversationId',
    'foodTruckId',
    'postId',
    'communityRequestId',
    'issueId',
    'paymentId',
    'refundId',
    'verificationRequestId',
    'vendorId',
    'promotionId',
    'rewardRedemptionId',
    'redemptionId',
    'rewardRuleId',
    'rewardId',
    'checkInId',
    'badgeId',
    'reviewId',
    'reportId',
    'referralId',
    'referralCode',
  ]) {
    const value = toStringValue(source[key]);

    if (value) {
      data[key] = value;
    }
  }

  if (explicitEntityType && explicitEntityId) {
    return {
      ...data,
      entityType: explicitEntityType,
      entityId: explicitEntityId,
    };
  }

  for (const rule of ENTITY_RULES) {
    for (const key of rule.keys) {
      const value = toStringValue(source[key]);

      if (value) {
        return {
          ...data,
          entityType: rule.entityType,
          entityId: value,
        };
      }
    }
  }

  return data;
}

function toStringValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() ? value : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}
