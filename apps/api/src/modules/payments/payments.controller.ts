import { Response } from 'express';
import { db } from '../../database/db.js';
import { pgPool, queryPostgres } from '../../database/postgres.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { RecordPaymentInput, ReversePaymentInput } from '@lendora/validation';
import { allocatePaymentWaterfall, PendingInstallmentDue } from '@lendora/financial-engine';
import { Payment, PaymentAllocation, PaymentReceiptData } from '@lendora/shared-types';
import Decimal from 'decimal.js';

export class PaymentsController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { loanId, customerId, search, page = '1', limit = '20' } = req.query;

    let items: Payment[] = [];

    if (pgPool) {
      try {
        let query = `
          SELECT p.*, l.loan_account_number, c.first_name, c.last_name
          FROM payments p
          LEFT JOIN loans l ON p.loan_id = l.id
          LEFT JOIN customers c ON p.customer_id = c.id
          WHERE p.business_id = $1
        `;
        const params: any[] = [businessId];

        if (loanId && typeof loanId === 'string') {
          params.push(loanId);
          query += ` AND p.loan_id = $${params.length}`;
        }

        if (customerId && typeof customerId === 'string') {
          params.push(customerId);
          query += ` AND p.customer_id = $${params.length}`;
        }

        if (search && typeof search === 'string') {
          params.push(`%${search.toLowerCase()}%`);
          query += ` AND (LOWER(p.receipt_number) LIKE $${params.length} OR LOWER(p.transaction_reference) LIKE $${params.length} OR LOWER(l.loan_account_number) LIKE $${params.length} OR LOWER(c.first_name) LIKE $${params.length} OR LOWER(c.last_name) LIKE $${params.length})`;
        }

        query += ' ORDER BY p.payment_date DESC, p.created_at DESC';

        const result = await queryPostgres(query, params);
        items = result.rows.map((row: any) => ({
          id: row.id,
          businessId: row.business_id,
          customerId: row.customer_id,
          customerName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.customer_name || 'Borrower',
          loanId: row.loan_id,
          loanAccountNumber: row.loan_account_number || undefined,
          receiptNumber: row.receipt_number,
          paymentDate: row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : '',
          paymentAmount: String(row.payment_amount),
          paymentMethod: row.payment_method,
          transactionReference: row.transaction_reference || undefined,
          principalComponent: String(row.principal_component),
          interestComponent: String(row.interest_component),
          penaltyComponent: String(row.penalty_component),
          feesComponent: String(row.fees_component || '0.00'),
          excessAmount: row.excess_amount ? String(row.excess_amount) : '0.00',
          isReversal: Boolean(row.is_reversal),
          reversedPaymentId: row.reversed_payment_id || undefined,
          collectedBy: row.collected_by || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        }));
        for (const p of items) {
          db.payments.set(p.id, p);
        }
      } catch (err) {
        console.warn('PostgreSQL payments list fallback to in-memory:', err);
        items = Array.from(db.payments.values())
          .filter(p => p.businessId === businessId)
          .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      }
    } else {
      items = Array.from(db.payments.values())
        .filter(p => p.businessId === businessId)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      if (loanId && typeof loanId === 'string') {
        items = items.filter(p => p.loanId === loanId);
      }

      if (customerId && typeof customerId === 'string') {
        items = items.filter(p => p.customerId === customerId);
      }

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        items = items.filter(
          p =>
            p.receiptNumber.toLowerCase().includes(q) ||
            (p.transactionReference && p.transactionReference.toLowerCase().includes(q)) ||
            (p.customerName && p.customerName.toLowerCase().includes(q)) ||
            (p.loanAccountNumber && p.loanAccountNumber.toLowerCase().includes(q))
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
    const payment = db.payments.get(id);

    if (!payment || payment.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    const allocations = Array.from(db.paymentAllocations.values()).filter(a => a.paymentId === id);

    res.json({
      success: true,
      data: {
        ...payment,
        allocations,
      },
    });
  }

  public static async record(req: AuthenticatedRequest & { body: RecordPaymentInput }, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const body = req.body;

    let loan = db.loans.get(body.loanId);
    if (!loan && pgPool) {
      try {
        const loanRes = await queryPostgres(`
          SELECT l.*, c.first_name, c.last_name, c.phone as customer_phone, c.customer_code
          FROM loans l
          LEFT JOIN customers c ON l.customer_id = c.id
          WHERE l.id = $1 AND l.business_id = $2
        `, [body.loanId, businessId]);
        if (loanRes.rows.length > 0) {
          const row = loanRes.rows[0];
          loan = {
            id: row.id,
            businessId: row.business_id,
            customerId: row.customer_id,
            customerName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.customer_name || 'Borrower',
            customerPhone: row.customer_phone || row.phone,
            customerCode: row.customer_code,
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
            processingFee: String(row.processing_fee || '0.00'),
            insuranceFee: String(row.insurance_fee || '0.00'),
            otherCharges: String(row.other_charges || '0.00'),
            gracePeriodDays: row.grace_period_days || 0,
            latePenaltyType: row.late_penalty_type || 'PERCENTAGE',
            latePenaltyValue: String(row.late_penalty_value || '0.00'),
            prepaymentPenaltyRate: String(row.prepayment_penalty_rate || '0.00'),
            totalPrincipalPaid: String(row.total_principal_paid || '0.00'),
            totalInterestPaid: String(row.total_interest_paid || '0.00'),
            totalPenaltyPaid: String(row.total_penalty_paid || '0.00'),
            totalFeesPaid: String(row.total_fees_paid || '0.00'),
            outstandingPrincipal: String(row.outstanding_principal),
            outstandingInterest: String(row.outstanding_interest),
            outstandingPenalty: String(row.outstanding_penalty || '0.00'),
            outstandingFees: String(row.outstanding_fees || '0.00'),
            status: row.status,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          } as any;
          db.loans.set(loan!.id, loan!);
        }
      } catch (err) {
        console.warn('PostgreSQL loan lookup in record payment:', err);
      }
    }

    if (!loan || loan.businessId !== businessId) {
      res.status(400).json({ success: false, error: 'Invalid loan' });
      return;
    }

    if (loan.status === 'CLOSED') {
      res.status(400).json({ success: false, error: 'Cannot record payment for a closed loan' });
      return;
    }

    // Get active schedule & pending items
    const activeSchedule = Array.from(db.loanSchedules.values()).find(
      s => s.loanId === loan!.id && s.isActive
    );

    const scheduleItems = activeSchedule 
      ? Array.from(db.loanScheduleItems.values())
          .filter(item => item.scheduleId === activeSchedule.id)
          .sort((a, b) => a.installmentNumber - b.installmentNumber)
      : [];

    let pendingItems: PendingInstallmentDue[] = [];
    if (scheduleItems.length > 0) {
      pendingItems = scheduleItems
        .filter(item => item.status !== 'PAID')
        .map(item => ({
          id: item.id,
          installmentNumber: item.installmentNumber,
          dueDate: item.dueDate,
          principalDue: item.principalDue,
          principalPaid: item.principalPaid || '0.00',
          interestDue: item.interestDue,
          interestPaid: item.interestPaid || '0.00',
          penaltyDue: item.penaltyDue || '0.00',
          penaltyPaid: item.penaltyPaid || '0.00',
          feesDue: item.feesDue || '0.00',
          feesPaid: item.feesPaid || '0.00',
        }));
    } else {
      pendingItems = [{
        id: `inst-${loan.id}-1`,
        installmentNumber: 1,
        dueDate: loan.firstPaymentDate || loan.disbursementDate || new Date().toISOString().split('T')[0],
        principalDue: loan.outstandingPrincipal,
        principalPaid: '0.00',
        interestDue: loan.outstandingInterest || '0.00',
        interestPaid: '0.00',
        penaltyDue: loan.outstandingPenalty || '0.00',
        penaltyPaid: '0.00',
        feesDue: '0.00',
        feesPaid: '0.00',
      }];
    }

    // Get business settings for allocation order
    const business = db.businessProfiles.get(businessId);
    const allocationOrder = business?.allocationOrder || 'PENALTY_FEES_INTEREST_PRINCIPAL';

    // Execute precision waterfall
    const waterfallResult = allocatePaymentWaterfall(
      body.paymentAmount,
      pendingItems,
      allocationOrder
    );

    let principalAllocated = new Decimal(waterfallResult.principalComponent);
    const interestAllocated = new Decimal(waterfallResult.interestComponent);
    const penaltyAllocated = new Decimal(waterfallResult.penaltyComponent);
    const feesAllocated = new Decimal(waterfallResult.feesComponent);

    // If principalDue was 0 (like in INTEREST_ONLY installment) but amount paid is greater than interest, credit remainder to principal!
    const remainder = new Decimal(body.paymentAmount).minus(interestAllocated).minus(penaltyAllocated).minus(feesAllocated);
    if (remainder.greaterThan(0)) {
      principalAllocated = remainder;
    }

    const count = db.payments.size + 1;
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count).padStart(6, '0')}`;

    // Create payment transaction
    const newPayment: Payment = {
      id: `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId,
      customerId: loan.customerId,
      customerName: loan.customerName,
      loanId: loan.id,
      loanAccountNumber: loan.loanAccountNumber,
      receiptNumber,
      paymentDate: body.paymentDate,
      paymentAmount: waterfallResult.paymentAmount,
      paymentMethod: body.paymentMethod,
      transactionReference: body.transactionReference,
      principalComponent: principalAllocated.toFixed(2),
      interestComponent: interestAllocated.toFixed(2),
      penaltyComponent: penaltyAllocated.toFixed(2),
      feesComponent: feesAllocated.toFixed(2),
      excessAmount: waterfallResult.excessAmount,
      isReversal: false,
      collectedBy: req.user!.id,
      collectedByName: `${req.user!.firstName} ${req.user!.lastName}`,
      notes: body.notes,
      createdAt: new Date().toISOString(),
    };
    db.payments.set(newPayment.id, newPayment);

    // Apply allocations to schedule items
    const savedAllocations: PaymentAllocation[] = [];
    for (const alloc of waterfallResult.allocations) {
      const scheduleItem = db.loanScheduleItems.get(alloc.scheduleItemId);
      if (scheduleItem) {
        scheduleItem.principalPaid = alloc.newPrincipalPaid;
        scheduleItem.interestPaid = alloc.newInterestPaid;
        scheduleItem.penaltyPaid = alloc.newPenaltyPaid;
        scheduleItem.feesPaid = alloc.newFeesPaid;
        scheduleItem.remainingBalance = alloc.remainingTotalDue;
        scheduleItem.status = alloc.status;
        if (alloc.status === 'PAID') {
          scheduleItem.paidDate = body.paymentDate;
        }
        scheduleItem.updatedAt = new Date().toISOString();
      }

      const allocationRecord: PaymentAllocation = {
        id: `pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        paymentId: newPayment.id,
        scheduleItemId: alloc.scheduleItemId,
        installmentNumber: alloc.installmentNumber,
        principalAllocated: alloc.principalAllocated,
        interestAllocated: alloc.interestAllocated,
        penaltyAllocated: alloc.penaltyAllocated,
        feesAllocated: alloc.feesAllocated,
        totalAllocated: alloc.totalAllocated,
        createdAt: new Date().toISOString(),
      };
      db.paymentAllocations.set(allocationRecord.id, allocationRecord);
      savedAllocations.push(allocationRecord);
    }

    // Update Loan Balances in memory
    loan.totalPrincipalPaid = new Decimal(loan.totalPrincipalPaid).plus(principalAllocated).toFixed(2);
    loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(interestAllocated).toFixed(2);
    loan.totalPenaltyPaid = new Decimal(loan.totalPenaltyPaid).plus(penaltyAllocated).toFixed(2);
    loan.totalFeesPaid = new Decimal(loan.totalFeesPaid).plus(feesAllocated).toFixed(2);

    loan.outstandingPrincipal = Decimal.max(0, new Decimal(loan.outstandingPrincipal).minus(principalAllocated)).toFixed(2);
    loan.outstandingInterest = Decimal.max(0, new Decimal(loan.outstandingInterest).minus(interestAllocated)).toFixed(2);
    loan.outstandingPenalty = Decimal.max(0, new Decimal(loan.outstandingPenalty).minus(penaltyAllocated)).toFixed(2);
    loan.outstandingFees = Decimal.max(0, new Decimal(loan.outstandingFees).minus(feesAllocated)).toFixed(2);

    // If remaining total balance is 0, auto-close loan
    if (new Decimal(loan.outstandingPrincipal).isZero() && new Decimal(loan.outstandingInterest).isZero()) {
      loan.status = 'CLOSED';
      loan.closedAt = new Date().toISOString();
      loan.closureReason = 'Maturity Repayment Completed';
    }

    loan.updatedAt = new Date().toISOString();

    if (pgPool) {
      try {
        await queryPostgres(`
          INSERT INTO payments (
            id, business_id, customer_id, loan_id, receipt_number, payment_date,
            payment_amount, payment_method, transaction_reference, principal_component,
            interest_component, penalty_component, fees_component, excess_amount,
            is_reversal, collected_by, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          newPayment.id, businessId, newPayment.customerId, newPayment.loanId,
          newPayment.receiptNumber, newPayment.paymentDate, newPayment.paymentAmount,
          newPayment.paymentMethod, newPayment.transactionReference || null,
          newPayment.principalComponent, newPayment.interestComponent,
          newPayment.penaltyComponent, newPayment.feesComponent, newPayment.excessAmount || '0.00',
          newPayment.isReversal, newPayment.collectedBy || null, newPayment.notes || null,
          newPayment.createdAt
        ]);

        await queryPostgres(`
          UPDATE loans
          SET total_principal_paid = $1,
              total_interest_paid = $2,
              total_penalty_paid = $3,
              total_fees_paid = $4,
              outstanding_principal = $5,
              outstanding_interest = $6,
              outstanding_penalty = $7,
              outstanding_fees = $8,
              status = $9,
              closed_at = $10,
              closure_reason = $11,
              updated_at = NOW()
          WHERE id = $12 AND business_id = $13
        `, [
          loan.totalPrincipalPaid, loan.totalInterestPaid, loan.totalPenaltyPaid,
          loan.totalFeesPaid, loan.outstandingPrincipal, loan.outstandingInterest,
          loan.outstandingPenalty, loan.outstandingFees, loan.status,
          loan.closedAt || null, loan.closureReason || null, loan.id, businessId
        ]);
      } catch (pgErr) {
        console.warn('PostgreSQL payment insert / loan update error:', pgErr);
      }
    }

    db.logAudit({
      businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: newPayment.id,
      newValue: {
        receiptNumber,
        amount: newPayment.paymentAmount,
        loan: loan.loanAccountNumber,
        customer: loan.customerName,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      data: {
        payment: newPayment,
        allocations: savedAllocations,
        loan,
      },
    });
  }

  public static async getReceipt(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const payment = db.payments.get(id);

    if (!payment || payment.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    const business = db.businessProfiles.get(payment.businessId);
    const customer = db.customers.get(payment.customerId);
    const loan = db.loans.get(payment.loanId);

    const receipt: PaymentReceiptData = {
      businessName: business?.businessName || 'Lendora Lending Services',
      businessAddress: `${business?.addressLine1 || ''}, ${business?.city || ''}, ${business?.state || ''} ${business?.postalCode || ''}`,
      businessPhone: business?.contactPhone || '',
      businessEmail: business?.contactEmail || '',
      currency: business?.currency || 'USD',
      currencySymbol: business?.currencySymbol || '$',
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      customerName: payment.customerName || (customer ? `${customer.firstName} ${customer.lastName}` : 'Valued Customer'),
      customerCode: customer?.customerCode || 'N/A',
      customerPhone: customer?.phone || 'N/A',
      loanAccountNumber: payment.loanAccountNumber || (loan?.loanAccountNumber || 'N/A'),
      paymentAmount: payment.paymentAmount,
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.transactionReference,
      principalPaid: payment.principalComponent,
      interestPaid: payment.interestComponent,
      penaltyPaid: payment.penaltyComponent,
      feesPaid: payment.feesComponent || payment.feeComponent || '0.00',
      remainingPrincipalBalance: loan?.outstandingPrincipal || '0.00',
      collectedByName: payment.collectedByName,
      footerNote: business?.receiptFooterNote,
    };

    res.json({
      success: true,
      data: receipt,
    });
  }

  public static async reverse(req: AuthenticatedRequest & { body: ReversePaymentInput }, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = req.body;
    const originalPayment = db.payments.get(id);

    if (!originalPayment || originalPayment.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    if (originalPayment.isReversal) {
      res.status(400).json({ success: false, error: 'Cannot reverse a reversal transaction' });
      return;
    }

    const count = db.payments.size + 1;
    const receiptNumber = `REV-${new Date().getFullYear()}-${String(count).padStart(6, '0')}`;

    // Create offsetting reversal transaction (immutable audit ledger standard)
    const reversalPayment: Payment = {
      id: `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: originalPayment.businessId,
      customerId: originalPayment.customerId,
      customerName: originalPayment.customerName,
      loanId: originalPayment.loanId,
      loanAccountNumber: originalPayment.loanAccountNumber,
      receiptNumber,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentAmount: `-${originalPayment.paymentAmount}`,
      paymentMethod: 'ADJUSTMENT',
      transactionReference: `REVERSAL-OF-${originalPayment.receiptNumber}`,
      principalComponent: `-${originalPayment.principalComponent}`,
      interestComponent: `-${originalPayment.interestComponent}`,
      penaltyComponent: `-${originalPayment.penaltyComponent}`,
      feesComponent: `-${originalPayment.feesComponent || originalPayment.feeComponent || '0.00'}`,
      excessAmount: '0.00',
      isReversal: true,
      reversedPaymentId: originalPayment.id,
      collectedBy: req.user!.id,
      collectedByName: `${req.user!.firstName} ${req.user!.lastName}`,
      notes: `Reversal Reason: ${reason}`,
      createdAt: new Date().toISOString(),
    };
    db.payments.set(reversalPayment.id, reversalPayment);

    // Revert Loan Balances
    const loan = db.loans.get(originalPayment.loanId);
    if (loan) {
      loan.totalPrincipalPaid = Decimal.max(0, new Decimal(loan.totalPrincipalPaid).minus(originalPayment.principalComponent)).toFixed(2);
      loan.totalInterestPaid = Decimal.max(0, new Decimal(loan.totalInterestPaid).minus(originalPayment.interestComponent)).toFixed(2);
      loan.totalPenaltyPaid = Decimal.max(0, new Decimal(loan.totalPenaltyPaid).minus(originalPayment.penaltyComponent)).toFixed(2);
      loan.totalFeesPaid = Decimal.max(0, new Decimal(loan.totalFeesPaid).minus(originalPayment.feesComponent || originalPayment.feeComponent || '0.00')).toFixed(2);

      loan.outstandingPrincipal = new Decimal(loan.outstandingPrincipal).plus(originalPayment.principalComponent).toFixed(2);
      loan.outstandingInterest = new Decimal(loan.outstandingInterest).plus(originalPayment.interestComponent).toFixed(2);
      loan.outstandingPenalty = new Decimal(loan.outstandingPenalty).plus(originalPayment.penaltyComponent).toFixed(2);
      loan.outstandingFees = new Decimal(loan.outstandingFees).plus(originalPayment.feesComponent || originalPayment.feeComponent || '0.00').toFixed(2);

      if (loan.status === 'CLOSED') {
        loan.status = 'ACTIVE';
        loan.closedAt = undefined;
        loan.closureReason = undefined;
      }
      loan.updatedAt = new Date().toISOString();
    }

    db.logAudit({
      businessId: originalPayment.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'PAYMENT_REVERSED',
      entity: 'PAYMENT',
      entityId: originalPayment.id,
      newValue: {
        reversalReceipt: receiptNumber,
        originalReceipt: originalPayment.receiptNumber,
        reason,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: reversalPayment,
    });
  }
}
