import { AgingBucketSummary } from './overdue.js';

export interface PortfolioMetrics {
  totalCustomers: number;
  activeCustomers: number;
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  defaultedLoans: number;
  totalPrincipalDisbursed: string;
  totalPrincipalOutstanding: string;
  totalPrincipalRepaid?: string;
  totalInterestEarned: string;
  totalInterestOutstanding: string;
  totalInterestExpected?: string;
  totalPortfolioAmount?: string;
  totalAmountCollected: string;
  totalAmountOutstanding?: string;
  todayCollection: string;
  thisMonthCollection: string;
  totalOverdueAmount: string;
  totalPenaltyCollected: string;
  upcomingEmiThisWeek: string;
  collectionEfficiencyRate: number; // Percentage
  nonPerformingLoanRate: number; // PAR 30/90 percentage
}

export interface MonthlyTrendData {
  month: string; // e.g. '2026-01'
  monthLabel: string;
  disbursedPrincipal: number;
  collectedPrincipal: number;
  collectedInterest: number;
  collectedPenalty: number;
  totalCollected: number;
}

export interface LoanStatusDistribution {
  status: string;
  count: number;
  totalOutstanding: number;
}

export interface DashboardAnalytics {
  metrics: PortfolioMetrics;
  monthlyTrends: MonthlyTrendData[];
  statusDistribution: LoanStatusDistribution[];
  agingSummary: AgingBucketSummary[];
}
