import Decimal from 'decimal.js';
import { roundCurrency, NumericInput } from '../decimal-utils.js';
import { generateAmortizationSchedule, AmortizationSchedule, CalculationMethod } from '../schedule/amortization-generator.js';
import { PaymentFrequency } from '../interest/reducing-balance-emi.js';

export interface RestructureLoanParams {
  remainingPrincipal: NumericInput;
  newAnnualInterestRate: NumericInput;
  newCalculationMethod: CalculationMethod;
  newPaymentFrequency: PaymentFrequency;
  newRemainingInstallments: number;
  newFirstPaymentDate: string | Date;
  newFeesPerInstallment?: NumericInput;
  reasonForRestructure: string;
  previousScheduleVersion: number;
  precision?: number;
}

export interface RestructuredScheduleResult {
  newVersionNumber: number;
  reason: string;
  newSchedule: AmortizationSchedule;
}

/**
 * Recalculates and restructures a loan's remaining repayment schedule.
 */
export function restructureLoanSchedule(params: RestructureLoanParams): RestructuredScheduleResult {
  const newSchedule = generateAmortizationSchedule({
    principalAmount: params.remainingPrincipal,
    annualInterestRate: params.newAnnualInterestRate,
    calculationMethod: params.newCalculationMethod,
    paymentFrequency: params.newPaymentFrequency,
    totalInstallments: params.newRemainingInstallments,
    firstPaymentDate: params.newFirstPaymentDate,
    feesPerInstallment: params.newFeesPerInstallment ?? 0,
    precision: params.precision ?? 2,
  });

  return {
    newVersionNumber: params.previousScheduleVersion + 1,
    reason: params.reasonForRestructure,
    newSchedule,
  };
}
