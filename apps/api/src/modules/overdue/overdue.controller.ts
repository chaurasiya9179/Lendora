import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { calculateLatePenalty } from '@lendora/financial-engine';
import {
  AgingBucket,
  AgingBucketSummary,
  OverdueLoanItem,
  PenaltyRecord,
} from '@lendora/shared-types';
import Decimal from 'decimal.js';

export class OverdueController {
  public static async getAgingSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const today = new Date();

    const bucketConfig: { bucket: AgingBucket; label: string; min: number; max: number }[] = [
      { bucket: '1_TO_7_DAYS', label: '1 - 7 Days', min: 1, max: 7 },
      { bucket: '8_TO_30_DAYS', label: '8 - 30 Days', min: 8, max: 30 },
      { bucket: '31_TO_60_DAYS', label: '31 - 60 Days', min: 31, max: 60 },
      { bucket: '61_TO_90_DAYS', label: '61 - 90 Days', min: 61, max: 90 },
      { bucket: '90_PLUS_DAYS', label: '90+ Days', min: 91, max: Infinity },
    ];

    const bucketsMap = new Map<AgingBucket, {
      count: number;
      principal: Decimal;
      interest: Decimal;
      penalty: Decimal;
      total: Decimal;
    }>();

    for (const b of bucketConfig) {
      bucketsMap.set(b.bucket, {
        count: 0,
        principal: new Decimal(0),
        interest: new Decimal(0),
        penalty: new Decimal(0),
        total: new Decimal(0),
      });
    }

    const overdueLoansList: OverdueLoanItem[] = [];
    const activeLoans = Array.from(db.loans.values()).filter(
      l => l.businessId === businessId && l.status !== 'CLOSED' && l.status !== 'REJECTED'
    );

    for (const loan of activeLoans) {
      const activeSchedule = Array.from(db.loanSchedules.values()).find(
        s => s.loanId === loan.id && s.isActive
      );

      if (!activeSchedule) continue;

      const scheduleItems = Array.from(db.loanScheduleItems.values()).filter(
        i => i.scheduleId === activeSchedule.id && i.status !== 'PAID'
      );

      let maxDaysOverdue = 0;
      let missedCount = 0;
      let loanPrincipalOverdue = new Decimal(0);
      let loanInterestOverdue = new Decimal(0);
      let loanPenaltyAccrued = new Decimal(0);

      for (const item of scheduleItems) {
        const dueDate = new Date(item.dueDate);
        if (dueDate < today) {
          const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            missedCount++;
            if (diffDays > maxDaysOverdue) maxDaysOverdue = diffDays;

            const pDue = new Decimal(item.principalDue).minus(item.principalPaid || '0');
            const iDue = new Decimal(item.interestDue).minus(item.interestPaid || '0');
            const penDue = new Decimal(item.penaltyDue || '0').minus(item.penaltyPaid || '0');

            loanPrincipalOverdue = loanPrincipalOverdue.plus(Decimal.max(0, pDue));
            loanInterestOverdue = loanInterestOverdue.plus(Decimal.max(0, iDue));
            loanPenaltyAccrued = loanPenaltyAccrued.plus(Decimal.max(0, penDue));

            item.daysOverdue = diffDays;
            item.status = 'OVERDUE';
          }
        }
      }

