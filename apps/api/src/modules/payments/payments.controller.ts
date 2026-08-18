import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { RecordPaymentInput, ReversePaymentInput } from '@lendora/validation';
import { allocatePaymentWaterfall, PendingInstallmentDue } from '@lendora/financial-engine';
import { Payment, PaymentAllocation, PaymentReceiptData } from '@lendora/shared-types';
import Decimal from 'decimal.js';

export class PaymentsController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { loanId, customerId, search, page = '1', limit = '20' } = req.query;

    let items = Array.from(db.payments.values())
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
        totalPages: Math.ceil(total / limitNum),
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

    const loan = db.loans.get(body.loanId);
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
      s => s.loanId === loan.id && s.isActive
    );

    if (!activeSchedule) {
      res.status(400).json({ success: false, error: 'No active schedule found for this loan' });
      return;
    }

    const scheduleItems = Array.from(db.loanScheduleItems.values())
      .filter(item => item.scheduleId === activeSchedule.id)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const pendingItems: PendingInstallmentDue[] = scheduleItems
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

    // Get business settings for allocation order
    const business = db.businessProfiles.get(businessId);
    const allocationOrder = business?.allocationOrder || 'PENALTY_FEES_INTEREST_PRINCIPAL';

    // Execute precision waterfall
    const waterfallResult = allocatePaymentWaterfall(
      body.paymentAmount,
      pendingItems,
      allocationOrder
    );

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
      principalComponent: waterfallResult.principalComponent,
      interestComponent: waterfallResult.interestComponent,
      penaltyComponent: waterfallResult.penaltyComponent,
      feesComponent: waterfallResult.feesComponent,
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

    // Update Loan Balances
    loan.totalPrincipalPaid = new Decimal(loan.totalPrincipalPaid).plus(waterfallResult.principalComponent).toFixed(2);
    loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(waterfallResult.interestComponent).toFixed(2);
    loan.totalPenaltyPaid = new Decimal(loan.totalPenaltyPaid).plus(waterfallResult.penaltyComponent).toFixed(2);
    loan.totalFeesPaid = new Decimal(loan.totalFeesPaid).plus(waterfallResult.feesComponent).toFixed(2);

    loan.outstandingPrincipal = Decimal.max(0, new Decimal(loan.outstandingPrincipal).minus(waterfallResult.principalComponent)).toFixed(2);
    loan.outstandingInterest = Decimal.max(0, new Decimal(loan.outstandingInterest).minus(waterfallResult.interestComponent)).toFixed(2);
    loan.outstandingPenalty = Decimal.max(0, new Decimal(loan.outstandingPenalty).minus(waterfallResult.penaltyComponent)).toFixed(2);
    loan.outstandingFees = Decimal.max(0, new Decimal(loan.outstandingFees).minus(waterfallResult.feesComponent)).toFixed(2);

    // If remaining total balance is 0, auto-close loan
    if (new Decimal(loan.outstandingPrincipal).isZero() && new Decimal(loan.outstandingInterest).isZero()) {
      loan.status = 'CLOSED';
      loan.closedAt = new Date().toISOString();
      loan.closureReason = 'Maturity Repayment Completed';
    }

    loan.updatedAt = new Date().toISOString();

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
