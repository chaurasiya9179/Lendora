import { z } from 'zod';

export const LoanCreationSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  loanType: z.enum(['PERSONAL', 'BUSINESS', 'GOLD_LOAN', 'VEHICLE', 'MICROFINANCE', 'MORTGAGE', 'DASTI_DAILY', 'EQUIPMENT', 'EDUCATION']),
  principalAmount: z.string().or(z.number()).transform(v => String(v)).refine(v => Number(v) > 0, 'Principal must be greater than 0'),
  interestRate: z.string().or(z.number()).transform(v => String(v)).refine(v => Number(v) >= 0, 'Interest rate cannot be negative'),
  interestRatePeriod: z.enum(['ANNUAL', 'MONTHLY', 'DAILY']).default('ANNUAL'),
  interestCalculationMethod: z.enum(['EMI_REDUCING', 'SIMPLE_INTEREST', 'COMPOUND_INTEREST', 'FLAT_RATE', 'REDUCING_BALANCE', 'INTEREST_ONLY']),
  tenureValue: z.number().int().min(1, 'Tenure must be at least 1'),
  tenureUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']).default('MONTHS'),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'LUMP_SUM']).default('MONTHLY'),
  disbursementDate: z.string().min(1, 'Disbursement date is required'),
  firstPaymentDate: z.string().min(1, 'First payment date is required'),
  processingFee: z.string().or(z.number()).transform(v => String(v)).default('0'),
  insuranceFee: z.string().or(z.number()).transform(v => String(v)).default('0'),
  otherCharges: z.string().or(z.number()).transform(v => String(v)).default('0'),
  gracePeriodDays: z.number().int().min(0).default(0),
  latePenaltyType: z.enum(['FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE']).default('PERCENTAGE'),
  latePenaltyValue: z.string().or(z.number()).transform(v => String(v)).default('5.0'),
  prepaymentPenaltyRate: z.string().or(z.number()).transform(v => String(v)).default('0.0'),
  notes: z.string().optional(),
});

export const LoanPreviewSchema = z.object({
  principalAmount: z.string().or(z.number()).transform(v => String(v)),
  interestRate: z.string().or(z.number()).transform(v => String(v)),
  interestCalculationMethod: z.enum(['EMI_REDUCING', 'SIMPLE_INTEREST', 'COMPOUND_INTEREST', 'FLAT_RATE', 'REDUCING_BALANCE', 'INTEREST_ONLY']),
  tenureValue: z.number().int().min(1),
  tenureUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']).default('MONTHS'),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'LUMP_SUM']).default('MONTHLY'),
  firstPaymentDate: z.string(),
  disbursementDate: z.string().optional(),
});

export const LoanRestructureSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  newInterestRate: z.string().or(z.number()).transform(v => String(v)),
  newCalculationMethod: z.enum(['EMI_REDUCING', 'SIMPLE_INTEREST', 'COMPOUND_INTEREST', 'FLAT_RATE', 'REDUCING_BALANCE', 'INTEREST_ONLY']),
  newPaymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'LUMP_SUM']).default('MONTHLY'),
  newRemainingInstallments: z.number().int().min(1, 'Must have at least 1 installment'),
  newFirstPaymentDate: z.string().min(1, 'New first payment date is required'),
  reasonForRestructure: z.string().min(3, 'A clear reason for restructuring is required'),
});

export const LoanForeclosureSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  paymentMethod: z.enum(['UPI', 'IMPS_NEFT', 'CASH', 'CHEQUE', 'NACH_AUTODEBIT', 'BANK_TRANSFER', 'CARD', 'ADJUSTMENT']),
  transactionReference: z.string().optional(),
  waiverDiscount: z.string().or(z.number()).transform(v => String(v)).default('0'),
  notes: z.string().optional(),
});

export type LoanCreationInput = z.infer<typeof LoanCreationSchema>;
export type LoanPreviewInput = z.infer<typeof LoanPreviewSchema>;
export type LoanRestructureInput = z.infer<typeof LoanRestructureSchema>;
export type LoanForeclosureInput = z.infer<typeof LoanForeclosureSchema>;
