import { Response } from 'express';
import { db } from '../../database/db.js';
import { pgPool, queryPostgres } from '../../database/postgres.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import {
  DashboardAnalytics,
  PortfolioMetrics,
  MonthlyTrendData,
  LoanStatusDistribution,
} from '@lendora/shared-types';
import Decimal from 'decimal.js';

export class ReportsController {
  public static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    let customers: any[] = [];
    let loans: any[] = [];
    let payments: any[] = [];

    if (pgPool) {
      try {
        const custRes = await queryPostgres('SELECT * FROM customers WHERE business_id = $1', [businessId]);
        customers = custRes.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          customerStatus: row.customer_status || 'ACTIVE',
        }));

        const loansRes = await queryPostgres('SELECT * FROM loans WHERE business_id = $1', [businessId]);
        loans = loansRes.rows.map(row => ({
          id: row.id,
          businessId: row.business_id,
          principalAmount: String(row.principal_amount),
          outstandingPrincipal: String(row.outstanding_principal),
          outstandingInterest: String(row.outstanding_interest),
          outstandingPenalty: String(row.outstanding_penalty || '0.00'),
          totalInterestPaid: String(row.total_interest_paid || '0.00'),
          totalPenaltyPaid: String(row.total_penalty_paid || '0.00'),
          status: row.status,
        }));

        const payRes = await queryPostgres('SELECT * FROM payments WHERE business_id = $1 AND (is_reversal IS NULL OR is_reversal = false)', [businessId]);
        payments = payRes.rows.map(row => ({
          id: row.id,
          paymentAmount: String(row.payment_amount),
          principalComponent: String(row.principal_component || '0.00'),
          interestComponent: String(row.interest_component || '0.00'),
          penaltyComponent: String(row.penalty_component || '0.00'),
          paymentDate: row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : '',
        }));
      } catch (err) {
        console.warn('PostgreSQL dashboard query fallback:', err);
      }
    }

    if (customers.length === 0 && loans.length === 0 && !pgPool) {
      customers = Array.from(db.customers.values()).filter(c => c.businessId === businessId);
      loans = Array.from(db.loans.values()).filter(l => l.businessId === businessId);
      payments = Array.from(db.payments.values()).filter(p => p.businessId === businessId && !p.isReversal);
    }

    let totalDisbursed = new Decimal(0);
    let totalOutstandingP = new Decimal(0);
    let totalInterestEarned = new Decimal(0);
    let totalOutstandingI = new Decimal(0);
    let totalCollected = new Decimal(0);
    let todayColl = new Decimal(0);
    let monthColl = new Decimal(0);
    let totalOverdue = new Decimal(0);
    let totalPenaltyColl = new Decimal(0);

    let activeLoansCount = 0;
    let closedLoansCount = 0;
    let defaultedLoansCount = 0;

    const statusCounts: Record<string, { count: number; outstanding: Decimal }> = {
      ACTIVE: { count: 0, outstanding: new Decimal(0) },
      DISBURSED: { count: 0, outstanding: new Decimal(0) },
      OVERDUE: { count: 0, outstanding: new Decimal(0) },
      RESTRUCTURED: { count: 0, outstanding: new Decimal(0) },
      CLOSED: { count: 0, outstanding: new Decimal(0) },
      DEFAULTED: { count: 0, outstanding: new Decimal(0) },
      PENDING: { count: 0, outstanding: new Decimal(0) },
    };

    for (const loan of loans) {
      totalDisbursed = totalDisbursed.plus(loan.principalAmount);
      totalOutstandingP = totalOutstandingP.plus(loan.outstandingPrincipal);
      totalInterestEarned = totalInterestEarned.plus(loan.totalInterestPaid);
      totalOutstandingI = totalOutstandingI.plus(loan.outstandingInterest);
      totalPenaltyColl = totalPenaltyColl.plus(loan.totalPenaltyPaid);

      if (['ACTIVE', 'DISBURSED', 'OVERDUE', 'RESTRUCTURED'].includes(loan.status)) {
        activeLoansCount++;
      }
      if (loan.status === 'CLOSED') closedLoansCount++;
      if (loan.status === 'DEFAULTED') defaultedLoansCount++;
      if (loan.status === 'OVERDUE') {
        totalOverdue = totalOverdue.plus(loan.outstandingPrincipal).plus(loan.outstandingPenalty);
      }

      if (statusCounts[loan.status]) {
        statusCounts[loan.status].count++;
        statusCounts[loan.status].outstanding = statusCounts[loan.status].outstanding.plus(loan.outstandingPrincipal);
      }
    }

    for (const payment of payments) {
      totalCollected = totalCollected.plus(payment.paymentAmount);
      if (payment.paymentDate === todayStr) {
        todayColl = todayColl.plus(payment.paymentAmount);
      }
      if (payment.paymentDate.startsWith(currentMonthStr)) {
        monthColl = monthColl.plus(payment.paymentAmount);
      }
    }

    const totalDueAndCollected = totalCollected.plus(totalOutstandingP);
    const efficiency = totalDueAndCollected.greaterThan(0)
      ? Math.round(Number(totalCollected.dividedBy(totalDueAndCollected).times(100).toFixed(1)))
      : 100;

    const nplRate = totalDisbursed.greaterThan(0)
      ? Math.round(Number(totalOverdue.dividedBy(totalDisbursed).times(100).toFixed(1)))
      : 0;

    const totalPrincipalRepaid = Decimal.max(0, totalDisbursed.minus(totalOutstandingP));
    const totalInterestExpected = totalInterestEarned.plus(totalOutstandingI);
    const totalPortfolioAmount = totalDisbursed.plus(totalInterestExpected);
    const totalAmountOutstanding = totalOutstandingP.plus(totalOutstandingI);

    const metrics: PortfolioMetrics = {
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.customerStatus === 'ACTIVE').length,
      totalLoans: loans.length,
      activeLoans: activeLoansCount,
      closedLoans: closedLoansCount,
      defaultedLoans: defaultedLoansCount,
      totalPrincipalDisbursed: totalDisbursed.toFixed(2),
      totalPrincipalOutstanding: totalOutstandingP.toFixed(2),
      totalPrincipalRepaid: totalPrincipalRepaid.toFixed(2),
      totalInterestEarned: totalInterestEarned.toFixed(2),
      totalInterestOutstanding: totalOutstandingI.toFixed(2),
      totalInterestExpected: totalInterestExpected.toFixed(2),
      totalPortfolioAmount: totalPortfolioAmount.toFixed(2),
      totalAmountCollected: totalCollected.toFixed(2),
      totalAmountOutstanding: totalAmountOutstanding.toFixed(2),
      todayCollection: todayColl.toFixed(2),
      thisMonthCollection: monthColl.toFixed(2),
      totalOverdueAmount: totalOverdue.toFixed(2),
      totalPenaltyCollected: totalPenaltyColl.toFixed(2),
      upcomingEmiThisWeek: '0.00',
      collectionEfficiencyRate: efficiency,
      nonPerformingLoanRate: nplRate,
    };

    // Calculate monthly trends from real database records
    const monthlyMap = new Map<string, {
      disbursed: Decimal;
      colP: Decimal;
      colI: Decimal;
      colPen: Decimal;
      total: Decimal;
    }>();

    for (const loan of loans) {
      const month = loan.disbursementDate.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          disbursed: new Decimal(0),
          colP: new Decimal(0),
          colI: new Decimal(0),
          colPen: new Decimal(0),
          total: new Decimal(0),
        });
      }
      monthlyMap.get(month)!.disbursed = monthlyMap.get(month)!.disbursed.plus(loan.principalAmount);
    }

    for (const pmt of payments) {
      const month = pmt.paymentDate.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          disbursed: new Decimal(0),
          colP: new Decimal(0),
          colI: new Decimal(0),
          colPen: new Decimal(0),
          total: new Decimal(0),
        });
      }
      const data = monthlyMap.get(month)!;
      data.colP = data.colP.plus(pmt.principalComponent);
      data.colI = data.colI.plus(pmt.interestComponent);
      data.colPen = data.colPen.plus(pmt.penaltyComponent);
      data.total = data.total.plus(pmt.paymentAmount);
    }

    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    const monthlyTrends: MonthlyTrendData[] = sortedMonths.map(month => {
      const d = monthlyMap.get(month)!;
      return {
        month,
        monthLabel: month,
        disbursedPrincipal: Number(d.disbursed.toFixed(2)),
        collectedPrincipal: Number(d.colP.toFixed(2)),
        collectedInterest: Number(d.colI.toFixed(2)),
        collectedPenalty: Number(d.colPen.toFixed(2)),
        totalCollected: Number(d.total.toFixed(2)),
      };
    });

    const statusDistribution: LoanStatusDistribution[] = Object.entries(statusCounts).map(
      ([status, data]) => ({
        status,
        count: data.count,
        totalOutstanding: Number(data.outstanding.toFixed(2)),
      })
    );

    const analytics: DashboardAnalytics = {
      metrics,
      monthlyTrends,
      statusDistribution,
      agingSummary: [],
    };

    res.json({
      success: true,
      data: analytics,
    });
  }

  public static async exportCSV(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { type } = req.query; // 'loans' | 'payments' | 'customers'

    if (type === 'loans') {
      const loans = Array.from(db.loans.values()).filter(l => l.businessId === businessId);
      const header = 'Account No,Customer,Type,Principal,Interest Rate,Outstanding Principal,Status,Disbursement Date,Maturity Date\n';
      const rows = loans.map(l =>
        `"${l.loanAccountNumber}","${l.customerName || ''}","${l.loanType}",${l.principalAmount},${l.interestRate},${l.outstandingPrincipal},"${l.status}","${l.disbursementDate}","${l.maturityDate}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lendora-loans-report.csv"');
      res.send(header + rows);
      return;
    }

    if (type === 'payments') {
      const payments = Array.from(db.payments.values()).filter(p => p.businessId === businessId);
      const header = 'Receipt No,Loan Account,Customer,Payment Date,Amount,Method,Principal,Interest,Penalty,Collected By\n';
      const rows = payments.map(p =>
        `"${p.receiptNumber}","${p.loanAccountNumber || ''}","${p.customerName || ''}","${p.paymentDate}",${p.paymentAmount},"${p.paymentMethod}",${p.principalComponent},${p.interestComponent},${p.penaltyComponent},"${p.collectedByName || ''}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="lendora-payments-report.csv"');
      res.send(header + rows);
      return;
    }

    const customers = Array.from(db.customers.values()).filter(c => c.businessId === businessId);
    const header = 'Customer Code,Name,Phone,Email,KYC Status,Customer Status,Monthly Income,Created Date\n';
    const rows = customers.map(c =>
      `"${c.customerCode}","${c.firstName} ${c.lastName}","${c.phone}","${c.email || ''}","${c.kycStatus}","${c.customerStatus}",${c.monthlyIncome},"${c.createdAt.split('T')[0]}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="lendora-customers-report.csv"');
    res.send(header + rows);
  }
}
