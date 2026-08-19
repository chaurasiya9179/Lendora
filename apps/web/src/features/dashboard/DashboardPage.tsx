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
  Edit3,
  Trash2,
  Eye,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
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
import { EditCustomerModal } from '../customers/EditCustomerModal.js';
import { CreateLoanWizard } from '../loans/CreateLoanWizard.js';
import { EditLoanModal } from '../loans/EditLoanModal.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';
import { Link } from 'react-router-dom';
import { Customer, Loan } from '@lendora/shared-types';

export const DashboardPage: React.FC = () => {
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanCustomerId, setLoanCustomerId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [repayingLoanId, setRepayingLoanId] = useState<string | undefined>(undefined);

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: api.getDashboardAnalytics,
  });

  const { data: customersData, refetch: refetchCustomers } = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: () => api.getCustomers({ limit: '6' }),
  });

  const { data: loansData, refetch: refetchLoans } = useQuery({
    queryKey: ['dashboard-loans'],
    queryFn: () => api.getLoans({ limit: '6' }),
  });

  const customers: Customer[] = Array.isArray(customersData) ? customersData : (customersData?.data || []);
  const loans: Loan[] = Array.isArray(loansData) ? loansData : (loansData?.data || []);

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

  const handleRefetchAll = () => {
    refetch();
    refetchCustomers();
    refetchLoans();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Portfolio Command Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time lending analytics, borrower directory and active loan lifecycle monitoring</p>
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

      {/* KPI Metric Cards Grid - Total Principal, Total Interest, Total Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Principal (Kul Mool)"
          value={formatCurrency(metrics?.totalPrincipalDisbursed)}
          subtitle={`Repaid: ${formatCurrency(metrics?.totalPrincipalRepaid || '0.00')} • Out: ${formatCurrency(metrics?.totalPrincipalOutstanding)}`}
          icon={Banknote}
          accentColor="blue"
        />

        <MetricCard
          title="Total Interest (Kul Byaj)"
          value={formatCurrency(metrics?.totalInterestExpected || (Number(metrics?.totalInterestEarned || 0) + Number(metrics?.totalInterestOutstanding || 0)).toFixed(2))}
          subtitle={`Earned: ${formatCurrency(metrics?.totalInterestEarned)} • Due: ${formatCurrency(metrics?.totalInterestOutstanding)}`}
          icon={TrendingUp}
          accentColor="emerald"
        />

        <MetricCard
          title="Total Amount (Mool + Byaj)"
          value={formatCurrency(metrics?.totalPortfolioAmount || (Number(metrics?.totalPrincipalDisbursed || 0) + Number(metrics?.totalInterestEarned || 0) + Number(metrics?.totalInterestOutstanding || 0)).toFixed(2))}
          subtitle={`Collected: ${formatCurrency(metrics?.totalAmountCollected)} • Baaki: ${formatCurrency(metrics?.totalAmountOutstanding || metrics?.totalPrincipalOutstanding)}`}
          icon={DollarSign}
          accentColor="purple"
        />

        <MetricCard
          title="Current Outstanding (Kul Bakiya)"
          value={formatCurrency(metrics?.totalAmountOutstanding || (Number(metrics?.totalPrincipalOutstanding || 0) + Number(metrics?.totalInterestOutstanding || 0)).toFixed(2))}
          subtitle={`Overdue: ${formatCurrency(metrics?.totalOverdueAmount)} (${metrics?.activeLoans || 0} Active Loans)`}
          icon={AlertTriangle}
          accentColor="rose"
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Recovered</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{formatCurrency(metrics?.totalAmountCollected)}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Today's Vasooli</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{formatCurrency(metrics?.todayCollection)}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">This Month</span>
            <div className="text-lg font-bold text-slate-100 font-mono">{formatCurrency(metrics?.thisMonthCollection)}</div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Borrowers</span>
            <div className="text-lg font-bold text-slate-100 font-mono">
              {metrics?.activeCustomers || 0} / {metrics?.totalCustomers || 0}
            </div>
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
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val: any) => [formatCurrency(val), '']}
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

      {/* Real-time Borrowers & Loans Master Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Borrowers & Customer Profiles */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-brand-400" />
                <span>Registered Borrowers / Customers</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Live CRM directory with KYC & Income</p>
            </div>
            <Link
              to="/customers"
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">No customers registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Phone & City</th>
                    <th className="py-2.5 px-3">KYC Status</th>
                    <th className="py-2.5 px-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {customers.slice(0, 5).map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100">{c.firstName} {c.lastName}</div>
                        <div className="text-[11px] font-mono text-brand-400">{c.customerCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-200">{c.phone}</div>
                        <div className="text-[11px] text-slate-500">{c.city || 'India'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={c.kycStatus || 'VERIFIED'} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setLoanCustomerId(c.id);
                              setIsLoanModalOpen(true);
                            }}
                            className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                            title="Issue Loan to this Customer"
                          >
                            <Banknote className="w-3 h-3" />
                            <span>Issue Loan</span>
                          </button>
                          <button
                            onClick={() => setEditingCustomer(c)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg border border-slate-700 transition"
                            title="Edit Customer Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/customers/${c.id}`}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-brand-400 rounded-lg border border-slate-700 transition"
                            title="View 360° Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Loan Accounts */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>Sanctioned Loan Portfolio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Active disbursement & repayment ledger</p>
            </div>
            <Link
              to="/loans"
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loans.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">No loans sanctioned yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Account & Borrower</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loans.slice(0, 5).map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <div className="font-mono font-semibold text-brand-400">{l.loanAccountNumber}</div>
                        <div className="text-[11px] text-slate-400">{l.customerName}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-100">
                        {formatCurrency(l.principalAmount)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200">
                        {formatCurrency(l.outstandingPrincipal)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {l.status === 'ACTIVE' && (
                            <button
                              onClick={() => setRepayingLoanId(l.id)}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Repay</span>
                            </button>
                          )}
                          <button
                            onClick={() => setEditingLoan(l)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg border border-slate-700 transition"
                            title="Edit Loan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            to={`/loans/${l.id}`}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-brand-400 rounded-lg border border-slate-700 transition"
                            title="View Schedule"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={handleRefetchAll}
      />

      <CreateLoanWizard
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setLoanCustomerId(null);
        }}
        onSuccess={() => {
          setLoanCustomerId(null);
          handleRefetchAll();
        }}
        preselectedCustomerId={loanCustomerId || undefined}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handleRefetchAll}
      />

      {editingCustomer && (
        <EditCustomerModal
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={handleRefetchAll}
          customer={editingCustomer}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          isOpen={!!editingLoan}
          onClose={() => setEditingLoan(null)}
          onSuccess={handleRefetchAll}
          loan={editingLoan}
        />
      )}

      <RecordPaymentModal
        isOpen={!!repayingLoanId}
        onClose={() => setRepayingLoanId(undefined)}
        onSuccess={handleRefetchAll}
        preselectedLoanId={repayingLoanId}
      />
    </div>
  );
};
