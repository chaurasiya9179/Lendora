export type InstallmentStatus =
  | 'UPCOMING'
  | 'DUE_TODAY'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'WAIVED'
  | 'RESCHEDULED';

export interface LoanScheduleItem {
  id: string;
  scheduleId: string;
  installmentNumber: number;
  dueDate: string;
  openingPrincipal: string;
  principalDue: string;
  interestDue: string;
  feesDue: string;
  penaltyDue: string;
  totalEmiAmount: string;
  closingPrincipal: string;
  principalPaid: string;
  interestPaid: string;
  penaltyPaid: string;
  feesPaid: string;
  totalPaid: string;
  remainingBalance: string;
  status: InstallmentStatus;
  daysOverdue: number;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanSchedule {
  id: string;
  loanId: string;
  versionNumber: number;
  isActive: boolean;
  reasonForVersion?: string;
  createdBy?: string;
  createdAt: string;
  items: LoanScheduleItem[];
}
