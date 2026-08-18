import Decimal from 'decimal.js';

// Configure high precision for intermediate calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type NumericInput = string | number | Decimal;

/**
 * Safely converts any numeric input to a Decimal instance.
 */
export function toDecimal(value: NumericInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return new Decimal(0);
    return new Decimal(value.toString());
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned || isNaN(Number(cleaned))) return new Decimal(0);
    return new Decimal(cleaned);
  }
  return new Decimal(0);
}

/**
 * Rounds a decimal amount to standard currency precision (default 2 decimal places).
 */
export function roundCurrency(value: NumericInput, precision: number = 2): Decimal {
  return toDecimal(value).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a decimal amount to fixed string.
 */
export function formatCurrencyString(value: NumericInput, precision: number = 2): string {
  return roundCurrency(value, precision).toFixed(precision);
}

/**
 * Converts annual interest rate percentage (e.g. 12 for 12%) into decimal fraction (0.12).
 */
export function rateToFraction(ratePercentage: NumericInput): Decimal {
  return toDecimal(ratePercentage).dividedBy(100);
}

/**
 * Basic safe arithmetic operations
 */
export function addDecimals(...values: NumericInput[]): Decimal {
  return values.reduce((acc: Decimal, val) => acc.plus(toDecimal(val)), new Decimal(0));
}

export function subtractDecimals(a: NumericInput, b: NumericInput): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function multiplyDecimals(a: NumericInput, b: NumericInput): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function divideDecimals(a: NumericInput, b: NumericInput): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return new Decimal(0);
  return toDecimal(a).dividedBy(divisor);
}

export function maxDecimal(a: NumericInput, b: NumericInput): Decimal {
  const decA = toDecimal(a);
  const decB = toDecimal(b);
  return decA.greaterThan(decB) ? decA : decB;
}

export function minDecimal(a: NumericInput, b: NumericInput): Decimal {
  const decA = toDecimal(a);
  const decB = toDecimal(b);
  return decA.lessThan(decB) ? decA : decB;
}
