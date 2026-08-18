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

  private STORAGE_KEY = 'lendora_client_data_v2';

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
        if (parsed.customers && Array.isArray(parsed.customers)) this.customers = parsed.customers;
        if (parsed.users && Array.isArray(parsed.users)) this.users = parsed.users;
        if (parsed.loans && Array.isArray(parsed.loans)) this.loans = parsed.loans;
        if (parsed.payments && Array.isArray(parsed.payments)) this.payments = parsed.payments;
        if (parsed.schedules) this.schedules = parsed.schedules;
        if (parsed.scheduleItems) this.scheduleItems = parsed.scheduleItems;
        if (parsed.customerNotes) this.customerNotes = parsed.customerNotes;
        if (parsed.collectionTasks && Array.isArray(parsed.collectionTasks)) this.collectionTasks = parsed.collectionTasks;
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

    // 3. Indian Customers (Aadhaar & PAN KYC)
    this.customers = [
      {
        id: 'c0000000-0000-0000-0000-000000000001',
        businessId: this.businessProfile.id,
        customerCode: 'CUST-IND-1001',
        firstName: 'Vikram',
        lastName: 'Malhotra',
        email: 'vikram.malhotra@gmail.com',
        phone: '+91 98201 12345',
        idType: 'PAN',
        idNumber: 'ABCDE1234F',
        addressLine1: 'Flat 402, Shanti Heights, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400053',
        country: 'India',
        occupation: 'Business Owner / MSME',
        employerName: 'Malhotra Logistics Pvt Ltd',
        monthlyIncome: '150000.00',
        kycStatus: 'VERIFIED',
        status: 'ACTIVE',
        creditScore: 780,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c0000000-0000-0000-0000-000000000002',
        businessId: this.businessProfile.id,
        customerCode: 'CUST-IND-1002',
        firstName: 'Sunita',
        lastName: 'Reddy',
        email: 'sunita.reddy@yahoo.com',
        phone: '+91 94401 56789',
        idType: 'AADHAAR',
        idNumber: 'XXXX-XXXX-9012',
        addressLine1: 'Plot 88, Jubilee Hills, Road No 36',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500033',
        country: 'India',
        occupation: 'Software Consultant',
        employerName: 'Tech Mahindra Ltd',
        monthlyIncome: '220000.00',
        kycStatus: 'VERIFIED',
        status: 'ACTIVE',
        creditScore: 810,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        businessId: this.businessProfile.id,
        customerCode: 'CUST-IND-1003',
        firstName: 'Ramesh',
        lastName: 'Kumar',
        email: 'ramesh.kumar@gmail.com',
        phone: '+91 98111 88990',
        idType: 'AADHAAR',
        idNumber: 'XXXX-XXXX-4567',
        addressLine1: 'C-4/12, Janakpuri',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110058',
        country: 'India',
        occupation: 'Retail Shopkeeper (Vyapar)',
        employerName: 'Kumar Electronics Store',
        monthlyIncome: '75000.00',
        kycStatus: 'VERIFIED',
        status: 'ACTIVE',
        creditScore: 690,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Seed Initial Active Loans & Amortization Schedules
    const today = new Date();
    const firstDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 5).toISOString().split('T')[0];

    const scheduleGen1 = generateAmortizationSchedule({
      principalAmount: '500000.00',
      annualInterestRate: '14.0',
      calculationMethod: 'EMI_REDUCING',
      paymentFrequency: 'MONTHLY',
      totalInstallments: 12,
      firstPaymentDate: firstDueDate,
      disbursementDate: today.toISOString().split('T')[0],
    });

    const loan1: Loan = {
      id: 'l0000000-0000-0000-0000-000000000001',
      businessId: this.businessProfile.id,
      customerId: this.customers[0].id,
      customerName: `${this.customers[0].firstName} ${this.customers[0].lastName}`,
      customerPhone: this.customers[0].phone,
      loanAccountNumber: 'LND-2026-1001',
      loanType: 'BUSINESS',
      principalAmount: '500000.00',
      interestRate: '14.0',
      interestRatePeriod: 'ANNUAL',
      interestCalculationMethod: 'EMI_REDUCING',
      tenureValue: 12,
      tenureUnit: 'MONTHS',
      paymentFrequency: 'MONTHLY',
      disbursementDate: today.toISOString().split('T')[0],
      firstPaymentDate: firstDueDate,
      maturityDate: scheduleGen1.maturityDate || scheduleGen1.items[scheduleGen1.items.length - 1]?.dueDate || firstDueDate,
      totalInterestExpected: scheduleGen1.totalInterestDue || '38333.33',
      totalAmountExpected: scheduleGen1.totalRepayable || '538333.33',
      installmentAmount: scheduleGen1.periodicInstallmentAmount || '44861.11',
      totalInstallments: 12,
      outstandingPrincipal: '461250.00',
      outstandingInterest: '5833.33',
      outstandingPenalty: '0.00',
      totalPrincipalPaid: '38750.00',
      totalInterestPaid: '5833.33',
      totalPenaltyPaid: '0.00',
      totalAmountPaid: '44583.33',
      paidInstallmentsCount: 1,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const schedObj1: LoanSchedule = {
      id: 'sch-001',
      loanId: loan1.id,
      versionNumber: 1,
      isActive: true,
      totalInstallments: 12,
      createdAt: new Date().toISOString(),
    };

    this.loans = [loan1];
    this.schedules[loan1.id] = schedObj1;
    this.scheduleItems[loan1.id] = scheduleGen1.items.map((it, idx) => ({
      id: `schi-1-${it.installmentNumber}`,
      scheduleId: schedObj1.id,
      loanId: loan1.id,
      installmentNumber: it.installmentNumber,
      dueDate: it.dueDate,
      openingPrincipal: it.openingPrincipal,
      principalDue: it.principalDue,
      interestDue: it.interestDue,
      totalDue: it.totalDue,
      closingPrincipal: it.closingPrincipal,
      principalPaid: idx === 0 ? it.principalDue : '0.00',
      interestPaid: idx === 0 ? it.interestDue : '0.00',
      penaltyPaid: '0.00',
      totalPaid: idx === 0 ? it.totalDue : '0.00',
      status: idx === 0 ? 'PAID' : 'PENDING',
      paidDate: idx === 0 ? today.toISOString().split('T')[0] : undefined,
      daysOverdue: 0,
      latePenaltyAccrued: '0.00',
    }));

    // Seed Payment Transaction
    const payment1: Payment = {
      id: 'p0000000-0000-0000-0000-000000000001',
      businessId: this.businessProfile.id,
      loanId: loan1.id,
      customerId: this.customers[0].id,
      customerName: loan1.customerName,
      loanAccountNumber: loan1.loanAccountNumber,
      receiptNumber: 'REC-2026-00001',
      paymentAmount: '44583.33',
      paymentDate: today.toISOString().split('T')[0],
      paymentMethod: 'UPI',
      transactionReference: 'UPI-UTR-99887711',
      principalComponent: '38750.00',
      interestComponent: '5833.33',
      penaltyComponent: '0.00',
      feeComponent: '0.00',
      collectedByUserId: this.users[0].id,
      collectedByName: `${this.users[0].firstName} ${this.users[0].lastName}`,
      isReversal: false,
      notes: 'First EMI received via UPI',
      createdAt: new Date().toISOString(),
    };
    this.payments = [payment1];

    // Seed Collection Tasks
    this.collectionTasks = [
      {
        id: 'task-001',
        businessId: this.businessProfile.id,
        customerId: this.customers[2].id,
        customerName: `${this.customers[2].firstName} ${this.customers[2].lastName}`,
        customerPhone: this.customers[2].phone,
        loanId: loan1.id,
        loanAccountNumber: 'LND-2026-1003',
        overdueAmount: '12500.00',
        assignedAgentId: this.users[2].id,
        assignedAgentName: 'Amit Verma',
        priority: 'HIGH',
        status: 'PROMISE_TO_PAY',
        promiseToPayDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        promiseAmount: '12500.00',
        contactResult: 'PROMISED',
        notes: 'Borrower agreed to transfer via Google Pay on Friday',
        dueDate: today.toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      },
    ];

    // Audit logs
    this.auditLogs = [
      {
        id: 'aud-001',
        businessId: this.businessProfile.id,
        userId: this.users[0].id,
        userName: 'Rajesh Sharma',
        userEmail: 'admin@lendora.com',
        action: 'LOAN_CREATED',
        entity: 'LOAN',
        entityId: loan1.id,
        newValue: { loanAccountNumber: loan1.loanAccountNumber, principalAmount: loan1.principalAmount },
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export const clientStore = new ClientDataStore();
