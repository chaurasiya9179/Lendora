export type PaymentMethod =
  | 'UPI'
  | 'IMPS_NEFT'
  | 'CASH'
  | 'CHEQUE'
  | 'NACH_AUTODEBIT'
  | 'BANK_TRANSFER'
  | 'CARD'
  | 'ADJUSTMENT';

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  scheduleItemId: string;
  installmentNumber?: number;
  principalAllocated: string;
  interestAllocated: string;
  penaltyAllocated: string;
  feesAllocated: string;
  totalAllocated: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  businessId: string;
  customerId: string;
  customerName?: string;
  loanId: string;
  loanAccountNumber?: string;
  receiptNumber: string;
  paymentDate: string;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  principalComponent: string;
  interestComponent: string;
  penaltyComponent: string;
  feesComponent?: string;
  feeComponent?: string;
  excessAmount?: string;
  isReversal: boolean;
  reversedPaymentId?: string;
  collectedBy?: string;
  collectedByName?: string;
  collectedByUserId?: string;
  notes?: string;
  allocations?: PaymentAllocation[];
  createdAt: string;
}

export interface PaymentReceiptData {
  paymentId?: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  currency?: string;
  currencySymbol?: string;
  receiptNumber: string;
  paymentDate: string;
  customerName: string;
  customerCode: string;
  customerPhone: string;
  loanAccountNumber: string;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  principalPaid: string;
  interestPaid: string;
  penaltyPaid: string;
  feesPaid: string;
  remainingPrincipalBalance: string;
  collectedByName?: string;
  footerNote?: string;
}
