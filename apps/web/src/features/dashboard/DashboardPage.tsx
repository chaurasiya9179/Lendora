import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  ShieldAlert,
  Percent,
  PlusCircle,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { formatCurrency, formatPercentage } from '../../utils/formatters.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { CreateCustomerModal } from '../customers/CreateCustomerModal.js';
import { CreateLoanWizard } from '../loans/CreateLoanWizard.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: api.getDashboardAnalytics,
  });

  const metrics = analytics?.metrics;
  const monthlyTrends = analytics?.monthlyTrends || [];
  const statusDistribution = analytics?.statusDistribution || [];

  const pieColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Portfolio Command Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time lending analytics and loan lifecycle monitoring</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>New Customer</span>
          </button>

          <button
            onClick={() => setIsLoanModalOpen(true)}
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Loan</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Disbursed"
          value={formatCurrency(metrics?.totalPrincipalDisbursed)}
          subtitle={`${metrics?.totalLoans || 0} Total Loans (${metrics?.activeLoans || 0} Active)`}
          icon={Banknote}
          accentColor="emerald"
        />

        <MetricCard
          title="Principal Outstanding"
          value={formatCurrency(metrics?.totalPrincipalOutstanding)}
          subtitle={`Interest Due: ${formatCurrency(metrics?.totalInterestOutstanding)}`}
          icon={TrendingUp}
          accentColor="blue"
        />

        <MetricCard
          title="Collections (This Month)"
          value={formatCurrency(metrics?.thisMonthCollection)}
          subtitle={`Today: ${formatCurrency(metrics?.todayCollection)}`}
          icon={DollarSign}
          accentColor="emerald"
        />

        <MetricCard
          title="Total Overdue / PAR"
          value={formatCurrency(metrics?.totalOverdueAmount)}
          subtitle={`NPL Rate: ${metrics?.nonPerformingLoanRate || 0}%`}
          icon={AlertTriangle}
          accentColor="rose"
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Collection Rate</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{metrics?.collectionEfficiencyRate || 100}%</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Interest Earned</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{formatCurrency(metrics?.totalInterestEarned)}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Penalties Collected</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{formatCurrency(metrics?.totalPenaltyCollected)}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Borrowers</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{metrics?.totalCustomers || 0}</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Cashflow Bar Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Disbursement vs Collection Cash Flow</h3>
              <p className="text-xs text-slate-400">Monthly capital velocity tracking</p>
            </div>
            <Link to="/reports" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1">
              <span>View Full Report</span>
            </Link>
          </div>

          <div className="h-72 w-full">
            {monthlyTrends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No monthly transactions recorded yet. Create loans and record payments to visualize trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="disbursedPrincipal" name="Disbursed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCollected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Loan Status Distribution Donut */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Loan Status Distribution</h3>
            <p className="text-xs text-slate-400">Active vs Defaulted vs Closed portfolio</p>
          </div>

          <div className="h-56 w-full my-auto">
            {statusDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No loans created yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution.filter((s: any) => s.count > 0)}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {statusDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
            {statusDistribution.map((item: any, idx: number) => (
              <div key={item.status || item.name || `status-${idx}`} className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pieColors[idx % pieColors.length] }} />
                <span className="text-slate-400 truncate">{item.status || item.name}:</span>
                <span className="font-semibold text-slate-200">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <CreateLoanWizard
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
