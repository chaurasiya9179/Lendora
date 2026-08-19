import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Receipt,
  Users,
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Loan, Customer, Payment } from '@lendora/shared-types';

function triggerCSVDownload(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'loans' | 'payments' | 'customers'>('loans');
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: api.getDashboardAnalytics,
  });

  const { data: loansData, isLoading: isLoansLoading } = useQuery({
    queryKey: ['loans-report-list'],
    queryFn: () => api.getLoans({ limit: '500' }),
  });

  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['payments-report-list'],
    queryFn: () => api.getPayments({ limit: '500' }),
  });

  const { data: customersData, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['customers-report-list'],
    queryFn: () => api.getCustomers({ limit: '500' }),
  });

  const metrics = analytics?.metrics;
  const loans: Loan[] = Array.isArray(loansData) ? loansData : (loansData?.data || []);
  const payments: Payment[] = Array.isArray(paymentsData) ? paymentsData : (paymentsData?.data || []);
  const customers: Customer[] = Array.isArray(customersData) ? customersData : (customersData?.data || []);

  const handleExportLoans = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Loan Account No',
        'Customer Name',
        'Customer Phone',
        'Loan Type',
        'Sanctioned Principal (INR)',
        'Annual Interest Rate (%)',
        'Calculation Method',
        'Outstanding Principal (INR)',
        'Outstanding Interest (INR)',
        'Total Principal Repaid (INR)',
        'Total Interest Paid (INR)',
        'Status',
        'Disbursement Date',
        'Maturity Date',
      ];

      const rows = loans.map(l => [
        `"${l.loanAccountNumber}"`,
        `"${l.customerName || ''}"`,
        `"${l.customerPhone || ''}"`,
        `"${l.loanType || 'PERSONAL'}"`,
        Number(l.principalAmount || 0).toFixed(2),
        Number(l.interestRate || 0).toFixed(2),
        `"${l.interestCalculationMethod || 'INTEREST_ONLY'}"`,
        Number(l.outstandingPrincipal || 0).toFixed(2),
        Number(l.outstandingInterest || 0).toFixed(2),
        Number(l.totalPrincipalPaid || 0).toFixed(2),
        Number(l.totalInterestPaid || 0).toFixed(2),
        `"${l.status || 'ACTIVE'}"`,
        `"${l.disbursementDate || ''}"`,
        `"${l.maturityDate || ''}"`,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      triggerCSVDownload(`lendora_loans_master_register_${new Date().toISOString().split('T')[0]}.csv`, csv);
    } catch (e) {
      alert('Failed to generate loans CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPayments = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Receipt No',
        'Loan Account No',
        'Customer Name',
        'Payment Date',
        'Total Amount Paid (INR)',
        'Principal Allocated (INR)',
        'Interest Allocated (INR)',
        'Penalty Allocated (INR)',
        'Payment Method',
        'Transaction Reference',
        'Collected By',
        'Notes',
      ];

      const rows = payments.map(p => [
        `"${p.receiptNumber}"`,
        `"${p.loanAccountNumber || ''}"`,
        `"${p.customerName || ''}"`,
        `"${p.paymentDate || ''}"`,
        Number(p.paymentAmount || 0).toFixed(2),
        Number(p.principalComponent || 0).toFixed(2),
        Number(p.interestComponent || 0).toFixed(2),
        Number(p.penaltyComponent || 0).toFixed(2),
        `"${p.paymentMethod || 'BANK_TRANSFER'}"`,
        `"${p.transactionReference || ''}"`,
        `"${p.collectedByName || 'Staff'}"`,
        `"${p.notes || ''}"`,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      triggerCSVDownload(`lendora_collections_cashflow_${new Date().toISOString().split('T')[0]}.csv`, csv);
    } catch (e) {
      alert('Failed to generate payments CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCustomers = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Customer Code',
        'First Name',
        'Last Name',
        'Phone Number',
        'Email Address',
        'ID Type',
        'Monthly Income (INR)',
        'KYC Status',
        'Account Status',
        'Created Date',
      ];

      const rows = customers.map(c => [
        `"${c.customerCode || ''}"`,
        `"${c.firstName || ''}"`,
        `"${c.lastName || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        `"${c.idType || 'AADHAAR'}"`,
        Number(c.monthlyIncome || 0).toFixed(2),
        `"${c.kycStatus || 'VERIFIED'}"`,
        `"${c.customerStatus || 'ACTIVE'}"`,
        `"${(c.createdAt || '').split('T')[0]}"`,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      triggerCSVDownload(`lendora_borrowers_directory_${new Date().toISOString().split('T')[0]}.csv`, csv);
    } catch (e) {
      alert('Failed to generate customers CSV');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered lists for live tables
  const filteredLoans = loans.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.loanAccountNumber || '').toLowerCase().includes(q) ||
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.customerPhone || '').includes(q)
    );
  });

  const filteredPayments = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.receiptNumber || '').toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.loanAccountNumber || '').toLowerCase().includes(q) ||
      (p.transactionReference || '').toLowerCase().includes(q)
    );
  });

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.customerCode || '').toLowerCase().includes(q) ||
      (c.firstName || '').toLowerCase().includes(q) ||
      (c.lastName || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Financial Intelligence & Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">Audit-ready loan register, collection performance, and risk portfolio exports</p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'loans' && (
            <button
              onClick={handleExportLoans}
              disabled={isExporting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Loans Register (CSV)</span>
            </button>
          )}

          {activeTab === 'payments' && (
            <button
              onClick={handleExportPayments}
              disabled={isExporting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Collections (CSV)</span>
            </button>
          )}

          {activeTab === 'customers' && (
            <button
              onClick={handleExportCustomers}
              disabled={isExporting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-purple-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Borrowers (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Top 3 Quick Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Loans */}
        <div
          onClick={() => setActiveTab('loans')}
          className={`glass-panel rounded-2xl p-5 border cursor-pointer transition ${
            activeTab === 'loans' ? 'border-brand-500 bg-brand-500/5 shadow-md shadow-brand-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportLoans();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-100 mt-3">Loan Master Register</h3>
          <p className="text-[11px] text-slate-400 mt-1">Complete record of principal disbursed, interest terms, and balances.</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total Sanctioned:</span>
            <span className="font-bold text-slate-100">{formatCurrency(metrics?.totalPrincipalDisbursed)}</span>
          </div>
        </div>

        {/* Card 2: Payments */}
        <div
          onClick={() => setActiveTab('payments')}
          className={`glass-panel rounded-2xl p-5 border cursor-pointer transition ${
            activeTab === 'payments' ? 'border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportPayments();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-100 mt-3">Cash Flow & Collections</h3>
          <p className="text-[11px] text-slate-400 mt-1">Receipt ledger detailing principal recovered, interest, and penalties.</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total Recovered:</span>
            <span className="font-bold text-emerald-400">{formatCurrency(metrics?.totalAmountCollected)}</span>
          </div>
        </div>

        {/* Card 3: Customers */}
        <div
          onClick={() => setActiveTab('customers')}
          className={`glass-panel rounded-2xl p-5 border cursor-pointer transition ${
            activeTab === 'customers' ? 'border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportCustomers();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-100 mt-3">Borrower CRM Directory</h3>
          <p className="text-[11px] text-slate-400 mt-1">Borrower profiles with phone numbers, KYC status, and addresses.</p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total Customers:</span>
            <span className="font-bold text-purple-400">{customers.length}</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs & Live Data Viewer */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden space-y-4 p-5">
        {/* Navigation & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('loans')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'loans'
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Loans Master ({loans.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'payments'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Collections & Receipts ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'customers'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Borrowers ({customers.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Tab 1: Loans Table */}
        {activeTab === 'loans' && (
          <div className="overflow-x-auto">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No loan accounts found matching your query.</div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
                  <tr>
                    <th className="py-2.5 px-3">Loan Account</th>
                    <th className="py-2.5 px-3">Borrower</th>
                    <th className="py-2.5 px-3">Sanctioned</th>
                    <th className="py-2.5 px-3">Rate</th>
                    <th className="py-2.5 px-3">Outstanding Mool</th>
                    <th className="py-2.5 px-3">Repaid Mool</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredLoans.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-brand-400">{l.loanAccountNumber}</td>
                      <td className="py-3 px-3 font-sans font-medium text-slate-200">
                        <div>{l.customerName || 'Borrower'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{l.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-100">{formatCurrency(l.principalAmount)}</td>
                      <td className="py-3 px-3 text-slate-300">{l.interestRate}% p.a.</td>
                      <td className="py-3 px-3 font-bold text-emerald-400">{formatCurrency(l.outstandingPrincipal)}</td>
                      <td className="py-3 px-3 text-slate-400">{formatCurrency(l.totalPrincipalPaid || '0.00')}</td>
                      <td className="py-3 px-3 font-sans">
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Payments Table */}
        {activeTab === 'payments' && (
          <div className="overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No payment receipts recorded yet.</div>
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
                  <tr>
                    <th className="py-2.5 px-3">Receipt No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Borrower / Loan</th>
                    <th className="py-2.5 px-3">Amount Paid</th>
                    <th className="py-2.5 px-3">Mool (Prin.)</th>
                    <th className="py-2.5 px-3">Byaj (Int.)</th>
                    <th className="py-2.5 px-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-emerald-400">{p.receiptNumber}</td>
                      <td className="py-3 px-3 font-sans text-slate-300">{formatDate(p.paymentDate)}</td>
                      <td className="py-3 px-3 font-sans">
                        <div className="font-medium text-slate-200">{p.customerName || 'Borrower'}</div>
                        <div className="text-[10px] text-brand-400 font-mono">{p.loanAccountNumber}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-100">{formatCurrency(p.paymentAmount)}</td>
                      <td className="py-3 px-3 text-emerald-400">{formatCurrency(p.principalComponent || '0.00')}</td>
                      <td className="py-3 px-3 text-sky-400">{formatCurrency(p.interestComponent || '0.00')}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700">
                          {p.paymentMethod?.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Customers Table */}
        {activeTab === 'customers' && (
          <div className="overflow-x-auto">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No customers registered yet.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Borrower Code</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Monthly Income</th>
                    <th className="py-2.5 px-3">KYC Status</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-mono font-semibold text-brand-400">{c.customerCode}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{c.firstName} {c.lastName}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{c.phone}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-100">{formatCurrency(c.monthlyIncome || '0')}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={c.kycStatus} />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={c.customerStatus || 'ACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

