import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

export function platformCommissionRate() {
  const rate = Number(process.env.PLATFORM_COMMISSION_RATE ?? '0.10');
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new ServiceUnavailableException(
      'Platform commission configuration is invalid. Please contact support',
    );
  return rate;
}

type QuoteInput = {
  pricingModel?: string;
  pricePerPerson?: number;
  baseServiceFee?: number;
  transportFee?: number;
  extraCharges?: { label: string; amount: number }[];
  serviceFee?: number;
  taxAmount?: number;
  discountAmount?: number;
  quotedAmount?: number;
  paymentPreference?: string;
  depositAmount?: number;
  depositPercent?: number;
  balanceDueAtEvent?: number;
  selectedMenuItems?: string[];
};
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateQuote(
  dto: QuoteInput,
  guests?: number | null,
  commissionRate?: number,
) {
  for (const [key, value] of Object.entries(dto))
    if (value === null) throw new BadRequestException(`${key} cannot be null`);
  const pricingModel = dto.pricingModel ?? 'FLAT_FEE';
  if (dto.extraCharges && dto.extraCharges.length > 20)
    throw new BadRequestException(
      'A quote can contain at most 20 extra charges',
    );
  if (dto.selectedMenuItems?.some((item) => !item.trim()))
    throw new BadRequestException('Quoted menu item names cannot be blank');
  const amounts = [
    dto.pricePerPerson,
    dto.baseServiceFee,
    dto.transportFee,
    dto.serviceFee,
    dto.taxAmount,
    dto.discountAmount,
    dto.quotedAmount,
    dto.depositAmount,
    dto.balanceDueAtEvent,
    ...(dto.extraCharges ?? []).map((i) => i.amount),
  ];
  if (
    amounts.some(
      (v) => v !== undefined && (!Number.isFinite(v) || v < 0 || v > 999999999),
    )
  )
    throw new BadRequestException(
      'Quote amounts must be finite, non-negative numbers below 1 billion',
    );
  if (dto.extraCharges?.some((i) => !i.label.trim()))
    throw new BadRequestException('Each extra charge requires a label');
  let baseServiceFee = money(dto.baseServiceFee ?? dto.quotedAmount ?? 0);
  if (pricingModel === 'PER_PERSON') {
    if (!dto.pricePerPerson || !guests || guests < 1)
      throw new BadRequestException(
        'Per-person pricing requires pricePerPerson greater than zero and a request guest count',
      );
    baseServiceFee = money(dto.pricePerPerson * guests);
    if (
      dto.baseServiceFee !== undefined &&
      money(dto.baseServiceFee) !== baseServiceFee
    )
      throw new BadRequestException(
        'baseServiceFee must equal pricePerPerson multiplied by guest count',
      );
  } else if (dto.pricePerPerson !== undefined)
    throw new BadRequestException(
      'pricePerPerson is only allowed with PER_PERSON pricing',
    );
  const transportFee = money(dto.transportFee ?? 0);
  const serviceFee = money(dto.serviceFee ?? 0);
  const taxAmount = money(dto.taxAmount ?? 0);
  const discountAmount = money(dto.discountAmount ?? 0);
  const total = money(
    baseServiceFee +
      transportFee +
      (dto.extraCharges ?? []).reduce((sum, c) => sum + money(c.amount), 0) +
      serviceFee +
      taxAmount -
      discountAmount,
  );
  if (total <= 0 || total > 999999999)
    throw new BadRequestException(
      'Quote total must be greater than zero and below 1 billion',
    );
  if (dto.quotedAmount !== undefined && money(dto.quotedAmount) !== total)
    throw new BadRequestException(
      'Quote total does not match the base fee and charge breakdown',
    );
  const paymentPreference = dto.paymentPreference ?? 'DEPOSIT_ONLY';
  if (!['DEPOSIT_ONLY', 'PREPAID_IN_FULL'].includes(paymentPreference))
    throw new BadRequestException(
      'The vendor must choose DEPOSIT_ONLY or PREPAID_IN_FULL',
    );
  const rate = commissionRate ?? platformCommissionRate();
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new ServiceUnavailableException(
      'Platform commission configuration is invalid. Please contact support',
    );
  const commissionAmount = money(total * rate);
  let depositAmount = total;
  let depositPercent = 100;
  if (paymentPreference === 'DEPOSIT_ONLY') {
    if (
      dto.depositPercent !== undefined &&
      (!Number.isFinite(dto.depositPercent) ||
        dto.depositPercent <= 0 ||
        dto.depositPercent > 100)
    )
      throw new BadRequestException(
        'depositPercent must be greater than zero and at most 100',
      );
    const fromPercent =
      dto.depositPercent === undefined
        ? undefined
        : money((total * dto.depositPercent) / 100);
    depositAmount = money(dto.depositAmount ?? fromPercent ?? 0);
    if (
      fromPercent !== undefined &&
      dto.depositAmount !== undefined &&
      fromPercent !== depositAmount
    )
      throw new BadRequestException(
        'depositAmount does not match depositPercent of the quote total',
      );
    if (depositAmount <= 0 || depositAmount > total)
      throw new BadRequestException(
        'Deposit must be greater than zero and cannot exceed the quote total',
      );
    if (depositAmount < commissionAmount)
      throw new BadRequestException(
        `Deposit must cover the platform commission: minimum $${commissionAmount.toFixed(2)} (${rate * 100}% of the quote total)`,
      );
    depositPercent = dto.depositPercent ?? money((depositAmount / total) * 100);
  } else if (
    (dto.depositAmount !== undefined && money(dto.depositAmount) !== total) ||
    (dto.depositPercent !== undefined && dto.depositPercent !== 100)
  ) {
    throw new BadRequestException(
      'Prepaid-in-full quotes must collect the full total (100%)',
    );
  }
  const balanceDueAtEvent = money(total - depositAmount);
  if (
    dto.balanceDueAtEvent !== undefined &&
    money(dto.balanceDueAtEvent) !== balanceDueAtEvent
  )
    throw new BadRequestException(
      'balanceDueAtEvent must equal the quote total minus deposit',
    );
  return {
    pricingModel,
    pricePerPerson: dto.pricePerPerson,
    baseServiceFee,
    transportFee,
    serviceFee,
    taxAmount,
    discountAmount,
    quotedAmount: total,
    paymentPreference,
    depositAmount,
    depositPercent,
    balanceDueAtEvent,
    commissionAmount,
    vendorNetAmount: money(depositAmount - commissionAmount),
  };
}
