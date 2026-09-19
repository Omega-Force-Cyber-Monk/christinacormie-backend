import { ForbiddenException } from '@nestjs/common';
import { VendorPlan } from '@prisma/client';
import { VENDOR_PLAN_CONFIG } from './vendor-plan.config';

export type VendorPlanFeature =
  | 'EVENT_BOOKINGS'
  | 'STAFF_ACCOUNTS'
  | 'BASIC_ANALYTICS'
  | 'FULL_ANALYTICS'
  | 'ADVANCED_ANALYTICS'
  | 'PROMOTIONS'
  | 'REWARDS'
  | 'COMMUNITY_BOOKING_REQUESTS'
  | 'MULTIPLE_TRUCKS';

export function getVendorPlanConfig(plan?: VendorPlan | string | null) {
  return VENDOR_PLAN_CONFIG[(plan as VendorPlan) || VendorPlan.FREE];
}

export function assertVendorPlanFeature(
  vendor: {
    selectedPlan?: VendorPlan | string | null;
    subscriptionStatus?: string | null;
  },
  feature: VendorPlanFeature,
) {
  const config = getVendorPlanConfig(vendor.selectedPlan);

  if (
    config.plan !== VendorPlan.FREE &&
    !['TRIALING', 'ACTIVE'].includes(vendor.subscriptionStatus ?? 'INACTIVE')
  ) {
    throw new ForbiddenException(
      `${config.name} plan is not active yet. Complete your subscription payment to unlock this feature.`,
    );
  }

  const allowed =
    feature === 'EVENT_BOOKINGS'
      ? config.bookingEnabled
      : feature === 'STAFF_ACCOUNTS'
        ? config.maxStaffAccounts > 0
        : feature === 'BASIC_ANALYTICS'
          ? config.analyticsLevel !== 'NONE'
          : feature === 'FULL_ANALYTICS'
            ? ['FULL', 'ADVANCED'].includes(config.analyticsLevel)
            : feature === 'ADVANCED_ANALYTICS'
              ? config.analyticsLevel === 'ADVANCED'
              : feature === 'PROMOTIONS'
                ? config.plan !== VendorPlan.FREE
              : feature === 'REWARDS'
                ? config.plan !== VendorPlan.FREE
                : feature === 'COMMUNITY_BOOKING_REQUESTS'
                  ? ['PRO', 'ELITE'].includes(config.plan)
                  : feature === 'MULTIPLE_TRUCKS'
                    ? config.maxIncludedTrucks > 1
                    : false;

  if (!allowed) {
    throw new ForbiddenException(featureBlockedMessage(feature, config.name));
  }

  return config;
}

function featureBlockedMessage(feature: VendorPlanFeature, planName: string) {
  switch (feature) {
    case 'EVENT_BOOKINGS':
      return `${planName} plan vendors cannot send booking quotes. Upgrade to Starter or higher.`;
    case 'STAFF_ACCOUNTS':
      return `${planName} plan does not include staff accounts. Upgrade to Starter or higher.`;
    case 'BASIC_ANALYTICS':
      return `${planName} plan does not include vendor analytics. Upgrade to Starter or higher.`;
    case 'FULL_ANALYTICS':
      return `${planName} plan does not include full earnings analytics. Upgrade to Pro or Elite.`;
    case 'ADVANCED_ANALYTICS':
      return `${planName} plan does not include advanced analytics. Upgrade to Elite.`;
    case 'PROMOTIONS':
      return `${planName} plan does not include drops/promotions. Upgrade to Starter or higher.`;
    case 'REWARDS':
      return `${planName} plan does not include QR check-in or rewards redemption. Upgrade to Starter or higher.`;
    case 'COMMUNITY_BOOKING_REQUESTS':
      return `${planName} plan does not include community booking requests. Upgrade to Pro or Elite.`;
    case 'MULTIPLE_TRUCKS':
      return `${planName} plan does not include multiple truck listings. Upgrade to Elite.`;
  }
}
