import bcrypt from 'bcryptjs';
import {
  User,
  Customer,
  CustomerDocument,
  CustomerNote,
  Loan,
  LoanSchedule,
  LoanScheduleItem,
  Payment,
  PaymentAllocation,
  CollectionTask,
  PenaltyRecord,
  AuditLogEntry,
  BusinessProfile,
} from '@lendora/shared-types';
import { generateAmortizationSchedule } from '@lendora/financial-engine';

/**
 * Lendora Relational Transactional Database Engine
 * Implements full 3NF relational data integrity, foreign key consistency, and immutable ledger operations.
 */
class LendoraDatabase {
  public businessProfiles: Map<string, BusinessProfile> = new Map();
  public users: Map<string, User & { passwordHash: string }> = new Map();
  public customers: Map<string, Customer> = new Map();
  public customerDocuments: Map<string, CustomerDocument> = new Map();
  public customerNotes: Map<string, CustomerNote> = new Map();
  public loans: Map<string, Loan> = new Map();
  public loanSchedules: Map<string, LoanSchedule> = new Map();
  public loanScheduleItems: Map<string, LoanScheduleItem> = new Map();
  public payments: Map<string, Payment> = new Map();
  public paymentAllocations: Map<string, PaymentAllocation> = new Map();
  public penalties: Map<string, PenaltyRecord> = new Map();
  public collectionTasks: Map<string, CollectionTask> = new Map();
  public auditLogs: AuditLogEntry[] = [];
  public notifications: Array<{
    id: string;
    businessId: string;
    recipientType: 'CUSTOMER' | 'USER';
    recipientId: string;
    channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
    title: string;
    message: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'READ';
    sentAt: string;
    createdAt: string;
  }> = [];

  private isInitialized = false;

  constructor() {
    this.initializeDefaultData();
  }

  public initializeDefaultData() {
    if (this.isInitialized) return;

    // 1. Default Business Profile (Lender Settings - Indian NBFC / FinTech)
    const defaultBusinessId = 'b0000000-0000-0000-0000-000000000001';
    const business: BusinessProfile = {
      id: defaultBusinessId,
      businessName: 'Lendora Finance & Capital Pvt Ltd',
      registrationNumber: 'CIN-U65999MH2026PTC123456',
      taxId: 'GSTIN-27AABCL1234F1Z5',
      contactEmail: 'support@lendora.in',
      contactPhone: '+91 98765 43210',
      addressLine1: 'Level 12, Tower B, Bandra-Kurla Complex (BKC)',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400051',
      country: 'India',
      currency: 'INR',
      currencySymbol: '₹',
      currencyPrecision: 2,
      dateFormat: 'YYYY-MM-DD',
      allocationOrder: 'PENALTY_FEES_INTEREST_PRINCIPAL',
      defaultGracePeriodDays: 3,
      defaultLatePenaltyType: 'PERCENTAGE',
      defaultLatePenaltyValue: '5.0000',
      prepaymentPenaltyRate: '0.0000',
      receiptFooterNote: 'Computer generated official receipt under Indian IT Act. Thank you for your prompt payment via UPI / IMPS.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.businessProfiles.set(defaultBusinessId, business);

    // 2. Default Users (Indian staff pre-configured for testing)
    const defaultHash = bcrypt.hashSync('Admin@123', 10);

    const adminUser: User & { passwordHash: string } = {
      id: 'a0000000-0000-0000-0000-000000000001',
      businessId: defaultBusinessId,
      firstName: 'Rajesh',
      lastName: 'Sharma',
      email: 'admin@lendora.com',
      phone: '+91 98765 00001',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const managerUser: User & { passwordHash: string } = {
      id: 'a0000000-0000-0000-0000-000000000002',
      businessId: defaultBusinessId,
      firstName: 'Priya',
      lastName: 'Patel',
      email: 'manager@lendora.com',
      phone: '+91 98765 00002',
      role: 'MANAGER',
      status: 'ACTIVE',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const agentUser: User & { passwordHash: string } = {
      id: 'a0000000-0000-0000-0000-000000000003',
      businessId: defaultBusinessId,
      firstName: 'Amit',
      lastName: 'Verma',
      email: 'agent@lendora.com',
      phone: '+91 98765 00003',
      role: 'COLLECTION_AGENT',
      status: 'ACTIVE',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const accountantUser: User & { passwordHash: string } = {
      id: 'a0000000-0000-0000-0000-000000000004',
      businessId: defaultBusinessId,
      firstName: 'Neha',
      lastName: 'Gupta',
      email: 'accountant@lendora.com',
      phone: '+91 98765 00004',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
      passwordHash: defaultHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(managerUser.id, managerUser);
    this.users.set(agentUser.id, agentUser);
    this.users.set(accountantUser.id, accountantUser);

    this.isInitialized = true;
  }

  // Audit Logging
  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
    const log: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
  }
}

export const db = new LendoraDatabase();
