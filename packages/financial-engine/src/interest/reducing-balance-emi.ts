import Decimal from 'decimal.js';
import { toDecimal, rateToFraction, roundCurrency, NumericInput } from '../decimal-utils.js';

export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'LUMP_SUM';

export function getPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'DAILY':
      return 365;
    case 'WEEKLY':
      return 52;
    case 'BI_WEEKLY':
      return 26;
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'LUMP_SUM':
    default:
      return 1;
  }
}

/**
 * Calculates periodic interest rate based on annual percentage rate and payment frequency.
 */
export function getPeriodicInterestRate(annualRatePercentage: NumericInput, frequency: PaymentFrequency): Decimal {
  const annualFraction = rateToFraction(annualRatePercentage);
  const periods = new Decimal(getPeriodsPerYear(frequency));
  return annualFraction.dividedBy(periods);
}

export interface EMIResult {
  principal: string;
  annualRate: string;
  periodicRate: string;
  totalInstallments: number;
  emiAmount: string;
  totalInterestEstimate: string;
  totalRepayableEstimate: string;
}

/**
 * Calculates standard Equated Monthly / Periodic Installment (EMI):
 * EMI = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
 */
export function calculateEMI(
  principal: NumericInput,
  annualInterestRate: NumericInput,
  totalInstallments: number,
  frequency: PaymentFrequency = 'MONTHLY',
  precision: number = 2
): EMIResult {
  const p = toDecimal(principal);
  const n = Math.max(1, totalInstallments);
  const r = getPeriodicInterestRate(annualInterestRate, frequency);

  // Edge case 1: Zero principal or zero installments
  if (p.isZero() || n <= 0) {
    return {
      principal: roundCurrency(p, precision).toFixed(precision),
      annualRate: toDecimal(annualInterestRate).toFixed(4),
      periodicRate: r.toFixed(8),
      totalInstallments: n,
      emiAmount: '0.00',
      totalInterestEstimate: '0.00',
      totalRepayableEstimate: '0.00',
    };
  }

  // Edge case 2: Zero interest rate -> equal division of principal
  if (r.isZero()) {
    const emi = p.dividedBy(n);
    return {
      principal: roundCurrency(p, precision).toFixed(precision),
      annualRate: '0.0000',
      periodicRate: '0.00000000',
      totalInstallments: n,
      emiAmount: roundCurrency(emi, precision).toFixed(precision),
      totalInterestEstimate: '0.00',
      totalRepayableEstimate: roundCurrency(p, precision).toFixed(precision),
    };
  }

  // Standard Reducing Balance EMI Formula:
  // factor = (1 + r)^n
  const onePlusR = new Decimal(1).plus(r);
  const factor = onePlusR.pow(n);

  // numerator = P * r * factor
  const numerator = p.times(r).times(factor);
  // denominator = factor - 1
  const denominator = factor.minus(1);

  const rawEmi = numerator.dividedBy(denominator);
  const roundedEmi = roundCurrency(rawEmi, precision);

  const totalRepayable = roundedEmi.times(n);
  const totalInterest = totalRepayable.minus(p);

  return {
    principal: roundCurrency(p, precision).toFixed(precision),
    annualRate: toDecimal(annualInterestRate).toFixed(4),
    periodicRate: r.toFixed(8),
    totalInstallments: n,
    emiAmount: roundedEmi.toFixed(precision),
    totalInterestEstimate: roundCurrency(totalInterest, precision).toFixed(precision),
    totalRepayableEstimate: roundCurrency(totalRepayable, precision).toFixed(precision),
  };
}
