import Decimal from 'decimal.js';
import { toDecimal, roundCurrency, minDecimal, NumericInput } from '../decimal-utils.js';

export type AllocationOrder =
  | 'PENALTY_FEES_INTEREST_PRINCIPAL'
  | 'PRINCIPAL_INTEREST_FEES_PENALTY'
  | 'INTEREST_PRINCIPAL_FEES_PENALTY'
  | 'FEES_PENALTY_INTEREST_PRINCIPAL';

export interface PendingInstallmentDue {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: NumericInput;
  principalPaid: NumericInput;
  interestDue: NumericInput;
  interestPaid: NumericInput;
  penaltyDue: NumericInput;
  penaltyPaid: NumericInput;
  feesDue: NumericInput;
  feesPaid: NumericInput;
}

export interface ItemAllocationResult {
  scheduleItemId: string;
  installmentNumber: number;
  principalAllocated: string;
  interestAllocated: string;
  penaltyAllocated: string;
  feesAllocated: string;
  totalAllocated: string;
  newPrincipalPaid: string;
  newInterestPaid: string;
  newPenaltyPaid: string;
  newFeesPaid: string;
  remainingPrincipalDue: string;
  remainingInterestDue: string;
  remainingPenaltyDue: string;
  remainingFeesDue: string;
  remainingTotalDue: string;
  status: 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'UPCOMING';
}

export interface PaymentWaterfallResult {
  paymentAmount: string;
  totalAllocated: string;
  principalComponent: string;
  interestComponent: string;
  penaltyComponent: string;
  feesComponent: string;
  excessAmount: string;
  allocations: ItemAllocationResult[];
}

/**
 * Allocates a payment across pending schedule items according to the configured waterfall rule.
 */
