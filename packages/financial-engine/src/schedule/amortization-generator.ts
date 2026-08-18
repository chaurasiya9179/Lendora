import Decimal from 'decimal.js';
import { toDecimal, roundCurrency, NumericInput } from '../decimal-utils.js';
import { calculateEMI, getPeriodicInterestRate, PaymentFrequency } from '../interest/reducing-balance-emi.js';
import { calculateFlatRate } from '../interest/flat-rate.js';
import { calculateSimpleInterest } from '../interest/simple-interest.js';

export type CalculationMethod =
  | 'EMI_REDUCING'
  | 'SIMPLE_INTEREST'
  | 'COMPOUND_INTEREST'
  | 'FLAT_RATE'
  | 'REDUCING_BALANCE';

export interface AmortizationScheduleItem {
  installmentNumber: number;
  dueDate: string;
  openingPrincipal: string;
  principalDue: string;
  interestDue: string;
  feesDue: string;
  penaltyDue: string;
  totalDue: string;
  closingPrincipal: string;
  status: 'UPCOMING' | 'DUE_TODAY' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'WAIVED' | 'RESCHEDULED';
}

export interface AmortizationSchedule {
  principalAmount: string;
  interestRate: string;
  calculationMethod: CalculationMethod;
  paymentFrequency: PaymentFrequency;
  totalInstallments: number;
  periodicInstallmentAmount: string;
  totalInterestDue: string;
  totalFeesDue: string;
  totalRepayable: string;
  disbursementDate: string;
  firstPaymentDate: string;
  maturityDate: string;
  items: AmortizationScheduleItem[];
}

export interface GenerateScheduleParams {
  principalAmount: NumericInput;
  annualInterestRate: NumericInput;
  calculationMethod: CalculationMethod;
  paymentFrequency?: PaymentFrequency;
  totalInstallments: number;
  firstPaymentDate: string | Date;
  disbursementDate?: string | Date;
  feesPerInstallment?: NumericInput;
  precision?: number;
}

/**
 * Increments a date based on payment frequency.
 */
export function addFrequencyPeriod(baseDate: Date, frequency: PaymentFrequency, periodIndex: number): Date {
  const result = new Date(baseDate.getTime());
  switch (frequency) {
    case 'DAILY':
      result.setDate(result.getDate() + periodIndex);
      break;
    case 'WEEKLY':
      result.setDate(result.getDate() + periodIndex * 7);
      break;
    case 'BI_WEEKLY':
      result.setDate(result.getDate() + periodIndex * 14);
      break;
    case 'MONTHLY': {
      const originalDay = baseDate.getDate();
      result.setMonth(result.getMonth() + periodIndex);
      // Handle month rollover (e.g. Jan 31 -> Feb 28)
      if (result.getDate() !== originalDay && originalDay > 28) {
        result.setDate(0); // last day of previous month
      }
      break;
    }
    case 'QUARTERLY':
      result.setMonth(result.getMonth() + periodIndex * 3);
      break;
    case 'LUMP_SUM':
      // Keeps same date for lump sum or custom
      break;
  }
  return result;
}

export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates full Amortization Schedule with deterministic rounding and zero balance balancing.
 */
