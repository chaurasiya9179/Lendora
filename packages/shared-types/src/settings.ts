export type AllocationOrder =
  | 'PENALTY_FEES_INTEREST_PRINCIPAL'
  | 'PRINCIPAL_INTEREST_FEES_PENALTY'
  | 'INTEREST_PRINCIPAL_FEES_PENALTY'
  | 'FEES_PENALTY_INTEREST_PRINCIPAL';

export interface BusinessProfile {
  id: string;
  businessName: string;
  registrationNumber?: string;
  taxId?: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  currency: string;
  currencySymbol: string;
  currencyPrecision: number;
  dateFormat: string;
  allocationOrder: AllocationOrder;
  defaultGracePeriodDays: number;
  defaultLatePenaltyType: 'FIXED' | 'PERCENTAGE' | 'DAILY_PERCENTAGE';
  defaultLatePenaltyValue: string;
  prepaymentPenaltyRate: string;
  logoUrl?: string;
  receiptFooterNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  title: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  bodyTemplate: string;
  availableVariables: string[];
}
