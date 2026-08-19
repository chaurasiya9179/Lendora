import {
  User,
  Customer,
  CustomerNote,
  Loan,
  LoanSchedule,
  LoanScheduleItem,
  Payment,
  CollectionTask,
  AuditLogEntry,
  BusinessProfile,
  AgingBucketSummary,
  OverdueLoanItem,
  PaymentReceiptData,
} from '@lendora/shared-types';
import {
  generateAmortizationSchedule,
  calculatePaymentAllocation,
  calculateLatePenalty,
  calculateForeclosureQuote,
  restructureLoanSchedule,
} from '@lendora/financial-engine';
import Decimal from 'decimal.js';

class ClientDataStore {
  public businessProfile!: BusinessProfile;
  public users!: User[];
  public customers!: Customer[];
  public customerNotes: Record<string, CustomerNote[]> = {};
  public loans!: Loan[];
  public schedules: Record<string, LoanSchedule> = {};
  public scheduleItems: Record<string, LoanScheduleItem[]> = {};
  public payments!: Payment[];
  public collectionTasks!: CollectionTask[];
  public auditLogs: AuditLogEntry[] = [];
  public currentUser: User | null = null;

  private STORAGE_KEY = 'lendora_client_data_v4';

  constructor() {
    this.initDefault();
    this.loadFromStorage();
  }

