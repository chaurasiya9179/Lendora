export type AgingBucket = '1_TO_7_DAYS' | '8_TO_30_DAYS' | '31_TO_60_DAYS' | '61_TO_90_DAYS' | '90_PLUS_DAYS';

export interface AgingBucketSummary {
  bucket: AgingBucket;
  bucketLabel: string;
  count: number;
  totalPrincipalOverdue: string;
  totalInterestOverdue: string;
  totalPenaltyAccrued: string;
  totalAmountOverdue: string;
}

export interface OverdueLoanItem {
  loanId: string;
  loanAccountNumber: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  daysOverdue: number;
  bucket: AgingBucket;
  missedInstallmentsCount: number;
  totalOverdueAmount: string;
  principalOverdue: string;
  interestOverdue: string;
  penaltiesAccrued: string;
  lastPaymentDate?: string;
  assignedAgentName?: string;
}

export interface PenaltyRecord {
  id: string;
  loanId: string;
  scheduleItemId: string;
  penaltyAmount: string;
  penaltyReason: string;
  calculationDetails?: Record<string, unknown>;
  isWaived: boolean;
  waivedBy?: string;
  waivedByName?: string;
  waivedReason?: string;
  waivedAt?: string;
  createdAt: string;
}
