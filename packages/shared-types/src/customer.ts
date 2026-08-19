export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';
export type IDType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'PASSPORT' | 'GSTIN';

export interface Customer {
  id: string;
  businessId: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: string;
  idType?: IDType;
  idNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  occupation?: string;
  employerName?: string;
  monthlyIncome: string;
  creditScore?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  kycStatus: KYCStatus;
  customerStatus: CustomerStatus;
  status?: CustomerStatus;
  assignedStaffId?: string;
  assignedStaffName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType =
  | 'IDENTITY_PROOF'
  | 'ADDRESS_PROOF'
  | 'INCOME_PROOF'
  | 'LOAN_AGREEMENT'
  | 'COLLATERAL'
  | 'OTHER';

export interface CustomerDocument {
  id: string;
  customerId: string;
  documentType: DocumentType;
  documentName: string;
  filePath: string;
  fileSizeBytes?: number;
  mimeType?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  uploadedBy?: string;
  createdAt: string;
}

export type CustomerNoteType =
  | 'GENERAL'
  | 'CALL_LOG'
  | 'KYC'
  | 'COLLECTION'
  | 'PAYMENT_REMINDER'
  | 'LOAN_INQUIRY';

export interface CustomerNote {
  id: string;
  customerId: string;
  authorId?: string;
  authorName?: string;
  noteType: CustomerNoteType;
  content: string;
  createdAt: string;
}

export interface CustomerSummaryProfile extends Customer {
  totalLoansCount: number;
  activeLoansCount: number;
  totalBorrowedPrincipal: string;
  totalPaidPrincipal: string;
  totalOutstandingPrincipal: string;
  totalOutstandingInterest: string;
  totalPaidInterest?: string;
  totalInterestExpected?: string;
  totalPortfolioAmount?: string;
  totalAmountPaid?: string;
  totalOverdueAmount: string;
  documents: CustomerDocument[];
  notesList: CustomerNote[];
}