  public saveToStorage(): void {
    try {
      const data = {
        businessProfile: this.businessProfile,
        users: this.users,
        customers: this.customers,
        customerNotes: this.customerNotes,
        loans: this.loans,
        schedules: this.schedules,
        scheduleItems: this.scheduleItems,
        payments: this.payments,
        collectionTasks: this.collectionTasks,
        auditLogs: this.auditLogs,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  public loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.customers && Array.isArray(parsed.customers) && parsed.customers.length > 0) this.customers = parsed.customers;
        if (parsed.users && Array.isArray(parsed.users) && parsed.users.length > 0) this.users = parsed.users;
        if (parsed.loans && Array.isArray(parsed.loans) && parsed.loans.length > 0) this.loans = parsed.loans;
        if (parsed.payments && Array.isArray(parsed.payments)) this.payments = parsed.payments;
        if (parsed.schedules && Object.keys(parsed.schedules).length > 0) this.schedules = parsed.schedules;
        if (parsed.scheduleItems && Object.keys(parsed.scheduleItems).length > 0) this.scheduleItems = parsed.scheduleItems;
        if (parsed.customerNotes) this.customerNotes = parsed.customerNotes;
        if (parsed.collectionTasks && Array.isArray(parsed.collectionTasks) && parsed.collectionTasks.length > 0) this.collectionTasks = parsed.collectionTasks;
        if (parsed.businessProfile) this.businessProfile = parsed.businessProfile;
        if (parsed.auditLogs && Array.isArray(parsed.auditLogs)) this.auditLogs = parsed.auditLogs;
      }
    } catch (e) {
      console.warn('Failed to load from localStorage', e);
    }
  }

  private initDefault(): void {
    // 1. Indian Business Profile
    this.businessProfile = {
      id: 'b0000000-0000-0000-0000-000000000001',
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

    // 2. Staff Users
    this.users = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        businessId: this.businessProfile.id,
        firstName: 'Rajesh',
        lastName: 'Sharma',
        email: 'admin@lendora.com',
        phone: '+91 98765 00001',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        businessId: this.businessProfile.id,
        firstName: 'Priya',
        lastName: 'Patel',
        email: 'manager@lendora.com',
        phone: '+91 98765 00002',
        role: 'MANAGER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        businessId: this.businessProfile.id,
        firstName: 'Amit',
        lastName: 'Verma',
        email: 'agent@lendora.com',
        phone: '+91 98765 00003',
        role: 'COLLECTION_AGENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'a0000000-0000-0000-0000-000000000004',
        businessId: this.businessProfile.id,
        firstName: 'Neha',
        lastName: 'Gupta',
        email: 'accountant@lendora.com',
        phone: '+91 98765 00004',
        role: 'ACCOUNTANT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const cust1: Customer = {
      id: '9a78955a-6ecc-4af8-acc8-151f0b4ae719',
      businessId: this.businessProfile.id,
      customerCode: 'CUST-00002',
      firstName: 'Prince',
      lastName: 'Soni',
      phone: '8685554254',
      idType: 'AADHAAR',
      country: 'India',
      monthlyIncome: '45000',
      creditScore: 780,
      kycStatus: 'VERIFIED',
      customerStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cust2: Customer = {
      id: '65ab3388-bebf-4f96-969f-772803e2995e',
      businessId: this.businessProfile.id,
      customerCode: 'CUST-00004',
      firstName: 'Kuldeep',
      lastName: 'Kumar',
      phone: '975644236',
      idType: 'AADHAAR',
      country: 'India',
      monthlyIncome: '40000',
      creditScore: 760,
      kycStatus: 'VERIFIED',
      customerStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.customers = [cust1, cust2];

    const todayStr = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];

    const loan1Sched = generateAmortizationSchedule({
      principalAmount: '50000',
      annualInterestRate: '24.0',
      calculationMethod: 'INTEREST_ONLY',
      paymentFrequency: 'MONTHLY',
      totalInstallments: 6,
      firstPaymentDate: nextMonthStr,
      disbursementDate: todayStr,
    });

    const loan1: Loan = {
      id: 'l-prince-soni-01',
      businessId: this.businessProfile.id,
      customerId: cust1.id,
      customerName: 'Prince Soni',
      customerPhone: cust1.phone,
      customerCode: cust1.customerCode,
      loanAccountNumber: 'LN-2026-00001',
      loanType: 'PERSONAL',
      principalAmount: '50000.00',
      interestRate: '24.00',
      interestRatePeriod: 'ANNUAL',
      interestCalculationMethod: 'INTEREST_ONLY',
      tenureValue: 6,
      tenureUnit: 'MONTHS',
      paymentFrequency: 'MONTHLY',
      disbursementDate: todayStr,
      firstPaymentDate: nextMonthStr,
      maturityDate: loan1Sched.maturityDate,
      processingFee: '0.00',
      insuranceFee: '0.00',
      otherCharges: '0.00',
      gracePeriodDays: 3,
      latePenaltyType: 'PERCENTAGE',
      latePenaltyValue: '5.00',
      prepaymentPenaltyRate: '0.00',
      totalPrincipalPaid: '0.00',
      totalInterestPaid: '0.00',
      totalPenaltyPaid: '0.00',
      totalFeesPaid: '0.00',
      totalAmountPaid: '0.00',
      totalInterestExpected: loan1Sched.totalInterestDue,
      totalAmountExpected: loan1Sched.totalRepayable,
      installmentAmount: loan1Sched.periodicInstallmentAmount,
      totalInstallments: 6,
      paidInstallmentsCount: 0,
      outstandingPrincipal: '50000.00',
      outstandingInterest: loan1Sched.totalInterestDue,
      outstandingPenalty: '0.00',
      outstandingFees: '0.00',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const loan2Sched = generateAmortizationSchedule({
      principalAmount: '50000',
      annualInterestRate: '24.0',
      calculationMethod: 'INTEREST_ONLY',
      paymentFrequency: 'MONTHLY',
      totalInstallments: 6,
      firstPaymentDate: nextMonthStr,
      disbursementDate: todayStr,
    });

    const loan2: Loan = {
      id: 'l-kuldeep-kumar-02',
      businessId: this.businessProfile.id,
      customerId: cust2.id,
      customerName: 'Kuldeep Kumar',
      customerPhone: cust2.phone,
      customerCode: cust2.customerCode,
      loanAccountNumber: 'LN-2026-00002',
      loanType: 'PERSONAL',
      principalAmount: '50000.00',
      interestRate: '24.00',
      interestRatePeriod: 'ANNUAL',
      interestCalculationMethod: 'INTEREST_ONLY',
      tenureValue: 6,
      tenureUnit: 'MONTHS',
      paymentFrequency: 'MONTHLY',
      disbursementDate: todayStr,
      firstPaymentDate: nextMonthStr,
      maturityDate: loan2Sched.maturityDate,
      processingFee: '0.00',
      insuranceFee: '0.00',
      otherCharges: '0.00',
      gracePeriodDays: 3,
      latePenaltyType: 'PERCENTAGE',
      latePenaltyValue: '5.00',
      prepaymentPenaltyRate: '0.00',
      totalPrincipalPaid: '0.00',
      totalInterestPaid: '0.00',
      totalPenaltyPaid: '0.00',
      totalFeesPaid: '0.00',
      totalAmountPaid: '0.00',
      totalInterestExpected: loan2Sched.totalInterestDue,
      totalAmountExpected: loan2Sched.totalRepayable,
      installmentAmount: loan2Sched.periodicInstallmentAmount,
      totalInstallments: 6,
      paidInstallmentsCount: 0,
      outstandingPrincipal: '50000.00',
      outstandingInterest: loan2Sched.totalInterestDue,
      outstandingPenalty: '0.00',
      outstandingFees: '0.00',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.loans = [loan1, loan2];
    this.schedules = {
      [loan1.id]: { id: 'sch-1', loanId: loan1.id, versionNumber: 1, isActive: true, totalInstallments: 6, createdAt: new Date().toISOString(), items: [] },
      [loan2.id]: { id: 'sch-2', loanId: loan2.id, versionNumber: 1, isActive: true, totalInstallments: 6, createdAt: new Date().toISOString(), items: [] },
    };
    this.scheduleItems = {
      [loan1.id]: loan1Sched.items.map(it => ({
        id: 'schi-1-' + it.installmentNumber,
        scheduleId: 'sch-1',
        loanId: loan1.id,
        installmentNumber: it.installmentNumber,
        dueDate: it.dueDate,
        openingPrincipal: it.openingPrincipal,
        principalDue: it.principalDue,
        interestDue: it.interestDue,
        feesDue: '0.00',
        penaltyDue: '0.00',
        totalEmiAmount: it.totalDue,
        totalDue: it.totalDue,
        closingPrincipal: it.closingPrincipal,
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        feesPaid: '0.00',
        totalPaid: '0.00',
        remainingBalance: it.totalDue,
        status: 'UPCOMING',
        daysOverdue: 0,
        latePenaltyAccrued: '0.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      [loan2.id]: loan2Sched.items.map(it => ({
        id: 'schi-2-' + it.installmentNumber,
        scheduleId: 'sch-2',
        loanId: loan2.id,
        installmentNumber: it.installmentNumber,
        dueDate: it.dueDate,
        openingPrincipal: it.openingPrincipal,
        principalDue: it.principalDue,
        interestDue: it.interestDue,
        feesDue: '0.00',
        penaltyDue: '0.00',
        totalEmiAmount: it.totalDue,
        totalDue: it.totalDue,
        closingPrincipal: it.closingPrincipal,
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        feesPaid: '0.00',
        totalPaid: '0.00',
        remainingBalance: it.totalDue,
        status: 'UPCOMING',
        daysOverdue: 0,
        latePenaltyAccrued: '0.00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    };
    this.payments = [];
    this.collectionTasks = [];
    this.auditLogs = [];
  }
}

export const clientStore = new ClientDataStore();
