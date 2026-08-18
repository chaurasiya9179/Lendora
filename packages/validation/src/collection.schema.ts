import { z } from 'zod';

export const CreateCollectionTaskSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  loanId: z.string().min(1, 'Loan is required'),
  scheduleItemId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
});

export const UpdateCollectionNoteSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'CONTACTED', 'PROMISE_TO_PAY', 'RESOLVED', 'DEFAULTED']),
  contactResult: z.enum(['REACHED', 'UNREACHABLE', 'WRONG_NUMBER', 'REFUSED_TO_PAY', 'PROMISED']).optional(),
  promiseToPayDate: z.string().optional(),
  promiseAmount: z.string().or(z.number()).transform(v => String(v)).optional(),
  notes: z.string().min(1, 'Notes cannot be empty'),
});

export type CreateCollectionTaskInput = z.infer<typeof CreateCollectionTaskSchema>;
export type UpdateCollectionNoteInput = z.infer<typeof UpdateCollectionNoteSchema>;
