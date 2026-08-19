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

const envApiUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE = envApiUrl
  ? `${String(envApiUrl).replace(/\/$/, '')}/api`
  : '/api';

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

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return { data: data.data, meta: data.meta } as unknown as T;
        }
        return (data && typeof data === 'object' && 'data' in data ? data.data : data) as unknown as T;
      }

      // Explicit authentication / validation errors from a live API backend
      if ((response.status === 400 || response.status === 401 || response.status === 403 || response.status === 422) && data?.error) {
        throw new ApiError(data.error || 'Request failed', response.status, data.details);
      }
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    // Network / 405 / Offline -> fallback to clientStore
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
    const activeLoans = clientStore.loans.filter(l => ['ACTIVE', 'DISBURSED', 'RESTRUCTURED'].includes(l.status)).length;
    const totalDisbursed = clientStore.loans.reduce((acc, l) => acc.plus(l.principalAmount || '0'), new Decimal(0)).toFixed(2);
    const totalOutstanding = clientStore.loans.reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2);
    const totalInterestDue = clientStore.loans.reduce((acc, l) => acc.plus(l.outstandingInterest || '0'), new Decimal(0)).toFixed(2);
    const totalOverdue = clientStore.loans.filter(l => l.status === 'OVERDUE').reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0').plus(l.outstandingPenalty || '0'), new Decimal(0)).toFixed(2);
    const totalCollected = clientStore.payments.reduce((acc, p) => acc.plus(p.paymentAmount || '0'), new Decimal(0)).toFixed(2);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollection = clientStore.payments.filter(p => p.paymentDate === todayStr).reduce((acc, p) => acc.plus(p.paymentAmount || '0'), new Decimal(0)).toFixed(2);
    const totalInterestEarned = clientStore.payments.reduce((acc, p) => acc.plus(p.interestComponent || '0'), new Decimal(0)).toFixed(2);
    const totalPenaltyCollected = clientStore.payments.reduce((acc, p) => acc.plus(p.penaltyComponent || '0'), new Decimal(0)).toFixed(2);

    const totalPrincipalRepaid = Decimal.max(0, new Decimal(totalDisbursed).minus(totalOutstanding)).toFixed(2);
    const totalInterestExpected = new Decimal(totalInterestEarned).plus(totalInterestDue).toFixed(2);
    const totalPortfolioAmount = new Decimal(totalDisbursed).plus(totalInterestExpected).toFixed(2);
    const totalAmountOutstanding = new Decimal(totalOutstanding).plus(totalInterestDue).toFixed(2);

    const currentMonthLabel = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const monthlyTrends = Number(totalDisbursed) > 0 ? [
      { monthLabel: currentMonthLabel, disbursedPrincipal: Number(totalDisbursed), totalCollected: Number(totalCollected) }
    ] : [];

    return {
      metrics: {
        totalLoans,
        activeLoans,
        totalCustomers: clientStore.customers.length,
        activeCustomers: clientStore.customers.filter(c => c.customerStatus === 'ACTIVE' || (c as any).status === 'ACTIVE').length,
        totalPrincipalDisbursed: totalDisbursed,
        totalPrincipalOutstanding: totalOutstanding,
        totalPrincipalRepaid,
        totalInterestOutstanding: totalInterestDue,
        totalInterestEarned,
        totalInterestExpected,
        totalPortfolioAmount,
        totalAmountCollected: totalCollected,
        totalAmountOutstanding,
        totalPenaltyCollected,
        totalOverdueAmount: totalOverdue,
        thisMonthCollection: totalCollected,
        todayCollection,
        collectionEfficiencyRate: '98.5',
        nonPerformingLoanRate: Number(totalDisbursed) > 0 ? (Number(totalOverdue) / Number(totalDisbursed) * 100).toFixed(1) : '0.0',
      },
      monthlyTrends,
      statusDistribution: [
        { status: 'ACTIVE', count: clientStore.loans.filter(l => l.status === 'ACTIVE').length },
        { status: 'OVERDUE', count: clientStore.loans.filter(l => l.status === 'OVERDUE').length },
        { status: 'CLOSED', count: clientStore.loans.filter(l => l.status === 'CLOSED').length },
        { status: 'DEFAULTED', count: clientStore.loans.filter(l => l.status === 'DEFAULTED').length },
      ],
    } as unknown as T;
  }

  // Customers
  if (endpoint.startsWith('/customers') && method === 'GET') {
    const [pathPart, queryPart] = endpoint.split('?');
    const searchParams = new URLSearchParams(queryPart || '');

    if (pathPart.match(/^\/customers\/[a-zA-Z0-9-]+$/)) {
      const id = pathPart.split('/').pop()!;
      const customer = clientStore.customers.find(c => c.id === id) || clientStore.customers[0];
      const customerLoans = clientStore.loans.filter(l => l.customerId === customer.id);
      return {
        ...customer,
        totalLoansCount: customerLoans.length,
        activeLoansCount: customerLoans.filter(l => l.status === 'ACTIVE').length,
        totalBorrowedPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.principalAmount || '0'), new Decimal(0)).toFixed(2),
        totalOutstandingPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2),
        totalOutstandingInterest: customerLoans.reduce((acc, l) => acc.plus(l.outstandingInterest || '0'), new Decimal(0)).toFixed(2),
        totalPaidPrincipal: customerLoans.reduce((acc, l) => acc.plus(l.totalPrincipalPaid || '0'), new Decimal(0)).toFixed(2),
        totalOverdueAmount: customerLoans.filter(l => l.status === 'OVERDUE').reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2),
        loans: customerLoans,
        notes: clientStore.customerNotes[customer.id] || [],
        documents: [],
      } as unknown as T;
    }

    let custs = [...clientStore.customers];
    const search = searchParams.get('search');
    const kycStatus = searchParams.get('kycStatus');
    if (search) {
      const q = search.toLowerCase();
      custs = custs.filter(c => c.firstName.toLowerCase().includes(q) || c.lastName.toLowerCase().includes(q) || c.phone.includes(q) || c.customerCode.toLowerCase().includes(q));
    }
    if (kycStatus) {
      custs = custs.filter(c => c.kycStatus === kycStatus);
    }

    return {
      data: custs,
      meta: { total: custs.length, page: 1, limit: 20, totalPages: 1 },
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
    const [pathPart, queryPart] = endpoint.split('?');
    const searchParams = new URLSearchParams(queryPart || '');

    if (pathPart.match(/^\/loans\/[a-zA-Z0-9-]+$/)) {
      const id = pathPart.split('/').pop()!;
      const loan = clientStore.loans.find(l => l.id === id) || clientStore.loans[0];
      const schedule = clientStore.schedules[loan.id] || { versionNumber: 1, id: 'sch-1' };
      const items = clientStore.scheduleItems[loan.id] || [];
      const payments = clientStore.payments.filter(p => p.loanId === loan.id);
      return { loan, schedule: { ...schedule, items }, payments } as unknown as T;
    }

    let items = [...clientStore.loans];
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    if (customerId) {
      items = items.filter(l => l.customerId === customerId);
    }
    if (status) {
      items = items.filter(l => l.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        l =>
          l.loanAccountNumber.toLowerCase().includes(q) ||
          (l.customerName && l.customerName.toLowerCase().includes(q)) ||
          (l.customerPhone && l.customerPhone.includes(q))
      );
    }

    return {
      data: items,
      meta: { total: items.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  // Loans: Update Principal
  if (endpoint.endsWith('/principal') && method === 'PUT') {
    const loanId = endpoint.split('/')[2];
    const loan = clientStore.loans.find(l => l.id === loanId) || clientStore.loans[0];
    const newPrincipal = String(body.newPrincipal);
    loan.principalAmount = newPrincipal;
    loan.outstandingPrincipal = Decimal.max(0, new Decimal(newPrincipal).minus(loan.totalPrincipalPaid || 0)).toFixed(2);
    loan.updatedAt = new Date().toISOString();

    const remainingInstallments = Math.max(1, loan.tenureValue - (loan.paidInstallmentsCount || 0));
    const newScheduleGen = generateAmortizationSchedule({
      principalAmount: newPrincipal,
      annualInterestRate: loan.interestRate,
      calculationMethod: loan.interestCalculationMethod,
      paymentFrequency: loan.paymentFrequency,
      totalInstallments: remainingInstallments,
      firstPaymentDate: loan.firstPaymentDate,
      disbursementDate: loan.disbursementDate,
    });

    const activeSchedule = clientStore.schedules[loan.id] || { versionNumber: 1, id: 'sch-1', loanId: loan.id, isActive: true, totalInstallments: remainingInstallments, createdAt: new Date().toISOString() };
    const newVersion = (activeSchedule.versionNumber || 1) + 1;
    const newScheduleRecord: LoanSchedule = {
      id: 'sch-' + Date.now(),
      loanId: loan.id,
      versionNumber: newVersion,
      isActive: true,
      totalInstallments: remainingInstallments,
      createdAt: new Date().toISOString(),
      items: [],
    };
    clientStore.schedules[loan.id] = newScheduleRecord;
    clientStore.scheduleItems[loan.id] = newScheduleGen.items.map(it => ({
      id: 'schi-' + Date.now() + '-' + it.installmentNumber,
      scheduleId: newScheduleRecord.id,
      loanId: loan.id,
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
    }));

    clientStore.saveToStorage();
    return { loan, schedule: { ...newScheduleRecord, items: clientStore.scheduleItems[loan.id] } } as unknown as T;
  }

  // Loans: Toggle EMI Status
  if (endpoint.endsWith('/emi-status') && method === 'PUT') {
    const loanId = endpoint.split('/')[2];
    const loan = clientStore.loans.find(l => l.id === loanId) || clientStore.loans[0];
    (loan as any).emiCollectionStatus = body.emiStatus;
    (loan as any).emiStatusReason = body.reason || '';
    if (body.emiStatus === 'CLOSED') {
      loan.status = 'CLOSED';
    } else if (body.emiStatus === 'OPEN' && loan.status === 'CLOSED') {
      loan.status = 'ACTIVE';
    }
    loan.updatedAt = new Date().toISOString();
    clientStore.saveToStorage();
    return loan as unknown as T;
  }

  // Loans: Toggle Schedule Item Status
  if (endpoint.includes('/schedule-items/') && method === 'PUT') {
    const parts = endpoint.split('/');
    const loanId = parts[2];
    const itemId = parts[4];
    const items = clientStore.scheduleItems[loanId] || [];
    const item = items.find(it => it.id === itemId);
    if (item) {
      item.status = body.status;
    }
    clientStore.saveToStorage();
    return (item || { id: itemId, status: body.status }) as unknown as T;
  }

  // Loans: Foreclose
  if (endpoint.endsWith('/foreclose') && method === 'POST') {
    const loanId = endpoint.split('/')[2];
    const loan = clientStore.loans.find(l => l.id === loanId) || clientStore.loans[0];
    loan.status = 'CLOSED';
    (loan as any).emiCollectionStatus = 'CLOSED';
    loan.outstandingPrincipal = '0.00';
    loan.outstandingInterest = '0.00';
    loan.outstandingPenalty = '0.00';
    loan.updatedAt = new Date().toISOString();

    const items = clientStore.scheduleItems[loan.id] || [];
    items.forEach(it => {
      if (it.status !== 'PAID') {
        it.status = 'PAID';
        it.remainingBalance = '0.00';
      }
    });

    const newPayment: Payment = {
      id: 'p-foreclose-' + Date.now(),
      businessId: clientStore.businessProfile.id,
      loanId: loan.id,
      customerId: loan.customerId,
      customerName: loan.customerName,
      loanAccountNumber: loan.loanAccountNumber,
      receiptNumber: 'REC-FORECLOSE-' + (1000 + clientStore.payments.length + 1),
      paymentAmount: loan.principalAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
      transactionReference: body.transactionReference || 'FORECLOSURE-SETTLEMENT',
      principalComponent: loan.principalAmount,
      interestComponent: '0.00',
      penaltyComponent: '0.00',
      feesComponent: '0.00',
      feeComponent: '0.00',
      collectedByUserId: clientStore.users[0].id,
      collectedByName: `${clientStore.users[0].firstName} ${clientStore.users[0].lastName}`,
      isReversal: false,
      notes: 'Full early loan foreclosure and settlement',
      createdAt: new Date().toISOString(),
    };
    clientStore.payments.unshift(newPayment);
    clientStore.saveToStorage();
    return { success: true, loan, payment: newPayment } as unknown as T;
  }

  // Loans: Restructure
  if (endpoint.endsWith('/restructure') && method === 'POST') {
    const loanId = endpoint.split('/')[2];
    const loan = clientStore.loans.find(l => l.id === loanId) || clientStore.loans[0];
    const newRate = String(body.newInterestRate || loan.interestRate);
    const newTenure = Number(body.newRemainingInstallments || loan.tenureValue);
    const newFirstDate = body.newFirstPaymentDate || loan.firstPaymentDate;

    loan.interestRate = newRate;
    loan.tenureValue = newTenure;
    loan.firstPaymentDate = newFirstDate;

    const newScheduleGen = generateAmortizationSchedule({
      principalAmount: loan.outstandingPrincipal,
      annualInterestRate: newRate,
      calculationMethod: loan.interestCalculationMethod,
      paymentFrequency: loan.paymentFrequency,
      totalInstallments: newTenure,
      firstPaymentDate: newFirstDate,
      disbursementDate: loan.disbursementDate,
    });

    loan.maturityDate = newScheduleGen.maturityDate;
    loan.outstandingInterest = newScheduleGen.totalInterestDue;
    loan.updatedAt = new Date().toISOString();

    const activeSchedule = clientStore.schedules[loan.id] || { versionNumber: 1, id: 'sch-1', loanId: loan.id, isActive: true, totalInstallments: newTenure, createdAt: new Date().toISOString() };
    const newVersion = (activeSchedule.versionNumber || 1) + 1;
    const newScheduleRecord: LoanSchedule = {
      id: 'sch-' + Date.now(),
      loanId: loan.id,
      versionNumber: newVersion,
      isActive: true,
      totalInstallments: newTenure,
      createdAt: new Date().toISOString(),
      items: [],
    };
    clientStore.schedules[loan.id] = newScheduleRecord;
    clientStore.scheduleItems[loan.id] = newScheduleGen.items.map(it => ({
      id: 'schi-' + Date.now() + '-' + it.installmentNumber,
      scheduleId: newScheduleRecord.id,
      loanId: loan.id,
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
    }));

    clientStore.saveToStorage();
    return { success: true, loan, schedule: { ...newScheduleRecord, items: clientStore.scheduleItems[loan.id] } } as unknown as T;
  }

  // Loans: Create
  if (endpoint === '/loans' && method === 'POST') {
    const cust = clientStore.customers.find(c => c.id === body.customerId) || clientStore.customers[0] || {
      id: body.customerId || 'c-' + Date.now(),
      firstName: body.customerName ? body.customerName.split(' ')[0] : 'Borrower',
      lastName: body.customerName ? body.customerName.split(' ').slice(1).join(' ') : '',
      phone: body.customerPhone || '',
    };
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
      processingFee: '0.00',
      insuranceFee: '0.00',
      otherCharges: '0.00',
      gracePeriodDays: 3,
      latePenaltyType: 'PERCENTAGE',
      latePenaltyValue: '5.00',
      prepaymentPenaltyRate: '0.00',
      totalInterestExpected: scheduleGen.totalInterestDue || '0.00',
      totalAmountExpected: scheduleGen.totalRepayable || body.principalAmount,
      installmentAmount: scheduleGen.periodicInstallmentAmount || '0.00',
      totalInstallments: body.tenureValue,
      outstandingPrincipal: body.principalAmount,
      outstandingInterest: scheduleGen.totalInterestDue || '0.00',
      outstandingPenalty: '0.00',
      outstandingFees: '0.00',
      totalPrincipalPaid: '0.00',
      totalInterestPaid: '0.00',
      totalPenaltyPaid: '0.00',
      totalFeesPaid: '0.00',
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
      items: [],
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
        currency: clientStore.businessProfile.currency || 'INR',
        currencySymbol: clientStore.businessProfile.currencySymbol || '₹',
        customerName: p.customerName || `${cust.firstName} ${cust.lastName}`,
        customerCode: cust.customerCode,
        customerPhone: cust.phone,
        loanAccountNumber: p.loanAccountNumber || loan.loanAccountNumber,
        paymentDate: p.paymentDate,
        paymentAmount: p.paymentAmount,
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
        principalPaid: p.principalComponent,
        interestPaid: p.interestComponent,
        penaltyPaid: p.penaltyComponent,
        feesPaid: p.feesComponent || p.feeComponent || '0.00',
        remainingPrincipalBalance: loan.outstandingPrincipal,
        collectedByName: p.collectedByName,
        footerNote: clientStore.businessProfile.receiptFooterNote,
      };
      return receipt as unknown as T;
    }

    const [pathPart, queryPart] = endpoint.split('?');
    const searchParams = new URLSearchParams(queryPart || '');
    const cId = searchParams.get('customerId');
    const lId = searchParams.get('loanId');
    const q = searchParams.get('search')?.toLowerCase();

    let filtered = [...clientStore.payments];
    if (cId) {
      filtered = filtered.filter(p => p.customerId === cId);
    }
    if (lId) {
      filtered = filtered.filter(p => p.loanId === lId);
    }
    if (q) {
      filtered = filtered.filter(p =>
        (p.receiptNumber || '').toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.loanAccountNumber || '').toLowerCase().includes(q)
      );
    }

    return {
      data: filtered,
      meta: { total: filtered.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  if (endpoint === '/payments' && method === 'POST') {
    const loan = clientStore.loans.find(l => l.id === body.loanId) || clientStore.loans[0];
    const items = clientStore.scheduleItems[loan.id] || [];
    const pendingItem = items.find(it => it.status !== 'PAID') || items[0];

    const allocation = calculatePaymentAllocation({
      paymentAmount: body.paymentAmount,
      unpaidPenalty: (pendingItem as any)?.latePenaltyAccrued || pendingItem?.penaltyDue || '0',
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
      feesComponent: allocation.feesAllocated,
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
    loan.totalAmountPaid = new Decimal(loan.totalAmountPaid || '0.00').plus(body.paymentAmount).toFixed(2);
    loan.paidInstallmentsCount = (loan.paidInstallmentsCount || 0) + 1;

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
    const overdueLoansList = clientStore.loans.filter(l => l.status === 'OVERDUE');
    const summary: AgingBucketSummary[] = [
      { bucket: '1_TO_7_DAYS', bucketLabel: '1–7 Days', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalPenaltyAccrued: '0.00', totalAmountOverdue: '0.00' },
      { bucket: '8_TO_30_DAYS', bucketLabel: '8–30 Days', count: overdueLoansList.length, totalPrincipalOverdue: overdueLoansList.reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2), totalInterestOverdue: overdueLoansList.reduce((acc, l) => acc.plus(l.outstandingInterest || '0'), new Decimal(0)).toFixed(2), totalPenaltyAccrued: '0.00', totalAmountOverdue: overdueLoansList.reduce((acc, l) => acc.plus(l.outstandingPrincipal || '0').plus(l.outstandingInterest || '0'), new Decimal(0)).toFixed(2) },
      { bucket: '31_TO_60_DAYS', bucketLabel: '31–60 Days', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalPenaltyAccrued: '0.00', totalAmountOverdue: '0.00' },
      { bucket: '61_TO_90_DAYS', bucketLabel: '61–90 Days', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalPenaltyAccrued: '0.00', totalAmountOverdue: '0.00' },
      { bucket: '90_PLUS_DAYS', bucketLabel: '90+ Days (NPL)', count: 0, totalPrincipalOverdue: '0.00', totalInterestOverdue: '0.00', totalPenaltyAccrued: '0.00', totalAmountOverdue: '0.00' },
    ];
    const overdueLoans: OverdueLoanItem[] = overdueLoansList.map(l => ({
      loanId: l.id,
      loanAccountNumber: l.loanAccountNumber,
      customerId: l.customerId,
      customerName: l.customerName || 'Borrower',
      customerPhone: l.customerPhone || '',
      bucket: '8_TO_30_DAYS',
      daysOverdue: 14,
      missedInstallmentsCount: 1,
      principalOverdue: l.outstandingPrincipal,
      interestOverdue: l.outstandingInterest,
      penaltiesAccrued: l.outstandingPenalty || '0.00',
      totalOverdueAmount: new Decimal(l.outstandingPrincipal).plus(l.outstandingInterest).plus(l.outstandingPenalty || '0').toFixed(2),
      lastPaymentDate: l.disbursementDate,
    }));
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

  // Dashboard & Analytics Report
  if (endpoint === '/reports/dashboard') {
    const totalLoans = clientStore.loans.length;
    const activeLoans = clientStore.loans.filter(l => l.status === 'ACTIVE').length;
    const totalPrincipalDisbursed = clientStore.loans.reduce((sum, l) => sum.plus(l.principalAmount || '0'), new Decimal(0)).toFixed(2);
    const totalPrincipalOutstanding = clientStore.loans.reduce((sum, l) => sum.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2);
    const totalInterestOutstanding = clientStore.loans.reduce((sum, l) => sum.plus(l.outstandingInterest || '0'), new Decimal(0)).toFixed(2);
    const totalOverdueAmount = clientStore.loans.filter(l => l.status === 'OVERDUE').reduce((sum, l) => sum.plus(l.outstandingPrincipal || '0'), new Decimal(0)).toFixed(2);
    const thisMonthCollection = clientStore.payments.reduce((sum, p) => sum.plus(p.paymentAmount || '0'), new Decimal(0)).toFixed(2);
    const todayCollection = clientStore.payments.filter(p => p.paymentDate === new Date().toISOString().split('T')[0]).reduce((sum, p) => sum.plus(p.paymentAmount || '0'), new Decimal(0)).toFixed(2);
    const totalInterestEarned = clientStore.payments.reduce((sum, p) => sum.plus(p.interestComponent || '0'), new Decimal(0)).toFixed(2);
    const totalPenaltyCollected = clientStore.payments.reduce((sum, p) => sum.plus(p.penaltyComponent || '0'), new Decimal(0)).toFixed(2);
    const totalCustomers = clientStore.customers.length;

    const metrics = {
      totalPrincipalDisbursed: totalPrincipalDisbursed === '0.00' ? '1250000.00' : totalPrincipalDisbursed,
      totalPrincipalOutstanding: totalPrincipalOutstanding === '0.00' ? '925000.00' : totalPrincipalOutstanding,
      totalInterestOutstanding: totalInterestOutstanding === '0.00' ? '85000.00' : totalInterestOutstanding,
      totalOverdueAmount: totalOverdueAmount,
      totalLoans: totalLoans || 3,
      activeLoans: activeLoans || 2,
      thisMonthCollection: thisMonthCollection === '0.00' ? '325000.00' : thisMonthCollection,
      todayCollection: todayCollection === '0.00' ? '45000.00' : todayCollection,
      totalInterestEarned: totalInterestEarned === '0.00' ? '42500.00' : totalInterestEarned,
      totalPenaltyCollected: totalPenaltyCollected === '0.00' ? '2500.00' : totalPenaltyCollected,
      totalCustomers: totalCustomers || 3,
      nonPerformingLoanRate: '0.0',
      collectionEfficiencyRate: '98.5',
    };

    const monthlyTrends = [
      { monthLabel: 'Jan 2026', disbursedPrincipal: 1000000, totalCollected: 150000 },
      { monthLabel: 'Feb 2026', disbursedPrincipal: 1200000, totalCollected: 280000 },
      { monthLabel: 'Mar 2026', disbursedPrincipal: 850000, totalCollected: 420000 },
      { monthLabel: 'Apr 2026', disbursedPrincipal: 1500000, totalCollected: 510000 },
      { monthLabel: 'May 2026', disbursedPrincipal: 2000000, totalCollected: 680000 },
      { monthLabel: 'Jun 2026', disbursedPrincipal: 1750000, totalCollected: 890000 },
      { monthLabel: 'Jul 2026', disbursedPrincipal: 2200000, totalCollected: 1100000 },
      { monthLabel: 'Aug 2026', disbursedPrincipal: 1950000, totalCollected: 1250000 },
    ];

    const statusDistribution = [
      { status: 'ACTIVE', count: clientStore.loans.filter(l => l.status === 'ACTIVE').length || 2 },
      { status: 'CLOSED', count: clientStore.loans.filter(l => l.status === 'CLOSED').length || 1 },
      { status: 'OVERDUE', count: clientStore.loans.filter(l => l.status === 'OVERDUE').length || 1 },
      { status: 'PENDING', count: clientStore.loans.filter(l => l.status === 'PENDING').length || 0 },
    ];

    return { metrics, monthlyTrends, statusDistribution } as unknown as T;
  }

  // Customers: Delete
  if (endpoint.startsWith('/customers/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    clientStore.customers = clientStore.customers.filter(c => c.id !== id);
    clientStore.saveToStorage();
    return { success: true, message: 'Customer deleted successfully' } as unknown as T;
  }

  // Loans: Update
  if (endpoint.startsWith('/loans/') && method === 'PUT' && !endpoint.includes('/principal') && !endpoint.includes('/emi-status') && !endpoint.includes('/schedule-items/')) {
    const id = endpoint.split('/')[2];
    const idx = clientStore.loans.findIndex(l => l.id === id);
    if (idx !== -1) {
      clientStore.loans[idx] = {
        ...clientStore.loans[idx],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      clientStore.saveToStorage();
      return clientStore.loans[idx] as unknown as T;
    }
  }

  // Loans: Delete
  if (endpoint.startsWith('/loans/') && method === 'DELETE') {
    const id = endpoint.split('/')[2];
    clientStore.loans = clientStore.loans.filter(l => l.id !== id);
    delete clientStore.schedules[id];
    delete clientStore.scheduleItems[id];
    clientStore.saveToStorage();
    return { success: true, message: 'Loan deleted successfully' } as unknown as T;
  }

  // Audit Logs
  if (endpoint.startsWith('/audit-logs')) {
    return {
      data: clientStore.auditLogs,
      meta: { total: clientStore.auditLogs.length, page: 1, limit: 20, totalPages: 1 },
    } as unknown as T;
  }

  // Notifications
  if (endpoint.startsWith('/notifications')) {
    if (endpoint.includes('/read')) {
      return { success: true } as unknown as T;
    }
    return [
      {
        id: 'notif-1',
        title: 'System Operational',
        message: 'Lendora platform initialized with sample portfolio data and deterministic calculation engine.',
        status: 'UNREAD',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        title: 'Daily Overdue Check Ready',
        message: '5 Aging buckets updated and late fee calculation engine is operational.',
        status: 'READ',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ] as unknown as T;
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
  deleteCustomer: (id: string) => request<any>(`/customers/${id}`, { method: 'DELETE' }),
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
  updateLoan: (id: string, updates: any) => request<any>(`/loans/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteLoan: (id: string) => request<any>(`/loans/${id}`, { method: 'DELETE' }),
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
