import Decimal from 'decimal.js';
import { toDecimal, rateToFraction, roundCurrency, NumericInput } from '../decimal-utils.js';
import { tenureToYears, TenureUnit } from './simple-interest.js';

export type CompoundingFrequency = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export function getCompoundingPeriodsPerYear(frequency: CompoundingFrequency): number {
  switch (frequency) {
    case 'DAILY':
      return 365;
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'SEMI_ANNUAL':
      return 2;
    case 'ANNUAL':
    default:
      return 1;
  }
}

export interface CompoundInterestResult {
  principal: string;
  interestRate: string;
  compoundingFrequency: CompoundingFrequency;
  maturityAmount: string;
  totalInterest: string;
}

/**
 * Calculates Compound Interest: A = P * (1 + r/m)^(m * t)
 */
export function calculateCompoundInterest(
  principal: NumericInput,
  annualInterestRate: NumericInput,
  tenureValue: number,
  tenureUnit: TenureUnit = 'MONTHS',
  frequency: CompoundingFrequency = 'MONTHLY',
  precision: number = 2
): CompoundInterestResult {
  const p = toDecimal(principal);
  const r = rateToFraction(annualInterestRate);
  const t = tenureToYears(tenureValue, tenureUnit);
  const m = new Decimal(getCompoundingPeriodsPerYear(frequency));

  if (p.isZero() || r.isZero() || t.isZero()) {
    return {
      principal: roundCurrency(p, precision).toFixed(precision),
      interestRate: toDecimal(annualInterestRate).toFixed(4),
      compoundingFrequency: frequency,
      maturityAmount: roundCurrency(p, precision).toFixed(precision),
      totalInterest: '0.00',
    };
  }

  // base = 1 + r/m
  const base = new Decimal(1).plus(r.dividedBy(m));
  // exponent = m * t
  const exponent = m.times(t).toNumber();

  const maturityAmount = p.times(base.pow(exponent));
  const totalInterest = maturityAmount.minus(p);

  return {
    principal: roundCurrency(p, precision).toFixed(precision),
    interestRate: toDecimal(annualInterestRate).toFixed(4),
    compoundingFrequency: frequency,
    maturityAmount: roundCurrency(maturityAmount, precision).toFixed(precision),
    totalInterest: roundCurrency(totalInterest, precision).toFixed(precision),
  };
}
