export type LoanType =
  | 'PERSONAL'
  | 'BUSINESS'
  | 'GOLD_LOAN'
  | 'VEHICLE'
  | 'MICROFINANCE'
  | 'MORTGAGE'
  | 'DASTI_DAILY'
  | 'EQUIPMENT'
  | 'EDUCATION';

export type LoanStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'RESTRUCTURED'
  | 'CLOSED'
  | 'DEFAULTED'
  | 'REJECTED';

export type InterestRatePeriod = 'ANNUAL' | 'MONTHLY' | 'DAILY';
export type TenureUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'LUMP_SUM';
export type CalculationMethod =
  | 'EMI_REDUCING'
  | 'SIMPLE_INTEREST'
  | 'COMPOUND_INTEREST'
  | 'FLAT_RATE'
  | 'REDUCING_BALANCE';

export type LatePenaltyType = 'FIXED' | 'PERCENTAGE' | 'DAILY_PERCENTAGE';

export interface Loan {
  id: string;
  businessId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerCode?: string;
  loanAccountNumber: string;
  loanType: LoanType;
  principalAmount: string;
  interestRate: string;
  interestRatePeriod: InterestRatePeriod;
  interestCalculationMethod: CalculationMethod;
  tenureValue: number;
  tenureUnit: TenureUnit;
  paymentFrequency: PaymentFrequency;
  disbursementDate: string;
  firstPaymentDate: string;
  maturityDate: string;
  processingFee: string;
  insuranceFee: string;
  otherCharges: string;
  gracePeriodDays: number;
  latePenaltyType: LatePenaltyType;
  latePenaltyValue: string;
  prepaymentPenaltyRate: string;
  totalPrincipalPaid: string;
  totalInterestPaid: string;
  totalPenaltyPaid: string;
  totalFeesPaid: string;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingPenalty: string;
  outstandingFees: string;
  status: LoanStatus;
  approvedBy?: string;
  approvedAt?: string;
  disbursedBy?: string;
  disbursedAt?: string;
  closedAt?: string;
  closureReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
