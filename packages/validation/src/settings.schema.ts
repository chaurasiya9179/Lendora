import { z } from 'zod';

export const BusinessSettingsSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().min(1, 'Contact phone is required'),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('India'),
  currency: z.string().default('INR'),
  currencySymbol: z.string().default('₹'),
  currencyPrecision: z.number().int().min(0).max(4).default(2),
  dateFormat: z.string().default('YYYY-MM-DD'),
  allocationOrder: z.enum([
    'PENALTY_FEES_INTEREST_PRINCIPAL',
    'PRINCIPAL_INTEREST_FEES_PENALTY',
    'INTEREST_PRINCIPAL_FEES_PENALTY',
    'FEES_PENALTY_INTEREST_PRINCIPAL',
  ]).default('PENALTY_FEES_INTEREST_PRINCIPAL'),
  defaultGracePeriodDays: z.number().int().min(0).default(3),
  defaultLatePenaltyType: z.enum(['FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE']).default('PERCENTAGE'),
  defaultLatePenaltyValue: z.string().or(z.number()).transform(v => String(v)).default('5.0'),
  prepaymentPenaltyRate: z.string().or(z.number()).transform(v => String(v)).default('0.0'),
  receiptFooterNote: z.string().optional(),
});

export type BusinessSettingsInput = z.infer<typeof BusinessSettingsSchema>;