      if (maxDaysOverdue > 0) {
        loan.status = 'OVERDUE';

        let targetBucket: AgingBucket = '1_TO_7_DAYS';
        if (maxDaysOverdue >= 1 && maxDaysOverdue <= 7) targetBucket = '1_TO_7_DAYS';
        else if (maxDaysOverdue >= 8 && maxDaysOverdue <= 30) targetBucket = '8_TO_30_DAYS';
        else if (maxDaysOverdue >= 31 && maxDaysOverdue <= 60) targetBucket = '31_TO_60_DAYS';
        else if (maxDaysOverdue >= 61 && maxDaysOverdue <= 90) targetBucket = '61_TO_90_DAYS';
        else targetBucket = '90_PLUS_DAYS';

        const totalOverdue = loanPrincipalOverdue.plus(loanInterestOverdue).plus(loanPenaltyAccrued);

        const bData = bucketsMap.get(targetBucket)!;
        bData.count++;
        bData.principal = bData.principal.plus(loanPrincipalOverdue);
        bData.interest = bData.interest.plus(loanInterestOverdue);
        bData.penalty = bData.penalty.plus(loanPenaltyAccrued);
        bData.total = bData.total.plus(totalOverdue);

        const customer = db.customers.get(loan.customerId);

        overdueLoansList.push({
          loanId: loan.id,
          loanAccountNumber: loan.loanAccountNumber,
          customerName: loan.customerName || '',
          customerPhone: loan.customerPhone || '',
          customerId: loan.customerId,
          daysOverdue: maxDaysOverdue,
          bucket: targetBucket,
          missedInstallmentsCount: missedCount,
          principalOverdue: loanPrincipalOverdue.toFixed(2),
          interestOverdue: loanInterestOverdue.toFixed(2),
          penaltiesAccrued: loanPenaltyAccrued.toFixed(2),
          totalOverdueAmount: totalOverdue.toFixed(2),
          assignedAgentName: customer?.assignedStaffName,
        });
      }
    }

    const summaries: AgingBucketSummary[] = bucketConfig.map(cfg => {
      const data = bucketsMap.get(cfg.bucket)!;
      return {
        bucket: cfg.bucket,
        bucketLabel: cfg.label,
        count: data.count,
        totalPrincipalOverdue: data.principal.toFixed(2),
        totalInterestOverdue: data.interest.toFixed(2),
        totalPenaltyAccrued: data.penalty.toFixed(2),
        totalAmountOverdue: data.total.toFixed(2),
      };
    });

    res.json({
      success: true,
      data: {
        summary: summaries,
        overdueLoans: overdueLoansList.sort((a, b) => b.daysOverdue - a.daysOverdue),
      },
    });
  }

  public static async calculateAndApplyPenalties(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const business = db.businessProfiles.get(businessId);
    const today = new Date();

    const activeLoans = Array.from(db.loans.values()).filter(
      l => l.businessId === businessId && l.status !== 'CLOSED' && l.status !== 'REJECTED'
    );

    let penaltiesAppliedCount = 0;
    let totalPenaltyAmountApplied = new Decimal(0);

    for (const loan of activeLoans) {
      const activeSchedule = Array.from(db.loanSchedules.values()).find(
        s => s.loanId === loan.id && s.isActive
      );

      if (!activeSchedule) continue;

      const scheduleItems = Array.from(db.loanScheduleItems.values()).filter(
        i => i.scheduleId === activeSchedule.id && i.status !== 'PAID'
      );

      for (const item of scheduleItems) {
        const dueDate = new Date(item.dueDate);
        if (dueDate < today) {
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const unpaidEMI = new Decimal(item.totalEmiAmount || item.totalDue || '0').minus(item.totalPaid || '0');

          if (daysOverdue > 0 && unpaidEMI.greaterThan(0)) {
            const penaltyResult = calculateLatePenalty({
              overdueAmount: unpaidEMI,
              daysOverdue,
              gracePeriodDays: loan.gracePeriodDays || business?.defaultGracePeriodDays || 0,
              penaltyType: loan.latePenaltyType || 'PERCENTAGE',
              penaltyValue: loan.latePenaltyValue || '5.0',
            });

            const penaltyAmount = new Decimal(penaltyResult.calculatedPenalty);

            if (penaltyAmount.greaterThan(0)) {
              // Check if penalty already logged for this schedule item today
              const existing = Array.from(db.penalties.values()).find(
                p => p.scheduleItemId === item.id && !p.isWaived
              );

              if (!existing) {
                const newPenalty: PenaltyRecord = {
                  id: `pen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  loanId: loan.id,
                  scheduleItemId: item.id,
                  penaltyAmount: penaltyResult.calculatedPenalty,
                  penaltyReason: `Late penalty accrued (${daysOverdue} days overdue)`,
                  calculationDetails: { ...penaltyResult },
                  isWaived: false,
                  createdAt: new Date().toISOString(),
                };
                db.penalties.set(newPenalty.id, newPenalty);

                item.penaltyDue = new Decimal(item.penaltyDue || '0').plus(penaltyAmount).toFixed(2);
                item.remainingBalance = new Decimal(item.remainingBalance || item.totalEmiAmount || '0').plus(penaltyAmount).toFixed(2);
                loan.outstandingPenalty = new Decimal(loan.outstandingPenalty || '0').plus(penaltyAmount).toFixed(2);

                penaltiesAppliedCount++;
                totalPenaltyAmountApplied = totalPenaltyAmountApplied.plus(penaltyAmount);
              }
            }
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        penaltiesAppliedCount,
        totalPenaltyAmountApplied: totalPenaltyAmountApplied.toFixed(2),
      },
    });
  }

  public static async waivePenalty(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = req.body;
    const penalty = db.penalties.get(id);

    if (!penalty) {
      res.status(404).json({ success: false, error: 'Penalty record not found' });
      return;
    }

    if (penalty.isWaived) {
      res.status(400).json({ success: false, error: 'Penalty has already been waived' });
      return;
    }

    penalty.isWaived = true;
    penalty.waivedBy = req.user!.id;
    penalty.waivedByName = `${req.user!.firstName} ${req.user!.lastName}`;
    penalty.waivedReason = reason || 'Administrative fee waiver';
    penalty.waivedAt = new Date().toISOString();

    const scheduleItem = db.loanScheduleItems.get(penalty.scheduleItemId);
    if (scheduleItem) {
      scheduleItem.penaltyDue = Decimal.max(0, new Decimal(scheduleItem.penaltyDue || '0').minus(penalty.penaltyAmount)).toFixed(2);
      scheduleItem.remainingBalance = Decimal.max(0, new Decimal(scheduleItem.remainingBalance || scheduleItem.totalEmiAmount || '0').minus(penalty.penaltyAmount)).toFixed(2);
    }

    const loan = db.loans.get(penalty.loanId);
    if (loan) {
      loan.outstandingPenalty = Decimal.max(0, new Decimal(loan.outstandingPenalty).minus(penalty.penaltyAmount)).toFixed(2);
    }

    db.logAudit({
      businessId: req.user!.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'PENALTY_WAIVED',
      entity: 'PENALTY',
      entityId: penalty.id,
      newValue: { waivedAmount: penalty.penaltyAmount, reason },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: penalty,
    });
  }
}