export function allocatePaymentWaterfall(
  paymentAmount: NumericInput,
  pendingItems: PendingInstallmentDue[],
  allocationOrder: AllocationOrder = 'PENALTY_FEES_INTEREST_PRINCIPAL',
  precision: number = 2
): PaymentWaterfallResult {
  let remainingPayment = roundCurrency(paymentAmount, precision);
  const allocations: ItemAllocationResult[] = [];

  let totalPrincipalAllocated = new Decimal(0);
  let totalInterestAllocated = new Decimal(0);
  let totalPenaltyAllocated = new Decimal(0);
  let totalFeesAllocated = new Decimal(0);

  for (const item of pendingItems) {
    if (remainingPayment.isZero() && pendingItems.length > 0) {
      // Calculate remaining dues for untouched items
      const pRem = toDecimal(item.principalDue).minus(toDecimal(item.principalPaid));
      const iRem = toDecimal(item.interestDue).minus(toDecimal(item.interestPaid));
      const penRem = toDecimal(item.penaltyDue).minus(toDecimal(item.penaltyPaid));
      const fRem = toDecimal(item.feesDue).minus(toDecimal(item.feesPaid));
      const totalRem = pRem.plus(iRem).plus(penRem).plus(fRem);

      const hasSomePaid = toDecimal(item.principalPaid).plus(toDecimal(item.interestPaid)).plus(toDecimal(item.penaltyPaid)).greaterThan(0);

      allocations.push({
        scheduleItemId: item.id,
        installmentNumber: item.installmentNumber,
        principalAllocated: '0.00',
        interestAllocated: '0.00',
        penaltyAllocated: '0.00',
        feesAllocated: '0.00',
        totalAllocated: '0.00',
        newPrincipalPaid: roundCurrency(item.principalPaid, precision).toFixed(precision),
        newInterestPaid: roundCurrency(item.interestPaid, precision).toFixed(precision),
        newPenaltyPaid: roundCurrency(item.penaltyPaid, precision).toFixed(precision),
        newFeesPaid: roundCurrency(item.feesPaid, precision).toFixed(precision),
        remainingPrincipalDue: roundCurrency(pRem, precision).toFixed(precision),
        remainingInterestDue: roundCurrency(iRem, precision).toFixed(precision),
        remainingPenaltyDue: roundCurrency(penRem, precision).toFixed(precision),
        remainingFeesDue: roundCurrency(fRem, precision).toFixed(precision),
        remainingTotalDue: roundCurrency(totalRem, precision).toFixed(precision),
        status: hasSomePaid ? 'PARTIALLY_PAID' : (new Date(item.dueDate) < new Date() ? 'OVERDUE' : 'UPCOMING'),
      });
      continue;
    }

    let pDue = toDecimal(item.principalDue).minus(toDecimal(item.principalPaid));
    let iDue = toDecimal(item.interestDue).minus(toDecimal(item.interestPaid));
    let penDue = toDecimal(item.penaltyDue).minus(toDecimal(item.penaltyPaid));
    let fDue = toDecimal(item.feesDue).minus(toDecimal(item.feesPaid));

    if (pDue.isNegative()) pDue = new Decimal(0);
    if (iDue.isNegative()) iDue = new Decimal(0);
    if (penDue.isNegative()) penDue = new Decimal(0);
    if (fDue.isNegative()) fDue = new Decimal(0);

    let pAlloc = new Decimal(0);
    let iAlloc = new Decimal(0);
    let penAlloc = new Decimal(0);
    let fAlloc = new Decimal(0);

    // Determine bucket ordering based on configured allocation rule
    const bucketOrder = getBucketOrder(allocationOrder);

    for (const bucket of bucketOrder) {
      if (remainingPayment.isZero()) break;

      switch (bucket) {
        case 'PENALTY': {
          const alloc = minDecimal(remainingPayment, penDue);
          penAlloc = penAlloc.plus(alloc);
          penDue = penDue.minus(alloc);
          remainingPayment = remainingPayment.minus(alloc);
          break;
        }
        case 'FEES': {
          const alloc = minDecimal(remainingPayment, fDue);
          fAlloc = fAlloc.plus(alloc);
          fDue = fDue.minus(alloc);
          remainingPayment = remainingPayment.minus(alloc);
          break;
        }
        case 'INTEREST': {
          const alloc = minDecimal(remainingPayment, iDue);
          iAlloc = iAlloc.plus(alloc);
          iDue = iDue.minus(alloc);
          remainingPayment = remainingPayment.minus(alloc);
          break;
        }
        case 'PRINCIPAL': {
          const alloc = minDecimal(remainingPayment, pDue);
          pAlloc = pAlloc.plus(alloc);
          pDue = pDue.minus(alloc);
          remainingPayment = remainingPayment.minus(alloc);
          break;
        }
      }
    }

    totalPrincipalAllocated = totalPrincipalAllocated.plus(pAlloc);
    totalInterestAllocated = totalInterestAllocated.plus(iAlloc);
    totalPenaltyAllocated = totalPenaltyAllocated.plus(penAlloc);
    totalFeesAllocated = totalFeesAllocated.plus(fAlloc);

    const itemTotalAllocated = pAlloc.plus(iAlloc).plus(penAlloc).plus(fAlloc);
    const newPrincipalPaid = toDecimal(item.principalPaid).plus(pAlloc);
    const newInterestPaid = toDecimal(item.interestPaid).plus(iAlloc);
    const newPenaltyPaid = toDecimal(item.penaltyPaid).plus(penAlloc);
    const newFeesPaid = toDecimal(item.feesPaid).plus(fAlloc);

    const remainingTotalDue = pDue.plus(iDue).plus(penDue).plus(fDue);

    let status: 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'UPCOMING' = 'UPCOMING';
    if (remainingTotalDue.isZero()) {
      status = 'PAID';
    } else if (newPrincipalPaid.plus(newInterestPaid).plus(newPenaltyPaid).plus(newFeesPaid).greaterThan(0)) {
      status = 'PARTIALLY_PAID';
    } else if (new Date(item.dueDate) < new Date()) {
      status = 'OVERDUE';
    }

    allocations.push({
      scheduleItemId: item.id,
      installmentNumber: item.installmentNumber,
      principalAllocated: roundCurrency(pAlloc, precision).toFixed(precision),
      interestAllocated: roundCurrency(iAlloc, precision).toFixed(precision),
      penaltyAllocated: roundCurrency(penAlloc, precision).toFixed(precision),
      feesAllocated: roundCurrency(fAlloc, precision).toFixed(precision),
      totalAllocated: roundCurrency(itemTotalAllocated, precision).toFixed(precision),
      newPrincipalPaid: roundCurrency(newPrincipalPaid, precision).toFixed(precision),
      newInterestPaid: roundCurrency(newInterestPaid, precision).toFixed(precision),
      newPenaltyPaid: roundCurrency(newPenaltyPaid, precision).toFixed(precision),
      newFeesPaid: roundCurrency(newFeesPaid, precision).toFixed(precision),
      remainingPrincipalDue: roundCurrency(pDue, precision).toFixed(precision),
      remainingInterestDue: roundCurrency(iDue, precision).toFixed(precision),
      remainingPenaltyDue: roundCurrency(penDue, precision).toFixed(precision),
      remainingFeesDue: roundCurrency(fDue, precision).toFixed(precision),
      remainingTotalDue: roundCurrency(remainingTotalDue, precision).toFixed(precision),
      status,
    });
  }

  const grandTotalAllocated = totalPrincipalAllocated
    .plus(totalInterestAllocated)
    .plus(totalPenaltyAllocated)
    .plus(totalFeesAllocated);

  return {
    paymentAmount: roundCurrency(paymentAmount, precision).toFixed(precision),
    totalAllocated: roundCurrency(grandTotalAllocated, precision).toFixed(precision),
    principalComponent: roundCurrency(totalPrincipalAllocated, precision).toFixed(precision),
    interestComponent: roundCurrency(totalInterestAllocated, precision).toFixed(precision),
    penaltyComponent: roundCurrency(totalPenaltyAllocated, precision).toFixed(precision),
    feesComponent: roundCurrency(totalFeesAllocated, precision).toFixed(precision),
    excessAmount: roundCurrency(remainingPayment, precision).toFixed(precision),
    allocations,
  };
}

