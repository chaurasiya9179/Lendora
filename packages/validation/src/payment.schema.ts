import { z } from 'zod';

export const RecordPaymentSchema = z.object({
  loanId: z.string().min(1, 'Loan is required'),
  paymentAmount: z.string().or(z.number()).transform(v => String(v)).refine(v => Number(v) > 0, 'Payment amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.enum(['UPI', 'IMPS_NEFT', 'CASH', 'CHEQUE', 'NACH_AUTODEBIT', 'BANK_TRANSFER', 'CARD', 'ADJUSTMENT']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

export const ReversePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  reason: z.string().min(3, 'A clear reason for reversal is required'),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof ReversePaymentSchema>;