export function generateAmortizationSchedule(params: GenerateScheduleParams): AmortizationSchedule {
  const precision = params.precision ?? 2;
  const principal = roundCurrency(params.principalAmount, precision);
  const annualRate = toDecimal(params.annualInterestRate);
  const method = params.calculationMethod;
  const frequency = params.paymentFrequency ?? 'MONTHLY';
  const totalInstallments = Math.max(1, params.totalInstallments);
  const feesPerInst = roundCurrency(params.feesPerInstallment ?? 0, precision);

  const firstDate = typeof params.firstPaymentDate === 'string'
    ? new Date(params.firstPaymentDate)
    : params.firstPaymentDate;
  const disbDate = params.disbursementDate
    ? (typeof params.disbursementDate === 'string' ? new Date(params.disbursementDate) : params.disbursementDate)
    : firstDate;

  const items: AmortizationScheduleItem[] = [];
  let currentPrincipal = new Decimal(principal);
  let totalInterestSum = new Decimal(0);
  let totalFeesSum = new Decimal(0);

  if (method === 'EMI_REDUCING' || method === 'REDUCING_BALANCE') {
    const emiResult = calculateEMI(principal, annualRate, totalInstallments, frequency, precision);
    const fixedEMI = toDecimal(emiResult.emiAmount);
    const periodicRate = getPeriodicInterestRate(annualRate, frequency);

    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = addFrequencyPeriod(firstDate, frequency, i - 1);
      const opening = currentPrincipal;

      let interestDue = roundCurrency(opening.times(periodicRate), precision);
      let principalDue: Decimal;
      let closing: Decimal;

      if (i === totalInstallments) {
        // On final installment, pay exact remaining principal to avoid 1-cent residual errors
        principalDue = opening;
        closing = new Decimal(0);
      } else {
        principalDue = roundCurrency(fixedEMI.minus(interestDue), precision);
        // Ensure principal due does not exceed opening balance
        if (principalDue.greaterThan(opening)) {
          principalDue = opening;
        }
        closing = roundCurrency(opening.minus(principalDue), precision);
      }

      currentPrincipal = closing;
      totalInterestSum = totalInterestSum.plus(interestDue);
      totalFeesSum = totalFeesSum.plus(feesPerInst);

      const totalDue = principalDue.plus(interestDue).plus(feesPerInst);

      items.push({
        installmentNumber: i,
        dueDate: formatDateToISO(dueDate),
        openingPrincipal: opening.toFixed(precision),
        principalDue: principalDue.toFixed(precision),
        interestDue: interestDue.toFixed(precision),
        feesDue: feesPerInst.toFixed(precision),
        penaltyDue: '0.00',
        totalDue: totalDue.toFixed(precision),
        closingPrincipal: closing.toFixed(precision),
        status: 'UPCOMING',
      });
    }

    const lastDueDate = items.length > 0 ? items[items.length - 1].dueDate : formatDateToISO(firstDate);
    const totalRepayable = principal.plus(totalInterestSum).plus(totalFeesSum);

    return {
      principalAmount: principal.toFixed(precision),
      interestRate: annualRate.toFixed(4),
      calculationMethod: method,
      paymentFrequency: frequency,
      totalInstallments,
      periodicInstallmentAmount: fixedEMI.toFixed(precision),
      totalInterestDue: totalInterestSum.toFixed(precision),
      totalFeesDue: totalFeesSum.toFixed(precision),
      totalRepayable: totalRepayable.toFixed(precision),
      disbursementDate: formatDateToISO(disbDate),
      firstPaymentDate: formatDateToISO(firstDate),
      maturityDate: lastDueDate,
      items,
    };
  }

  if (method === 'FLAT_RATE') {
    const flatResult = calculateFlatRate(principal, annualRate, totalInstallments, 'MONTHS', totalInstallments, precision);
    const totalInterest = toDecimal(flatResult.totalInterest);
    const periodicInterest = roundCurrency(totalInterest.dividedBy(totalInstallments), precision);
    const periodicPrincipal = roundCurrency(principal.dividedBy(totalInstallments), precision);

    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = addFrequencyPeriod(firstDate, frequency, i - 1);
      const opening = currentPrincipal;

      let pDue = periodicPrincipal;
      let closing = roundCurrency(opening.minus(pDue), precision);

      if (i === totalInstallments) {
        pDue = opening;
        closing = new Decimal(0);
      }

      currentPrincipal = closing;
      totalInterestSum = totalInterestSum.plus(periodicInterest);
      totalFeesSum = totalFeesSum.plus(feesPerInst);

      const totalDue = pDue.plus(periodicInterest).plus(feesPerInst);

      items.push({
        installmentNumber: i,
        dueDate: formatDateToISO(dueDate),
        openingPrincipal: opening.toFixed(precision),
        principalDue: pDue.toFixed(precision),
        interestDue: periodicInterest.toFixed(precision),
        feesDue: feesPerInst.toFixed(precision),
        penaltyDue: '0.00',
        totalDue: totalDue.toFixed(precision),
        closingPrincipal: closing.toFixed(precision),
        status: 'UPCOMING',
      });
    }

    const lastDueDate = items.length > 0 ? items[items.length - 1].dueDate : formatDateToISO(firstDate);
    const totalRepayable = principal.plus(totalInterestSum).plus(totalFeesSum);

    return {
      principalAmount: principal.toFixed(precision),
      interestRate: annualRate.toFixed(4),
      calculationMethod: method,
      paymentFrequency: frequency,
      totalInstallments,
      periodicInstallmentAmount: roundCurrency(toDecimal(flatResult.installmentAmount), precision).toFixed(precision),
      totalInterestDue: totalInterestSum.toFixed(precision),
      totalFeesDue: totalFeesSum.toFixed(precision),
      totalRepayable: totalRepayable.toFixed(precision),
      disbursementDate: formatDateToISO(disbDate),
      firstPaymentDate: formatDateToISO(firstDate),
      maturityDate: lastDueDate,
      items,
    };
  }

  // Fallback: Simple Interest split evenly
  const siResult = calculateSimpleInterest(principal, annualRate, totalInstallments, 'MONTHS', precision);
  const totalSI = toDecimal(siResult.totalInterest);
  const periodicInterest = roundCurrency(totalSI.dividedBy(totalInstallments), precision);
  const periodicPrincipal = roundCurrency(principal.dividedBy(totalInstallments), precision);

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = addFrequencyPeriod(firstDate, frequency, i - 1);
    const opening = currentPrincipal;

    let pDue = periodicPrincipal;
    let closing = roundCurrency(opening.minus(pDue), precision);

    if (i === totalInstallments) {
      pDue = opening;
      closing = new Decimal(0);
    }

    currentPrincipal = closing;
    totalInterestSum = totalInterestSum.plus(periodicInterest);
    totalFeesSum = totalFeesSum.plus(feesPerInst);

    const totalDue = pDue.plus(periodicInterest).plus(feesPerInst);

    items.push({
      installmentNumber: i,
      dueDate: formatDateToISO(dueDate),
      openingPrincipal: opening.toFixed(precision),
      principalDue: pDue.toFixed(precision),
      interestDue: periodicInterest.toFixed(precision),
      feesDue: feesPerInst.toFixed(precision),
      penaltyDue: '0.00',
      totalDue: totalDue.toFixed(precision),
      closingPrincipal: closing.toFixed(precision),
      status: 'UPCOMING',
    });
  }

  const lastDueDate = items.length > 0 ? items[items.length - 1].dueDate : formatDateToISO(firstDate);
  const totalRepayable = principal.plus(totalInterestSum).plus(totalFeesSum);

  return {
    principalAmount: principal.toFixed(precision),
    interestRate: annualRate.toFixed(4),
    calculationMethod: method,
    paymentFrequency: frequency,
    totalInstallments,
    periodicInstallmentAmount: roundCurrency(periodicPrincipal.plus(periodicInterest), precision).toFixed(precision),
    totalInterestDue: totalInterestSum.toFixed(precision),
    totalFeesDue: totalFeesSum.toFixed(precision),
    totalRepayable: totalRepayable.toFixed(precision),
    disbursementDate: formatDateToISO(disbDate),
    firstPaymentDate: formatDateToISO(firstDate),
    maturityDate: lastDueDate,
    items,
  };
}
