import Decimal from 'decimal.js';
import { toDecimal, rateToFraction, roundCurrency, NumericInput } from '../decimal-utils.js';

export type TenureUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

/**
 * Converts any tenure duration into fractional years for standardized annual rate application.
 */
export function tenureToYears(tenureValue: number, tenureUnit: TenureUnit): Decimal {
  const value = toDecimal(tenureValue);
  switch (tenureUnit) {
    case 'DAYS':
      return value.dividedBy(365);
    case 'WEEKS':
      return value.dividedBy(52);
    case 'MONTHS':
      return value.dividedBy(12);
    case 'YEARS':
    default:
      return value;
  }
}

export interface SimpleInterestResult {
  principal: string;
  interestRate: string;
  tenureYears: string;
  totalInterest: string;
  totalRepayable: string;
}

/**
 * Calculates Simple Interest: I = P * r * t
 */
export function calculateSimpleInterest(
  principal: NumericInput,
  annualInterestRate: NumericInput,
  tenureValue: number,
  tenureUnit: TenureUnit = 'MONTHS',
  precision: number = 2
): SimpleInterestResult {
  const p = toDecimal(principal);
  const r = rateToFraction(annualInterestRate);
  const t = tenureToYears(tenureValue, tenureUnit);

  const totalInterest = p.times(r).times(t);
  const totalRepayable = p.plus(totalInterest);

  return {
    principal: roundCurrency(p, precision).toFixed(precision),
    interestRate: toDecimal(annualInterestRate).toFixed(4),
    tenureYears: t.toFixed(4),
    totalInterest: roundCurrency(totalInterest, precision).toFixed(precision),
    totalRepayable: roundCurrency(totalRepayable, precision).toFixed(precision),
  };
}
