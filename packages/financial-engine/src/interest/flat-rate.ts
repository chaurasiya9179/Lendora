import { toDecimal, rateToFraction, roundCurrency, NumericInput } from '../decimal-utils.js';
import { tenureToYears, TenureUnit } from './simple-interest.js';

export interface FlatRateResult {
  principal: string;
  interestRate: string;
  tenureYears: string;
  totalInterest: string;
  totalRepayable: string;
  installmentAmount: string;
}

/**
 * Calculates Flat Rate loan interest and installment amounts.
 */
export function calculateFlatRate(
  principal: NumericInput,
  annualInterestRate: NumericInput,
  tenureValue: number,
  tenureUnit: TenureUnit = 'MONTHS',
  totalInstallments: number,
  precision: number = 2
): FlatRateResult {
  const p = toDecimal(principal);
  const r = rateToFraction(annualInterestRate);
  const t = tenureToYears(tenureValue, tenureUnit);
  const installments = Math.max(1, totalInstallments);

  const totalInterest = p.times(r).times(t);
  const totalRepayable = p.plus(totalInterest);
  const installmentAmount = totalRepayable.dividedBy(installments);

  return {
    principal: roundCurrency(p, precision).toFixed(precision),
    interestRate: toDecimal(annualInterestRate).toFixed(4),
    tenureYears: t.toFixed(4),
    totalInterest: roundCurrency(totalInterest, precision).toFixed(precision),
    totalRepayable: roundCurrency(totalRepayable, precision).toFixed(precision),
    installmentAmount: roundCurrency(installmentAmount, precision).toFixed(precision),
  };
}
