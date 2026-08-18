import Decimal from 'decimal.js';
import { toDecimal, rateToFraction, roundCurrency, NumericInput } from '../decimal-utils.js';

export interface ForeclosureQuoteParams {
  outstandingPrincipal: NumericInput;
  outstandingInterest: NumericInput;
  outstandingPenalty?: NumericInput;
  outstandingFees?: NumericInput;
  accruedInterestSinceLastPayment?: NumericInput;
  prepaymentPenaltyRate?: NumericInput; // e.g. 2 for 2%
  waiverDiscount?: NumericInput;
  precision?: number;
}

export interface ForeclosureQuoteResult {
  outstandingPrincipal: string;
  outstandingInterest: string;
  accruedInterest: string;
  unpaidPenalties: string;
  unpaidFees: string;
  prepaymentPenaltyCharge: string;
  waiverDiscount: string;
  finalSettlementAmount: string;
  quoteGeneratedAt: string;
}

/**
 * Calculates a complete loan foreclosure / early payoff settlement statement.
 */
export function calculateForeclosureQuote(params: ForeclosureQuoteParams): ForeclosureQuoteResult {
  const precision = params.precision ?? 2;
  const principal = toDecimal(params.outstandingPrincipal);
  const interest = toDecimal(params.outstandingInterest);
  const accrued = toDecimal(params.accruedInterestSinceLastPayment ?? 0);
  const penalties = toDecimal(params.outstandingPenalty ?? 0);
  const fees = toDecimal(params.outstandingFees ?? 0);
  const prepayRate = toDecimal(params.prepaymentPenaltyRate ?? 0);
  const waiver = toDecimal(params.waiverDiscount ?? 0);

  const prepaymentCharge = principal.times(rateToFraction(prepayRate));
  const subtotal = principal
    .plus(interest)
    .plus(accrued)
    .plus(penalties)
    .plus(fees)
    .plus(prepaymentCharge);

  const finalSettlement = Decimal.max(0, subtotal.minus(waiver));

  return {
    outstandingPrincipal: roundCurrency(principal, precision).toFixed(precision),
    outstandingInterest: roundCurrency(interest, precision).toFixed(precision),
    accruedInterest: roundCurrency(accrued, precision).toFixed(precision),
    unpaidPenalties: roundCurrency(penalties, precision).toFixed(precision),
    unpaidFees: roundCurrency(fees, precision).toFixed(precision),
    prepaymentPenaltyCharge: roundCurrency(prepaymentCharge, precision).toFixed(precision),
    waiverDiscount: roundCurrency(waiver, precision).toFixed(precision),
    finalSettlementAmount: roundCurrency(finalSettlement, precision).toFixed(precision),
    quoteGeneratedAt: new Date().toISOString(),
  };
}
