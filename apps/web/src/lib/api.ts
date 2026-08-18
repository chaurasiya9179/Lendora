import { clientStore } from './clientStore.js';
import {
  generateAmortizationSchedule,
  calculatePaymentAllocation,
  calculateLatePenalty,
  calculateForeclosureQuote,
  restructureLoanSchedule,
} from '@lendora/financial-engine';
import {
  User,
  Customer,
  Loan,
  LoanSchedule,
  LoanScheduleItem,
  Payment,
  PaymentReceiptData,
  AgingBucketSummary,
  OverdueLoanItem,
} from '@lendora/shared-types';
import Decimal from 'decimal.js';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public message: string, public status?: number, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('lendora_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
        return { data: data.data, meta: data.meta } as unknown as T;
      }
      return (data && typeof data === 'object' && 'data' in data ? data.data : data) as unknown as T;
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ApiError(data.error || 'Request failed', response.status, data.details);
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    // Network / Offline error -> fallback
  }

  // Fallback to in-browser storage
  return handleLocalRequest<T>(endpoint, options);
}

function handleLocalRequest<T>(endpoint: string, options: RequestInit): T {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : {};

  // Auth: Login
  if (endpoint === '/auth/login' && method === 'POST') {
    const { email, password } = body;
    const user = clientStore.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user || (password !== 'Admin@123' && password !== 'password')) {
      throw new ApiError('Invalid email or password', 401);
    }
    clientStore.currentUser = user;
    const token = 'client-token-' + user.role.toLowerCase() + '-' + Date.now();
    return { token, user } as unknown as T;
  }

  // Auth: Me
  if (endpoint === '/auth/me') {
    const user = clientStore.currentUser || clientStore.users[0];
    return user as unknown as T;
  }

  // Dashboard Analytics
  if (endpoint === '/reports/dashboard') {
    const totalLoans = clientStore.loans.length;
    const activeLoans = clientStore.loans.filter(l => l.status === 'ACTIVE').length;
    const totalDisbursed = clientStore.loans.reduce((acc, l) => acc.plus(l.principalAmount || 0), new Decimal(0)).toFixed(2);
    const totalOutstanding = clientStore.loans.reduce((acc, l) => acc.plus(l.outstandingPrincipal || 0), new Decimal(0)).toFixed(2);
    const totalInterestDue = clientStore.loans.reduce((acc, l) => acc.plus(l.outstandingInterest || 0), new Decimal(0)).toFixed(2);
    const totalCollected = clientStore.payments.reduce((acc, p) => acc.plus(p.paymentAmount || 0), new Decimal(0)).toFixed(2);
    const totalInterestEarned = clientStore.payments.reduce((acc, p) => acc.plus(p.interestComponent || 0), new Decimal(0)).toFixed(2);

    return {
      metrics: {
        totalLoans,
        activeLoans,
        totalCustomers: clientStore.customers.length,
        activeCustomers: clientStore.customers.length,
        totalPrincipalDisbursed: totalDisbursed,
        totalPrincipalOutstanding: totalOutstanding,
        totalInterestOutstanding: totalInterestDue,
        totalAmountCollected: totalCollected,
        totalInterestEarned: totalInterestEarned,
        totalOverdueAmount: '12500.00',
        thisMonthCollection: totalCollected,
        todayCollection: '44583.33',
        collectionEfficiencyRate: '98.5',
        nonPerformingLoanRate: '0.0',
      },
      monthlyTrends: [
        { month: 'Apr', disbursed: 250000, collected: 210000, interest: 25000 },
        { month: 'May', disbursed: 350000, collected: 290000, interest: 38000 },
        { month: 'Jun', disbursed: 420000, collected: 360000, interest: 45000 },
        { month: 'Jul', disbursed: 480000, collected: 410000, interest: 52000 },
        { month: 'Aug', disbursed: 500000, collected: 44583, interest: 5833 },
      ],
      statusDistribution: [
        { name: 'Active', value: 1, count: 1 },
        { name: 'Fully Paid', value: 0, count: 0 },
        { name: 'Overdue', value: 0, count: 0 },
      ],
    } as unknown as T;
  }

  // Customers
  if (endpoint.startsWith('/customers') && method === 'GET') {
    if (endpoint.match(/\/customers\/[a-zA-Z0-9-]+$/)) {
      const id = endpoint.split('/').pop()!;
      const customer = clientStore.customers.find(c => c.id === id) || clientStore.customers[0];
      const customerLoans = clientStore.loans.filter(l => l.customerId === customer.id);
      return {
        ...customer,
        totalLoansCount: customerLoans.length,
        activeLoansCount: customerLoans.filter(l => l.status === 'ACTIVE').length,
        totalBorrowedPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.principalAmount), new Decimal(0)).toFixed(2),
        totalOutstandingPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.outstandingPrincipal), new Decimal(0)).toFixed(2),
        totalOutstandingInterest: customerLoans.reduce((acc, l) => acc.plus(l.outstandingInterest), new Decimal(0)).toFixed(2),
        totalPaidPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.totalPrincipalPaid), new Decimal(0)).toFixed(2),
        totalOverdueAmount: '0.00',
        loans: customerLoans,
        notes: clientStore.customerNotes[customer.id] || [],
        documents: [],
      } as unknown as T;
    }

    return {
      data: clientStore.customers,
      meta: { total: clientStore.customers.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  if (endpoint === '/customers' && method === 'POST') {
    const newCust: Customer = {
      id: 'c-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      customerCode: 'CUST-IND-' + (1000 + clientStore.customers.length + 1),
      ...body,
      kycStatus: 'VERIFIED',
      status: 'ACTIVE',
      creditScore: 750,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    clientStore.customers.unshift(newCust);
    clientStore.saveToStorage();
    return newCust as unknown as T;
  }

  // Loans: Preview Calculation
  if (endpoint === '/loans/preview-calculation' && method === 'POST') {
    const sched = generateAmortizationSchedule({
      principalAmount: body.principalAmount,
      annualInterestRate: body.interestRate,
      calculationMethod: body.interestCalculationMethod,
      paymentFrequency: body.paymentFrequency,
      totalInstallments: body.tenureValue,
      firstPaymentDate: body.firstPaymentDate,
      disbursementDate: body.disbursementDate,
    });
    return sched as unknown as T;
  }

  // Loans: List & Detail
  if (endpoint.startsWith('/loans') && method === 'GET') {
    if (endpoint.match(/\/loans\/[a-zA-Z0-9-]+$/)) {
      const id = endpoint.split('/').pop()!;
      const loan = clientStore.loans.find(l => l.id === id) || clientStore.loans[0];
      const schedule = clientStore.schedules[loan.id] || { versionNumber: 1, id: 'sch-1' };
      const items = clientStore.scheduleItems[loan.id] || [];
      const payments = clientStore.payments.filter(p => p.loanId === loan.id);
      return { loan, schedule, items, payments } as unknown as T;
    }

    return {
      data: clientStore.loans,
      meta: { total: clientStore.loans.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  // Loans: Create
  if (endpoint === '/loans' && method === 'POST') {
    const cust = clientStore.customers.find(c => c.id === body.customerId) || clientStore.customers[0];
    const scheduleGen = generateAmortizationSchedule({
      principalAmount: body.principalAmount,
      annualInterestRate: body.interestRate,
      calculationMethod: body.interestCalculationMethod,
      paymentFrequency: body.paymentFrequency,
      totalInstallments: body.tenureValue,
      firstPaymentDate: body.firstPaymentDate,
      disbursementDate: body.disbursementDate,
    });

    const newLoan: Loan = {
      id: 'l-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      customerId: cust.id,
      customerName: `${cust.firstName} ${cust.lastName}`,
      customerPhone: cust.phone,
      loanAccountNumber: 'LND-2026-' + (1000 + clientStore.loans.length + 1),
      loanType: body.loanType,
      principalAmount: body.principalAmount,
      interestRate: body.interestRate,
      interestRatePeriod: 'ANNUAL',
      interestCalculationMethod: body.interestCalculationMethod,
      tenureValue: body.tenureValue,
      tenureUnit: body.tenureUnit,
      paymentFrequency: body.paymentFrequency,
      disbursementDate: body.disbursementDate,
      firstPaymentDate: body.firstPaymentDate,
      maturityDate: scheduleGen.maturityDate || scheduleGen.items[scheduleGen.items.length - 1]?.dueDate || body.firstPaymentDate,
      totalInterestExpected: scheduleGen.totalInterestDue || '0.00',
      totalAmountExpected: scheduleGen.totalRepayable || body.principalAmount,
      installmentAmount: scheduleGen.periodicInstallmentAmount || '0.00',
      totalInstallments: body.tenureValue,
      outstandingPrincipal: body.principalAmount,
      outstandingInterest: scheduleGen.totalInterestDue || '0.00',
      outstandingPenalty: '0.00',
      totalPrincipalPaid: '0.00',
      totalInterestPaid: '0.00',
      totalPenaltyPaid: '0.00',
      totalAmountPaid: '0.00',
      paidInstallmentsCount: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    clientStore.loans.unshift(newLoan);
    clientStore.schedules[newLoan.id] = {
      id: 'sch-' + Date.now(),
      loanId: newLoan.id,
      versionNumber: 1,
      isActive: true,
      totalInstallments: body.tenureValue,
      createdAt: new Date().toISOString(),
    };
    clientStore.scheduleItems[newLoan.id] = scheduleGen.items.map(it => ({
      id: 'schi-' + Date.now() + '-' + it.installmentNumber,
      scheduleId: clientStore.schedules[newLoan.id].id,
      loanId: newLoan.id,
      installmentNumber: it.installmentNumber,
      dueDate: it.dueDate,
      openingPrincipal: it.openingPrincipal,
      principalDue: it.principalDue,
      interestDue: it.interestDue,
      totalDue: it.totalDue,
      closingPrincipal: it.closingPrincipal,
      principalPaid: '0.00',
      interestPaid: '0.00',
      penaltyPaid: '0.00',
      totalPaid: '0.00',
      status: 'PENDING',
      daysOverdue: 0,
      latePenaltyAccrued: '0.00',
    }));

    clientStore.saveToStorage();
    return newLoan as unknown as T;
  }

  // Payments: List & Record
  if (endpoint.startsWith('/payments') && method === 'GET') {
    if (endpoint.includes('/receipt')) {
      const pId = endpoint.split('/')[2];
      const p = clientStore.payments.find(pay => pay.id === pId) || clientStore.payments[0];
      const loan = clientStore.loans.find(l => l.id === p.loanId) || clientStore.loans[0];
      const cust = clientStore.customers.find(c => c.id === loan.customerId) || clientStore.customers[0];

      const receipt: PaymentReceiptData = {
        paymentId: p.id,
        receiptNumber: p.receiptNumber,
        businessName: clientStore.businessProfile.businessName,
        businessAddress: `${clientStore.businessProfile.addressLine1}, ${clientStore.businessProfile.city}, ${clientStore.businessProfile.state}`,
        businessPhone: clientStore.businessProfile.contactPhone,
        businessEmail: clientStore.businessProfile.contactEmail,
        customerName: p.customerName,
        customerCode: cust.customerCode,
        customerPhone: cust.phone,
        loanAccountNumber: p.loanAccountNumber,
        paymentDate: p.paymentDate,
        paymentAmount: p.paymentAmount,
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
        principalPaid: p.principalComponent,
        interestPaid: p.interestComponent,
        penaltyPaid: p.penaltyComponent,
        feesPaid: p.feeComponent,
        remainingPrincipalBalance: loan.outstandingPrincipal,
        collectedByName: p.collectedByName,
        footerNote: clientStore.businessProfile.receiptFooterNote,
      };
      return receipt as unknown as T;
    }

    return {
      data: clientStore.payments,
      meta: { total: clientStore.payments.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  if (endpoint === '/payments' && method === 'POST') {
    const loan = clientStore.loans.find(l => l.id === body.loanId) || clientStore.loans[0];
    const items = clientStore.scheduleItems[loan.id] || [];
    const pendingItem = items.find(it => it.status !== 'PAID') || items[0];

    const allocation = calculatePaymentAllocation({
      paymentAmount: body.paymentAmount,
      unpaidPenalty: pendingItem?.latePenaltyAccrued || '0',
      unpaidFees: '0',
      interestDue: pendingItem?.interestDue || '0',
      principalDue: pendingItem?.principalDue || body.paymentAmount,
      allocationOrder: 'PENALTY_FEES_INTEREST_PRINCIPAL',
    });

    const newPayment: Payment = {
      id: 'p-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      loanId: loan.id,
      customerId: loan.customerId,
      customerName: loan.customerName,
      loanAccountNumber: loan.loanAccountNumber,
      receiptNumber: 'REC-2026-' + (1000 + clientStore.payments.length + 1),
      paymentAmount: body.paymentAmount,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference || 'UPI-' + Date.now(),
      principalComponent: allocation.principalAllocated,
      interestComponent: allocation.interestAllocated,
      penaltyComponent: allocation.penaltyAllocated,
      feeComponent: allocation.feesAllocated,
      collectedByUserId: clientStore.users[0].id,
      collectedByName: `${clientStore.users[0].firstName} ${clientStore.users[0].lastName}`,
      isReversal: false,
      notes: body.notes || 'Payment recorded',
      createdAt: new Date().toISOString(),
    };

    clientStore.payments.unshift(newPayment);

    // Update loan balance
    loan.outstandingPrincipal = new Decimal(loan.outstandingPrincipal).minus(allocation.principalAllocated).toFixed(2);
    loan.totalPrincipalPaid = new Decimal(loan.totalPrincipalPaid).plus(allocation.principalAllocated).toFixed(2);
    loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(allocation.interestAllocated).toFixed(2);
    loan.totalAmountPaid = new Decimal(loan.totalAmountPaid).plus(body.paymentAmount).toFixed(2);
    loan.paidInstallmentsCount += 1;

    if (pendingItem) {
      pendingItem.status = 'PAID';
      pendingItem.principalPaid = allocation.principalAllocated;
      pendingItem.interestPaid = allocation.interestAllocated;
      pendingItem.totalPaid = body.paymentAmount;
      pendingItem.paidDate = body.paymentDate;
    }

    clientStore.saveToStorage();
    return { payment: newPayment, allocation } as unknown as T;
  }

  // Prepayment Quote & Foreclosure
  if (endpoint.includes('/prepayment-quote')) {
    const quote = calculateForeclosureQuote({
      outstandingPrincipal: '461250.00',
      outstandingInterest: '5833.33',
      accruedInterestSinceLastPayment: '1200.00',
      outstandingPenalty: '0.00',
      outstandingFees: '0.00',
      prepaymentPenaltyRate: '0.0',
      waiverDiscount: '0.0',
    });
    return quote as unknown as T;
  }

  // Overdue Aging Summary
  if (endpoint === '/overdue/aging-summary') {
    const summary: AgingBucketSummary[] = [
      { bucket: '1_TO_7_DAYS', bucketLabel: '1–7 Days', count: 1, totalPrincipalOverdue: '8500.00', totalInterestOverdue: '1200.00', totalAmountOverdue: '9700.00' },
      { bucket: '8_TO_30_DAYS', bucketLabel: '8–30 Days', count: 1, totalPrincipalOverdue: '12500.00', totalInterestOverdue: '1800.00', totalAmountOverdue: '14300.00' },
      { bucket: '31_TO_60_DAYS', bucketLabel: '31–60 Days', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalAmountOverdue: '0.00' },
      { bucket: '61_TO_90_DAYS', bucketLabel: '61–90 Days', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalAmountOverdue: '0.00' },
      { bucket: 'OVER_90_DAYS', bucketLabel: '90+ Days (NPL)', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalAmountOverdue: '0.00' },
    ];
    const overdueLoans: OverdueLoanItem[] = [
      {
        loanId: clientStore.loans[0].id,
        loanAccountNumber: 'LND-2026-1002',
        customerId: clientStore.customers[1].id,
        customerName: `${clientStore.customers[1].firstName} ${clientStore.customers[1].lastName}`,
        customerPhone: clientStore.customers[1].phone,
        bucket: '8_TO_30_DAYS',
        daysOverdue: 14,
        missedInstallmentsCount: 1,
        principalOverdue: '12500.00',
        interestOverdue: '1800.00',
        penaltiesAccrued: '250.00',
        totalOverdueAmount: '14550.00',
        lastPaymentDate: '2026-07-05',
      },
    ];
    return { summary, overdueLoans } as unknown as T;
  }

  // Collections
  if (endpoint.startsWith('/collections/tasks')) {
    return clientStore.collectionTasks as unknown as T;
  }

  if (endpoint === '/collections/performance') {
    return [
      { agentId: clientStore.users[2].id, agentName: 'Amit Verma', targetAmount: '500000.00', collectedAmount: '445000.00', efficiencyPercentage: '89.0', assignedTasksCount: 18, resolvedTasksCount: 16 },
      { agentId: clientStore.users[1].id, agentName: 'Priya Patel', targetAmount: '600000.00', collectedAmount: '580000.00', efficiencyPercentage: '96.6', assignedTasksCount: 22, resolvedTasksCount: 21 },
    ] as unknown as T;
  }

  // Auth: Register User
  if (endpoint === '/auth/register' && method === 'POST') {
    const newUser: User = {
      id: 'u-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone || '+91 98000 00000',
      role: body.role || 'COLLECTION_AGENT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    clientStore.users.push(newUser);
    clientStore.auditLogs.unshift({
      id: 'aud-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      userId: clientStore.currentUser?.id || clientStore.users[0].id,
      userName: `${clientStore.currentUser?.firstName || 'Admin'} ${clientStore.currentUser?.lastName || 'User'}`,
      userEmail: clientStore.currentUser?.email || 'admin@lendora.com',
      action: 'USER_REGISTERED',
      entity: 'USER',
      entityId: newUser.id,
      newValue: { email: newUser.email, role: newUser.role },
      createdAt: new Date().toISOString(),
    });
    clientStore.saveToStorage();
    return newUser as unknown as T;
  }

  // Users List
  if (endpoint === '/users' && method === 'GET') {
    return clientStore.users as unknown as T;
  }

  // Settings: Update
  if (endpoint === '/settings' && method === 'PUT') {
    clientStore.businessProfile = {
      ...clientStore.businessProfile,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    clientStore.saveToStorage();
    return clientStore.businessProfile as unknown as T;
  }

  // Customers: Update
  if (endpoint.startsWith('/customers/') && method === 'PUT') {
    const id = endpoint.split('/')[2];
    const idx = clientStore.customers.findIndex(c => c.id === id);
    if (idx !== -1) {
      clientStore.customers[idx] = {
        ...clientStore.customers[idx],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      clientStore.saveToStorage();
      return clientStore.customers[idx] as unknown as T;
    }
  }

  // Customers: Add Note
  if (endpoint.includes('/notes') && method === 'POST') {
    const customerId = endpoint.split('/')[2];
    const newNote = {
      id: 'note-' + Date.now(),
      customerId,
      authorId: clientStore.users[0].id,
      authorName: `${clientStore.users[0].firstName} ${clientStore.users[0].lastName}`,
      noteType: body.noteType || 'GENERAL',
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    if (!clientStore.customerNotes[customerId]) {
      clientStore.customerNotes[customerId] = [];
    }
    clientStore.customerNotes[customerId].unshift(newNote);
    clientStore.saveToStorage();
    return newNote as unknown as T;
  }

  // Audit Logs
  if (endpoint.startsWith('/audit-logs')) {
    return {
      data: clientStore.auditLogs,
      meta: { total: clientStore.auditLogs.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  // Settings: Get
  if (endpoint === '/settings') {
    return clientStore.businessProfile as unknown as T;
  }

  return {} as unknown as T;
}

export const api = {
  // Auth
  login: (credentials: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => request<any>('/auth/me'),
  registerUser: (userData: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),

  // Dashboard & Reports
  getDashboardAnalytics: () => request<any>('/reports/dashboard'),
  exportCSV: (type: 'loans' | 'payments' | 'customers') => `${API_BASE}/reports/export?type=${type}`,

  // Customers
  getCustomers: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/customers${qs}`);
  },
  getCustomerById: (id: string) => request<any>(`/customers/${id}`),
  createCustomer: (customer: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(customer) }),
  updateCustomer: (id: string, updates: any) => request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  addCustomerNote: (customerId: string, note: any) => request<any>(`/customers/${customerId}/notes`, { method: 'POST', body: JSON.stringify(note) }),
  addCustomerDocument: (customerId: string, doc: any) => request<any>(`/customers/${customerId}/documents`, { method: 'POST', body: JSON.stringify(doc) }),

  // Loans
  previewLoanCalculation: (params: any) => request<any>('/loans/preview-calculation', { method: 'POST', body: JSON.stringify(params) }),
  getLoans: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/loans${qs}`);
  },
  getLoanById: (id: string) => request<any>(`/loans/${id}`),
  createLoan: (loanData: any) => request<any>('/loans', { method: 'POST', body: JSON.stringify(loanData) }),
  getPrepaymentQuote: (id: string) => request<any>(`/loans/${id}/prepayment-quote`),
  forecloseLoan: (id: string, data: any) => request<any>(`/loans/${id}/foreclose`, { method: 'POST', body: JSON.stringify(data) }),
  restructureLoan: (id: string, data: any) => request<any>(`/loans/${id}/restructure`, { method: 'POST', body: JSON.stringify(data) }),
  updatePrincipal: (id: string, data: { newPrincipal: string; reason?: string }) => request<any>(`/loans/${id}/principal`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleEmiStatus: (id: string, data: { emiStatus: 'OPEN' | 'PAUSED' | 'CLOSED'; reason?: string }) => request<any>(`/loans/${id}/emi-status`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleScheduleItemStatus: (id: string, itemId: string, status: string) => request<any>(`/loans/${id}/schedule-items/${itemId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Payments
  getPayments: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/payments${qs}`);
  },
  getPaymentById: (id: string) => request<any>(`/payments/${id}`),
  getPaymentReceipt: (id: string) => request<any>(`/payments/${id}/receipt`),
  recordPayment: (paymentData: any) => request<any>('/payments', { method: 'POST', body: JSON.stringify(paymentData) }),
  reversePayment: (id: string, reason: string) => request<any>(`/payments/${id}/reverse`, { method: 'POST', body: JSON.stringify({ paymentId: id, reason }) }),

  // Overdue & Penalties
  getAgingSummary: () => request<any>('/overdue/aging-summary'),
  calculatePenalties: () => request<any>('/overdue/calculate-penalties', { method: 'POST' }),
  waivePenalty: (penaltyId: string, reason: string) => request<any>(`/overdue/penalties/${penaltyId}/waive`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Collections
  getCollectionTasks: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/collections/tasks${qs}`);
  },
  createCollectionTask: (task: any) => request<any>('/collections/tasks', { method: 'POST', body: JSON.stringify(task) }),
  updateCollectionNote: (taskId: string, data: any) => request<any>(`/collections/tasks/${taskId}/notes`, { method: 'PUT', body: JSON.stringify(data) }),
  getAgentPerformance: () => request<any>('/collections/performance'),

  // Audit Logs
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/audit-logs${qs}`);
  },

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (settings: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Users
  getUsers: () => request<any>('/users'),

  // Notifications
  getNotifications: () => request<any>('/notifications'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PUT' }),
};