function getBucketOrder(order: AllocationOrder): Array<'PENALTY' | 'FEES' | 'INTEREST' | 'PRINCIPAL'> {
  switch (order) {
    case 'PRINCIPAL_INTEREST_FEES_PENALTY':
      return ['PRINCIPAL', 'INTEREST', 'FEES', 'PENALTY'];
    case 'INTEREST_PRINCIPAL_FEES_PENALTY':
      return ['INTEREST', 'PRINCIPAL', 'FEES', 'PENALTY'];
    case 'FEES_PENALTY_INTEREST_PRINCIPAL':
      return ['FEES', 'PENALTY', 'INTEREST', 'PRINCIPAL'];
    case 'PENALTY_FEES_INTEREST_PRINCIPAL':
    default:
      return ['PENALTY', 'FEES', 'INTEREST', 'PRINCIPAL'];
  }
}

export interface SimpleAllocationInput {
  paymentAmount: NumericInput;
  unpaidPenalty?: NumericInput;
  unpaidFees?: NumericInput;
  interestDue?: NumericInput;
  principalDue?: NumericInput;
  allocationOrder?: AllocationOrder;
  precision?: number;
}

export interface SimpleAllocationResult {
  principalAllocated: string;
  interestAllocated: string;
  penaltyAllocated: string;
  feesAllocated: string;
  excessAmount: string;
  totalAllocated: string;
}

export function calculatePaymentAllocation(params: SimpleAllocationInput): SimpleAllocationResult {
  const precision = params.precision || 2;
  const dummyItem: PendingInstallmentDue = {
    id: 'item-1',
    installmentNumber: 1,
    dueDate: new Date().toISOString(),
    principalDue: params.principalDue || '0',
    principalPaid: '0',
    interestDue: params.interestDue || '0',
    interestPaid: '0',
    penaltyDue: params.unpaidPenalty || '0',
    penaltyPaid: '0',
    feesDue: params.unpaidFees || '0',
    feesPaid: '0',
  };

  const res = allocatePaymentWaterfall(
    params.paymentAmount,
    [dummyItem],
    params.allocationOrder || 'PENALTY_FEES_INTEREST_PRINCIPAL',
    precision
  );

  return {
    principalAllocated: res.principalComponent,
    interestAllocated: res.interestComponent,
    penaltyAllocated: res.penaltyComponent,
    feesAllocated: res.feesComponent,
    excessAmount: res.excessAmount,
    totalAllocated: res.totalAllocated,
  };
}
