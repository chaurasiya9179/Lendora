import { Response } from 'express';
import { db } from '../../database/db.js';
import { pgPool, queryPostgres } from '../../database/postgres.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import {
  LoanCreationInput,
  LoanPreviewInput,
  LoanRestructureInput,
  LoanForeclosureInput,
} from '@lendora/validation';
import {
  generateAmortizationSchedule,
  calculateForeclosureQuote,
  restructureLoanSchedule,
} from '@lendora/financial-engine';
import { Loan, LoanSchedule, LoanScheduleItem, Payment, Customer } from '@lendora/shared-types';
import Decimal from 'decimal.js';

function mapDbCustomer(row: any): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    customerCode: row.customer_code,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || undefined,
    phone: row.phone,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : undefined,
    idType: row.id_type || 'AADHAAR',
    idNumber: row.id_number || undefined,
    addressLine1: row.address_line1 || undefined,
    addressLine2: row.address_line2 || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    postalCode: row.postal_code || undefined,
    country: row.country || 'India',
    occupation: row.occupation || undefined,
    employerName: row.employer_name || undefined,
    monthlyIncome: row.monthly_income ? String(row.monthly_income) : '0',
    creditScore: row.credit_score || undefined,
    kycStatus: row.kyc_status || 'PENDING',
    customerStatus: row.customer_status || 'ACTIVE',
    notes: row.notes || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapDbLoan(row: any): Loan {
  const customerName = row.first_name && row.last_name 
    ? `${row.first_name} ${row.last_name}`
    : row.customer_name || 'Borrower';
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName,
    customerPhone: row.customer_phone || row.phone || undefined,
    customerCode: row.customer_code || undefined,
    loanAccountNumber: row.loan_account_number,
    loanType: row.loan_type,
    principalAmount: String(row.principal_amount),
    interestRate: String(row.interest_rate),
    interestRatePeriod: row.interest_rate_period || 'ANNUAL',
    interestCalculationMethod: row.interest_calculation_method,
    tenureValue: Number(row.tenure_value),
    tenureUnit: row.tenure_unit || 'MONTHS',
    paymentFrequency: row.payment_frequency,
    disbursementDate: row.disbursement_date ? new Date(row.disbursement_date).toISOString().split('T')[0] : '',
    firstPaymentDate: row.first_payment_date ? new Date(row.first_payment_date).toISOString().split('T')[0] : '',
    maturityDate: row.maturity_date ? new Date(row.maturity_date).toISOString().split('T')[0] : '',
    processingFee: row.processing_fee ? String(row.processing_fee) : '0.00',
    insuranceFee: row.insurance_fee ? String(row.insurance_fee) : '0.00',
    otherCharges: row.other_charges ? String(row.other_charges) : '0.00',
    gracePeriodDays: row.grace_period_days || 0,
    latePenaltyType: row.late_penalty_type || 'PERCENTAGE',
    latePenaltyValue: row.late_penalty_value ? String(row.late_penalty_value) : '0.00',
    prepaymentPenaltyRate: row.prepayment_penalty_rate ? String(row.prepayment_penalty_rate) : '0.00',
    totalPrincipalPaid: row.total_principal_paid ? String(row.total_principal_paid) : '0.00',
    totalInterestPaid: row.total_interest_paid ? String(row.total_interest_paid) : '0.00',
    totalPenaltyPaid: row.total_penalty_paid ? String(row.total_penalty_paid) : '0.00',
    totalFeesPaid: row.total_fees_paid ? String(row.total_fees_paid) : '0.00',
    outstandingPrincipal: String(row.outstanding_principal),
    outstandingInterest: String(row.outstanding_interest),
    outstandingPenalty: row.outstanding_penalty ? String(row.outstanding_penalty) : '0.00',
    outstandingFees: row.outstanding_fees ? String(row.outstanding_fees) : '0.00',
    status: row.status,
    notes: row.notes || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class LoansController {
  public static async previewCalculation(req: AuthenticatedRequest & { body: LoanPreviewInput }, res: Response): Promise<void> {
    try {
      const schedule = generateAmortizationSchedule({
        principalAmount: req.body.principalAmount,
        annualInterestRate: req.body.interestRate,
        calculationMethod: req.body.interestCalculationMethod,
        paymentFrequency: req.body.paymentFrequency,
        totalInstallments: req.body.tenureValue,
        firstPaymentDate: req.body.firstPaymentDate,
        disbursementDate: req.body.disbursementDate,
      });

      res.json({
        success: true,
        data: schedule,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Calculation error' });
    }
  }

  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { status, customerId, search, page = '1', limit = '20' } = req.query;

    let items: Loan[] = [];

    if (pgPool) {
      try {
        let query = `
          SELECT l.*, c.first_name, c.last_name, c.phone as customer_phone, c.customer_code
          FROM loans l
          LEFT JOIN customers c ON l.customer_id = c.id
          WHERE l.business_id = $1
        `;
        const params: any[] = [businessId];

        if (status && typeof status === 'string') {
          params.push(status);
          query += ` AND l.status = $${params.length}`;
        }

        if (customerId && typeof customerId === 'string') {
          params.push(customerId);
          query += ` AND l.customer_id = $${params.length}`;
        }

        if (search && typeof search === 'string') {
          params.push(`%${search.toLowerCase()}%`);
          query += ` AND (LOWER(l.loan_account_number) LIKE $${params.length} OR LOWER(c.first_name) LIKE $${params.length} OR LOWER(c.last_name) LIKE $${params.length} OR c.phone LIKE $${params.length})`;
        }

        query += ' ORDER BY l.created_at DESC';

        const result = await queryPostgres(query, params);
        items = result.rows.map(mapDbLoan);
        for (const l of items) {
          db.loans.set(l.id, l);
        }
      } catch (err) {
        console.warn('PostgreSQL loans list fallback to in-memory:', err);
        items = Array.from(db.loans.values()).filter(l => l.businessId === businessId);
      }
    } else {
      items = Array.from(db.loans.values()).filter(l => l.businessId === businessId);

      if (status && typeof status === 'string') {
        items = items.filter(l => l.status === status);
      }

      if (customerId && typeof customerId === 'string') {
        items = items.filter(l => l.customerId === customerId);
      }

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        items = items.filter(
          l =>
            l.loanAccountNumber.toLowerCase().includes(q) ||
            (l.customerName && l.customerName.toLowerCase().includes(q)) ||
            (l.customerPhone && l.customerPhone.includes(q))
        );
      }
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const total = items.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = items.slice(start, start + limitNum);

    res.json({
      success: true,
      data: paginated,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  }

  public static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    let loan: Loan | undefined;

    if (pgPool) {
      try {
        const result = await queryPostgres(`
          SELECT l.*, c.first_name, c.last_name, c.phone as customer_phone, c.customer_code
          FROM loans l
          LEFT JOIN customers c ON l.customer_id = c.id
          WHERE l.id = $1 AND l.business_id = $2
        `, [id, req.user!.businessId]);
        if (result.rows.length > 0) {
          loan = mapDbLoan(result.rows[0]);
          db.loans.set(loan.id, loan);
        }
      } catch (err) {
        console.warn('PostgreSQL loan getById error:', err);
      }
    }

    if (!loan) {
      loan = db.loans.get(id);
    }

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    // Get active schedule
    let activeSchedule: LoanSchedule | null = null;
    let scheduleItems: LoanScheduleItem[] = [];
    let loanPayments: Payment[] = [];

    if (pgPool) {
      try {
        const schedRes = await queryPostgres(`
          SELECT * FROM loan_schedules WHERE loan_id = $1 AND is_active = true ORDER BY version_number DESC LIMIT 1
        `, [id]);
        if (schedRes.rows.length > 0) {
          const sRow = schedRes.rows[0];
          activeSchedule = {
            id: sRow.id,
            loanId: sRow.loan_id,
            versionNumber: sRow.version_number,
            isActive: sRow.is_active,
            reasonForVersion: sRow.reason_for_version,
            createdBy: sRow.created_by,
            createdAt: sRow.created_at,
            items: [],
          };
          const itemsRes = await queryPostgres(`
            SELECT * FROM loan_schedule_items WHERE schedule_id = $1 ORDER BY installment_number ASC
          `, [activeSchedule.id]);
          scheduleItems = itemsRes.rows.map((iRow: any) => ({
            id: iRow.id,
            scheduleId: iRow.schedule_id,
            installmentNumber: iRow.installment_number,
            dueDate: iRow.due_date ? new Date(iRow.due_date).toISOString().split('T')[0] : '',
            openingPrincipal: String(iRow.opening_principal),
            principalDue: String(iRow.principal_due),
            interestDue: String(iRow.interest_due),
            feesDue: String(iRow.fees_due || '0.00'),
            penaltyDue: String(iRow.penalty_due || '0.00'),
            totalEmiAmount: String(iRow.total_emi_amount),
            closingPrincipal: String(iRow.closing_principal),
            principalPaid: String(iRow.principal_paid || '0.00'),
            interestPaid: String(iRow.interest_paid || '0.00'),
            penaltyPaid: String(iRow.penalty_paid || '0.00'),
            feesPaid: String(iRow.fees_paid || '0.00'),
            totalPaid: String(iRow.total_paid || '0.00'),
            remainingBalance: String(iRow.remaining_balance),
            status: iRow.status,
            daysOverdue: iRow.days_overdue || 0,
            createdAt: iRow.created_at,
            updatedAt: iRow.updated_at,
          }));
        }

        const payRes = await queryPostgres(`
          SELECT * FROM payments WHERE loan_id = $1 ORDER BY payment_date DESC
        `, [id]);
        loanPayments = payRes.rows.map((pRow: any) => ({
          id: pRow.id,
          businessId: pRow.business_id,
          customerId: pRow.customer_id,
          loanId: pRow.loan_id,
          receiptNumber: pRow.receipt_number,
          paymentDate: pRow.payment_date ? new Date(pRow.payment_date).toISOString().split('T')[0] : '',
          paymentAmount: String(pRow.payment_amount),
          paymentMethod: pRow.payment_method,
          transactionReference: pRow.transaction_reference,
          principalComponent: String(pRow.principal_component),
          interestComponent: String(pRow.interest_component),
          penaltyComponent: String(pRow.penalty_component),
          feesComponent: String(pRow.fees_component || '0.00'),
          excessAmount: String(pRow.excess_amount || '0.00'),
          isReversal: Boolean(pRow.is_reversal),
          collectedBy: pRow.collected_by,
          notes: pRow.notes,
          createdAt: pRow.created_at,
        }));
      } catch (err) {
        console.warn('PostgreSQL schedule/payments getById error:', err);
      }
    }

    if (!activeSchedule) {
      activeSchedule = Array.from(db.loanSchedules.values()).find(
        s => s.loanId === id && s.isActive
      ) || null;
      if (activeSchedule) {
        scheduleItems = Array.from(db.loanScheduleItems.values())
          .filter(item => item.scheduleId === activeSchedule!.id)
          .sort((a, b) => a.installmentNumber - b.installmentNumber);
      }
      loanPayments = Array.from(db.payments.values()).filter(p => p.loanId === id);
    }

    res.json({
      success: true,
      data: {
        loan,
        schedule: activeSchedule ? { ...activeSchedule, items: scheduleItems } : null,
        payments: loanPayments,
      },
    });
  }

  public static async create(req: AuthenticatedRequest & { body: LoanCreationInput }, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const body = req.body;

    let customer: Customer | undefined = db.customers.get(body.customerId);
    if (pgPool && !customer) {
      try {
        const custRes = await queryPostgres('SELECT * FROM customers WHERE id = $1 AND business_id = $2', [body.customerId, businessId]);
        if (custRes.rows.length > 0) {
          const mapped = mapDbCustomer(custRes.rows[0]);
          customer = mapped;
          db.customers.set(mapped.id, mapped);
        }
      } catch (err) {
        console.warn('PostgreSQL customer lookup in create:', err);
      }
    }
    if (!customer) {
      customer = Array.from(db.customers.values())[0];
    }
    if (!customer) {
      res.status(400).json({ success: false, error: 'Invalid customer or no customers found' });
      return;
    }

    const count = db.loans.size + 1;
    const loanAccountNumber = `LN-${new Date().getFullYear()}-${String(count).padStart(5, '0')}`;

    // Generate schedule
    const scheduleResult = generateAmortizationSchedule({
      principalAmount: body.principalAmount,
      annualInterestRate: body.interestRate,
      calculationMethod: body.interestCalculationMethod,
      paymentFrequency: body.paymentFrequency,
      totalInstallments: body.tenureValue,
      firstPaymentDate: body.firstPaymentDate,
      disbursementDate: body.disbursementDate,
    });

    const newLoan: Loan = {
      id: `ln-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId,
      customerId: body.customerId,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      customerCode: customer.customerCode,
      loanAccountNumber,
      loanType: body.loanType,
      principalAmount: scheduleResult.principalAmount,
      interestRate: scheduleResult.interestRate,
      interestRatePeriod: body.interestRatePeriod,
      interestCalculationMethod: body.interestCalculationMethod,
      tenureValue: body.tenureValue,
      tenureUnit: body.tenureUnit,
      paymentFrequency: body.paymentFrequency,
      disbursementDate: body.disbursementDate,
      firstPaymentDate: body.firstPaymentDate,
      maturityDate: scheduleResult.maturityDate,
      processingFee: body.processingFee,
      insuranceFee: body.insuranceFee,
      otherCharges: body.otherCharges,
      gracePeriodDays: body.gracePeriodDays,
      latePenaltyType: body.latePenaltyType,
      latePenaltyValue: body.latePenaltyValue,
      prepaymentPenaltyRate: body.prepaymentPenaltyRate,
      totalPrincipalPaid: '0.00',
      totalInterestPaid: '0.00',
      totalPenaltyPaid: '0.00',
      totalFeesPaid: '0.00',
      outstandingPrincipal: scheduleResult.principalAmount,
      outstandingInterest: scheduleResult.totalInterestDue,
      outstandingPenalty: '0.00',
      outstandingFees: scheduleResult.totalFeesDue,
      status: 'ACTIVE',
      disbursedBy: req.user!.id,
      disbursedAt: new Date().toISOString(),
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.loans.set(newLoan.id, newLoan);

    if (pgPool) {
      try {
        await queryPostgres(`
          INSERT INTO loans (
            id, business_id, customer_id, loan_account_number, loan_type, principal_amount,
            interest_rate, interest_rate_period, interest_calculation_method, tenure_value,
            tenure_unit, payment_frequency, disbursement_date, first_payment_date, maturity_date,
            processing_fee, insurance_fee, other_charges, grace_period_days, late_penalty_type,
            late_penalty_value, prepayment_penalty_rate, outstanding_principal, outstanding_interest,
            status, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        `, [
          newLoan.id, businessId, newLoan.customerId, newLoan.loanAccountNumber, newLoan.loanType,
          newLoan.principalAmount, newLoan.interestRate, newLoan.interestRatePeriod, newLoan.interestCalculationMethod,
          newLoan.tenureValue, newLoan.tenureUnit, newLoan.paymentFrequency, newLoan.disbursementDate,
          newLoan.firstPaymentDate, newLoan.maturityDate, newLoan.processingFee, newLoan.insuranceFee,
          newLoan.otherCharges, newLoan.gracePeriodDays, newLoan.latePenaltyType, newLoan.latePenaltyValue,
          newLoan.prepaymentPenaltyRate, newLoan.outstandingPrincipal, newLoan.outstandingInterest,
          newLoan.status, newLoan.notes || null, newLoan.createdAt, newLoan.updatedAt
        ]);
      } catch (err: any) {
        console.warn('PostgreSQL loan insert fallback:', err.message);
      }
    }

    // Save Schedule Version 1
    const scheduleRecord: LoanSchedule = {
      id: `ls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      loanId: newLoan.id,
      versionNumber: 1,
      isActive: true,
      reasonForVersion: 'Original Loan Schedule',
      createdBy: req.user!.id,
      createdAt: new Date().toISOString(),
      items: [],
    };
    db.loanSchedules.set(scheduleRecord.id, scheduleRecord);

    // Save Schedule Items
    for (const item of scheduleResult.items) {
      const scheduleItem: LoanScheduleItem = {
        id: `lsi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        scheduleId: scheduleRecord.id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        openingPrincipal: item.openingPrincipal,
        principalDue: item.principalDue,
        interestDue: item.interestDue,
        feesDue: item.feesDue,
        penaltyDue: '0.00',
        totalEmiAmount: item.totalDue,
        closingPrincipal: item.closingPrincipal,
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        feesPaid: '0.00',
        totalPaid: '0.00',
        remainingBalance: item.totalDue,
        status: 'UPCOMING',
        daysOverdue: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.loanScheduleItems.set(scheduleItem.id, scheduleItem);
    }

    db.logAudit({
      businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'LOAN_CREATED',
      entity: 'LOAN',
      entityId: newLoan.id,
      newValue: {
        accountNo: loanAccountNumber,
        principal: newLoan.principalAmount,
        customer: newLoan.customerName,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      data: newLoan,
    });
  }

  public static async getPrepaymentQuote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    const quote = calculateForeclosureQuote({
      outstandingPrincipal: loan.outstandingPrincipal,
      outstandingInterest: loan.outstandingInterest,
      outstandingPenalty: loan.outstandingPenalty,
      outstandingFees: loan.outstandingFees,
      prepaymentPenaltyRate: loan.prepaymentPenaltyRate,
    });

    res.json({
      success: true,
      data: quote,
    });
  }

  public static async foreclose(req: AuthenticatedRequest & { body: LoanForeclosureInput }, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    if (loan.status === 'CLOSED') {
      res.status(400).json({ success: false, error: 'Loan is already closed' });
      return;
    }

    const quote = calculateForeclosureQuote({
      outstandingPrincipal: loan.outstandingPrincipal,
      outstandingInterest: loan.outstandingInterest,
      outstandingPenalty: loan.outstandingPenalty,
      outstandingFees: loan.outstandingFees,
      prepaymentPenaltyRate: loan.prepaymentPenaltyRate,
      waiverDiscount: body.waiverDiscount,
    });

    const paymentAmount = quote.finalSettlementAmount;
    const count = db.payments.size + 1;
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count).padStart(6, '0')}`;

    // Record foreclosure payment
    const paymentRecord: Payment = {
      id: `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: loan.businessId,
      customerId: loan.customerId,
      customerName: loan.customerName,
      loanId: loan.id,
      loanAccountNumber: loan.loanAccountNumber,
      receiptNumber,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentAmount,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference || 'FORECLOSURE-SETTLEMENT',
      principalComponent: quote.outstandingPrincipal,
      interestComponent: quote.outstandingInterest,
      penaltyComponent: quote.unpaidPenalties,
      feesComponent: new Decimal(quote.unpaidFees).plus(quote.prepaymentPenaltyCharge).toFixed(2),
      excessAmount: '0.00',
      isReversal: false,
      collectedBy: req.user!.id,
      collectedByName: `${req.user!.firstName} ${req.user!.lastName}`,
      notes: body.notes || 'Full loan foreclosure settlement',
      createdAt: new Date().toISOString(),
    };
    db.payments.set(paymentRecord.id, paymentRecord);

    // Close loan
    loan.status = 'CLOSED';
    loan.closedAt = new Date().toISOString();
    loan.closureReason = 'Early Foreclosure Settlement';
    loan.totalPrincipalPaid = new Decimal(loan.totalPrincipalPaid).plus(quote.outstandingPrincipal).toFixed(2);
    loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(quote.outstandingInterest).toFixed(2);
    loan.totalPenaltyPaid = new Decimal(loan.totalPenaltyPaid).plus(quote.unpaidPenalties).toFixed(2);
    loan.totalFeesPaid = new Decimal(loan.totalFeesPaid).plus(quote.unpaidFees).plus(quote.prepaymentPenaltyCharge).toFixed(2);
    loan.outstandingPrincipal = '0.00';
    loan.outstandingInterest = '0.00';
    loan.outstandingPenalty = '0.00';
    loan.outstandingFees = '0.00';
    loan.updatedAt = new Date().toISOString();

    // Mark all schedule items as PAID
    const activeSchedule = Array.from(db.loanSchedules.values()).find(s => s.loanId === loan.id && s.isActive);
    if (activeSchedule) {
      for (const item of db.loanScheduleItems.values()) {
        if (item.scheduleId === activeSchedule.id && item.status !== 'PAID') {
          item.status = 'PAID';
          item.remainingBalance = '0.00';
          item.paidDate = new Date().toISOString().split('T')[0];
        }
      }
    }

    db.logAudit({
      businessId: loan.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'LOAN_FORECLOSED',
      entity: 'LOAN',
      entityId: loan.id,
      newValue: { settlementAmount: paymentAmount, receipt: receiptNumber },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: {
        loan,
        payment: paymentRecord,
      },
    });
  }

  public static async restructure(req: AuthenticatedRequest & { body: LoanRestructureInput }, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    if (loan.status === 'CLOSED') {
      res.status(400).json({ success: false, error: 'Cannot restructure a closed loan' });
      return;
    }

    // Find current active schedule
    const currentSchedule = Array.from(db.loanSchedules.values()).find(s => s.loanId === loan.id && s.isActive);
    const prevVersion = currentSchedule ? currentSchedule.versionNumber : 1;

    // Deactivate prior schedule
    if (currentSchedule) {
      currentSchedule.isActive = false;
    }

    // Generate restructured schedule
    const restructureResult = restructureLoanSchedule({
      remainingPrincipal: loan.outstandingPrincipal,
      newAnnualInterestRate: body.newInterestRate,
      newCalculationMethod: body.newCalculationMethod,
      newPaymentFrequency: body.newPaymentFrequency,
      newRemainingInstallments: body.newRemainingInstallments,
      newFirstPaymentDate: body.newFirstPaymentDate,
      reasonForRestructure: body.reasonForRestructure,
      previousScheduleVersion: prevVersion,
    });

    // Save new schedule version
    const newScheduleRecord: LoanSchedule = {
      id: `ls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      loanId: loan.id,
      versionNumber: restructureResult.newVersionNumber,
      isActive: true,
      reasonForVersion: body.reasonForRestructure,
      createdBy: req.user!.id,
      createdAt: new Date().toISOString(),
      items: [],
    };
    db.loanSchedules.set(newScheduleRecord.id, newScheduleRecord);

    // Save new items
    for (const item of restructureResult.newSchedule.items) {
      const scheduleItem: LoanScheduleItem = {
        id: `lsi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        scheduleId: newScheduleRecord.id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        openingPrincipal: item.openingPrincipal,
        principalDue: item.principalDue,
        interestDue: item.interestDue,
        feesDue: item.feesDue,
        penaltyDue: '0.00',
        totalEmiAmount: item.totalDue,
        closingPrincipal: item.closingPrincipal,
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        feesPaid: '0.00',
        totalPaid: '0.00',
        remainingBalance: item.totalDue,
        status: 'UPCOMING',
        daysOverdue: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.loanScheduleItems.set(scheduleItem.id, scheduleItem);
    }

    // Update loan details
    loan.status = 'RESTRUCTURED';
    loan.interestRate = String(body.newInterestRate);
    loan.interestCalculationMethod = body.newCalculationMethod;
    loan.paymentFrequency = body.newPaymentFrequency;
    loan.tenureValue = body.newRemainingInstallments;
    loan.maturityDate = restructureResult.newSchedule.maturityDate;
    loan.outstandingInterest = restructureResult.newSchedule.totalInterestDue;
    loan.updatedAt = new Date().toISOString();

    db.logAudit({
      businessId: loan.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'LOAN_RESTRUCTURED',
      entity: 'LOAN',
      entityId: loan.id,
      newValue: {
        newVersion: restructureResult.newVersionNumber,
        reason: body.reasonForRestructure,
        newMaturity: loan.maturityDate,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: {
        loan,
        newSchedule: newScheduleRecord,
      },
    });
  }

  public static async updatePrincipal(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { newPrincipal, reason } = req.body;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    const previousPrincipal = loan.principalAmount;
    const previousOutstanding = loan.outstandingPrincipal;

    const remainingInstallments = Math.max(1, loan.tenureValue - (loan.paidInstallmentsCount || 0));
    const newScheduleGen = generateAmortizationSchedule({
      principalAmount: String(newPrincipal),
      annualInterestRate: loan.interestRate,
      calculationMethod: loan.interestCalculationMethod,
      paymentFrequency: loan.paymentFrequency,
      totalInstallments: remainingInstallments,
      firstPaymentDate: loan.firstPaymentDate,
      disbursementDate: loan.disbursementDate,
    });

    loan.principalAmount = String(newPrincipal);
    loan.outstandingPrincipal = new Decimal(newPrincipal).minus(loan.totalPrincipalPaid || 0).toFixed(2);
    loan.outstandingInterest = newScheduleGen.totalInterestDue;
    loan.maturityDate = newScheduleGen.maturityDate;
    loan.updatedAt = new Date().toISOString();

    const activeSchedule = Array.from(db.loanSchedules.values()).find(s => s.loanId === id && s.isActive);
    if (activeSchedule) activeSchedule.isActive = false;

    const newVersion = (activeSchedule?.versionNumber || 1) + 1;
    const newScheduleRecord: LoanSchedule = {
      id: `ls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      loanId: loan.id,
      versionNumber: newVersion,
      isActive: true,
      reasonForVersion: reason || `Admin adjusted principal from ₹${previousPrincipal} to ₹${newPrincipal}`,
      createdBy: req.user!.id,
      createdAt: new Date().toISOString(),
      items: [],
    };
    db.loanSchedules.set(newScheduleRecord.id, newScheduleRecord);

    for (const item of newScheduleGen.items) {
      const scheduleItem: LoanScheduleItem = {
        id: `lsi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        scheduleId: newScheduleRecord.id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        openingPrincipal: item.openingPrincipal,
        principalDue: item.principalDue,
        interestDue: item.interestDue,
        feesDue: item.feesDue,
        penaltyDue: '0.00',
        totalEmiAmount: item.totalDue,
        closingPrincipal: item.closingPrincipal,
        principalPaid: '0.00',
        interestPaid: '0.00',
        penaltyPaid: '0.00',
        feesPaid: '0.00',
        totalPaid: '0.00',
        remainingBalance: item.totalDue,
        status: 'UPCOMING',
        daysOverdue: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.loanScheduleItems.set(scheduleItem.id, scheduleItem);
    }

    db.logAudit({
      businessId: loan.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'LOAN_PRINCIPAL_ADJUSTED',
      entity: 'LOAN',
      entityId: loan.id,
      previousValue: { principalAmount: previousPrincipal, outstandingPrincipal: previousOutstanding },
      newValue: { principalAmount: loan.principalAmount, outstandingPrincipal: loan.outstandingPrincipal, reason },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: { loan, schedule: newScheduleRecord },
    });
  }

  public static async updateEmiStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { emiStatus, reason } = req.body;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    const prevStatus = (loan as any).emiCollectionStatus || 'OPEN';
    (loan as any).emiCollectionStatus = emiStatus;
    (loan as any).emiStatusReason = reason || '';
    loan.updatedAt = new Date().toISOString();

    if (emiStatus === 'CLOSED') {
      loan.status = 'CLOSED';
    } else if (emiStatus === 'OPEN' && loan.status === 'CLOSED') {
      loan.status = 'ACTIVE';
    }

    db.logAudit({
      businessId: loan.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'LOAN_EMI_STATUS_TOGGLED',
      entity: 'LOAN',
      entityId: loan.id,
      previousValue: { emiCollectionStatus: prevStatus },
      newValue: { emiCollectionStatus: emiStatus, reason },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: loan,
    });
  }

  public static async updateScheduleItemStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id, itemId } = req.params;
    const { status } = req.body;
    const item = db.loanScheduleItems.get(itemId);

    if (!item) {
      res.status(404).json({ success: false, error: 'Installment not found' });
      return;
    }

    const prevStatus = item.status;
    item.status = status as any;
    item.updatedAt = new Date().toISOString();

    db.logAudit({
      businessId: req.user!.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'INSTALLMENT_STATUS_UPDATED',
      entity: 'SCHEDULE_ITEM',
      entityId: itemId,
      previousValue: { status: prevStatus },
      newValue: { status },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: item,
    });
  }

  public static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    Object.assign(loan, req.body, { updatedAt: new Date().toISOString() });

    if (pgPool) {
      try {
        await queryPostgres(
          `UPDATE loans SET
            principal_amount = $1,
            interest_rate = $2,
            tenure_value = $3,
            payment_frequency = $4,
            status = $5,
            outstanding_principal = $6,
            outstanding_interest = $7,
            updated_at = $8
          WHERE id = $9 AND business_id = $10`,
          [
            loan.principalAmount,
            loan.interestRate,
            loan.tenureValue,
            loan.paymentFrequency,
            loan.status,
            loan.outstandingPrincipal,
            loan.outstandingInterest,
            loan.updatedAt,
            id,
            req.user!.businessId,
          ]
        );
      } catch (err: any) {
        console.warn('PostgreSQL loan update error:', err.message);
      }
    }

    res.json({
      success: true,
      data: loan,
    });
  }

  public static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    if (pgPool) {
      try {
        await queryPostgres('DELETE FROM loan_schedule_items WHERE loan_id = $1', [id]);
        await queryPostgres('DELETE FROM loan_schedules WHERE loan_id = $1', [id]);
        await queryPostgres('DELETE FROM loans WHERE id = $1 AND business_id = $2', [id, req.user!.businessId]);
      } catch (err: any) {
        console.warn('PostgreSQL loan delete error:', err.message);
      }
    }

    db.loans.delete(id);
    res.json({
      success: true,
      message: 'Loan deleted successfully',
    });
  }
}
