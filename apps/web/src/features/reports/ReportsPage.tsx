import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileSpreadsheet, Banknote, Receipt, Users, ArrowUpRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import { formatCurrency } from '../../utils/formatters.js';

export const ReportsPage: React.FC = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: api.getDashboardAnalytics,
  });

  const metrics = analytics?.metrics;

  const handleExport = (type: 'loans' | 'payments' | 'customers') => {
    window.open(api.exportCSV(type), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Financial Intelligence & Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">Audit-ready loan register, collection performance, and risk portfolio exports</p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Loan Register Report */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Loan Master Register</h3>
              <p className="text-xs text-slate-400 mt-1">
                Complete historical record of all principal disbursed, interest terms, maturity schedules, and current outstanding balances.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Total Portfolio:</span>
                <span className="font-bold font-mono">{formatCurrency(metrics?.totalPrincipalDisbursed)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Active Principal:</span>
                <span className="font-bold font-mono text-emerald-400">{formatCurrency(metrics?.totalPrincipalOutstanding)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleExport('loans')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-brand-400" />
            <span>Export Loans (CSV)</span>
          </button>
        </div>

        {/* Collections & Cashflow Report */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Cash Flow & Collections</h3>
              <p className="text-xs text-slate-400 mt-1">
                Itemized payment receipt ledger detailing principal recovered, interest revenue, late fee penalties, and collector attribution.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Total Recovered:</span>
                <span className="font-bold font-mono text-emerald-400">{formatCurrency(metrics?.totalAmountCollected)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Interest Earned:</span>
                <span className="font-bold font-mono text-purple-400">{formatCurrency(metrics?.totalInterestEarned)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleExport('payments')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Payments (CSV)</span>
          </button>
        </div>

        {/* Customer CRM Report */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Borrower CRM Directory</h3>
              <p className="text-xs text-slate-400 mt-1">
                Complete borrower database including KYC verification status, monthly income, credit ratings, phone numbers, and addresses.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Total Borrowers:</span>
                <span className="font-bold font-mono">{metrics?.totalCustomers || 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Active Borrowers:</span>
                <span className="font-bold font-mono text-brand-400">{metrics?.activeCustomers || 0}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleExport('customers')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-sm"
          >
            <Download className="w-4 h-4 text-purple-400" />
            <span>Export Customers (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
