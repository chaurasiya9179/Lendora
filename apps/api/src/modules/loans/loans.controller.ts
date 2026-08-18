import { Response } from 'express';
import { db } from '../../database/db.js';
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
import { Loan, LoanSchedule, LoanScheduleItem, Payment } from '@lendora/shared-types';
import Decimal from 'decimal.js';

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

    let items = Array.from(db.loans.values()).filter(l => l.businessId === businessId);

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
    const loan = db.loans.get(id);

    if (!loan || loan.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Loan not found' });
      return;
    }

    // Get active schedule
    const activeSchedule = Array.from(db.loanSchedules.values()).find(
      s => s.loanId === id && s.isActive
    );

    let scheduleItems: LoanScheduleItem[] = [];
    if (activeSchedule) {
      scheduleItems = Array.from(db.loanScheduleItems.values())
        .filter(item => item.scheduleId === activeSchedule.id)
        .sort((a, b) => a.installmentNumber - b.installmentNumber);
    }

    const loanPayments = Array.from(db.payments.values()).filter(p => p.loanId === id);

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

    const customer = db.customers.get(body.customerId);
    if (!customer || customer.businessId !== businessId) {
      res.status(400).json({ success: false, error: 'Invalid customer' });
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
}
