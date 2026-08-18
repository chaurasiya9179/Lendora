import { z } from 'zod';

export const CustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform(v => (v && v.trim() ? v.trim() : undefined)),
  phone: z.string().min(5, 'Phone number must be at least 5 digits'),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform(v => (v && v.trim() ? v.trim() : undefined)),
  idType: z.enum(['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT', 'GSTIN']).default('AADHAAR'),
  idNumber: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  addressLine1: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  addressLine2: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  city: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  state: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  postalCode: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  country: z.string().default('India'),
  occupation: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  employerName: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  monthlyIncome: z.string().or(z.number()).transform(v => String(v || '0')).default('0'),
  creditScore: z
    .union([z.number(), z.string().transform(v => (v ? Number(v) : undefined))])
    .optional(),
  emergencyContactName: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  emergencyContactPhone: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  emergencyContactRelation: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).default('VERIFIED'),
  customerStatus: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
  assignedStaffId: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
  notes: z.string().optional().or(z.literal('')).transform(v => (v && v.trim() ? v.trim() : undefined)),
});

export const CustomerNoteSchema = z.object({
  noteType: z.enum(['GENERAL', 'CALL_LOG', 'KYC', 'COLLECTION', 'PAYMENT_REMINDER', 'LOAN_INQUIRY']).default('GENERAL'),
  content: z.string().min(1, 'Note content cannot be empty'),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
export type CustomerNoteInput = z.infer<typeof CustomerNoteSchema>;
