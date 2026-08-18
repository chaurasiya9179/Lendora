import Decimal from 'decimal.js';
import { toDecimal, rateToFraction, roundCurrency, minDecimal, maxDecimal, NumericInput } from '../decimal-utils.js';

export type LatePenaltyType = 'FIXED' | 'PERCENTAGE' | 'DAILY_PERCENTAGE';

export interface PenaltyCalculationParams {
  overdueAmount: NumericInput;
  daysOverdue: number;
  gracePeriodDays?: number;
  penaltyType: LatePenaltyType;
  penaltyValue: NumericInput;
  maxPenaltyCap?: NumericInput;
  precision?: number;
}

export interface PenaltyCalculationResult {
  overdueAmount: string;
  daysOverdue: number;
  gracePeriodDays: number;
  chargeableDays: number;
  penaltyType: LatePenaltyType;
  penaltyValue: string;
  calculatedPenalty: string;
  isGracePeriodApplied: boolean;
}

/**
 * Calculates late penalty charges with grace period and capping support.
 */
export function calculateLatePenalty(params: PenaltyCalculationParams): PenaltyCalculationResult {
  const precision = params.precision ?? 2;
  const overdueAmt = toDecimal(params.overdueAmount);
  const daysOverdue = Math.max(0, params.daysOverdue);
  const graceDays = Math.max(0, params.gracePeriodDays ?? 0);
  const penaltyVal = toDecimal(params.penaltyValue);
  const cap = params.maxPenaltyCap ? toDecimal(params.maxPenaltyCap) : null;

  if (overdueAmt.lessThanOrEqualTo(0) || daysOverdue <= graceDays || penaltyVal.isZero()) {
    return {
      overdueAmount: roundCurrency(overdueAmt, precision).toFixed(precision),
      daysOverdue,
      gracePeriodDays: graceDays,
      chargeableDays: 0,
      penaltyType: params.penaltyType,
      penaltyValue: penaltyVal.toFixed(4),
      calculatedPenalty: '0.00',
      isGracePeriodApplied: daysOverdue <= graceDays && daysOverdue > 0,
    };
  }

  const chargeableDays = daysOverdue - graceDays;
  let rawPenalty = new Decimal(0);

  switch (params.penaltyType) {
    case 'FIXED':
      rawPenalty = penaltyVal;
      break;
    case 'PERCENTAGE':
      rawPenalty = overdueAmt.times(rateToFraction(penaltyVal));
      break;
    case 'DAILY_PERCENTAGE':
      rawPenalty = overdueAmt.times(rateToFraction(penaltyVal)).times(chargeableDays);
      break;
  }

  if (cap && cap.greaterThan(0)) {
    rawPenalty = minDecimal(rawPenalty, cap);
  }

  const roundedPenalty = roundCurrency(rawPenalty, precision);

  return {
    overdueAmount: roundCurrency(overdueAmt, precision).toFixed(precision),
    daysOverdue,
    gracePeriodDays: graceDays,
    chargeableDays,
    penaltyType: params.penaltyType,
    penaltyValue: penaltyVal.toFixed(4),
    calculatedPenalty: roundedPenalty.toFixed(precision),
    isGracePeriodApplied: false,
  };
}
