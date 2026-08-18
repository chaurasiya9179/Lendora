import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Calculator,
  ShieldCheck,
  CheckCircle,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import { formatCurrency } from '../../utils/formatters.js';
import { OverdueLoanItem, AgingBucketSummary } from '@lendora/shared-types';
import { Link } from 'react-router-dom';

export const OverduePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [isCalculatingPenalties, setIsCalculatingPenalties] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['overdue-aging-summary'],
    queryFn: api.getAgingSummary,
  });

  const summaries: AgingBucketSummary[] = data?.summary || [];
  const overdueLoans: OverdueLoanItem[] = data?.overdueLoans || [];

  const filteredLoans = selectedBucket
    ? overdueLoans.filter(l => l.bucket === selectedBucket)
    : overdueLoans;

  const handleRunPenalties = async () => {
    setIsCalculatingPenalties(true);
    try {
      const res = await api.calculatePenalties();
      alert(`Penalties evaluated: ${res.penaltiesAppliedCount} charges applied totaling ₹${res.totalPenaltyAmountApplied}`);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Penalty calculation failed');
    } finally {
      setIsCalculatingPenalties(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Penalty Automation Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Delinquency & Aging Buckets</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            5-tier portfolio aging analysis (1–7, 8–30, 31–60, 61–90, 90+ days) and late penalty automation
          </p>
        </div>

        <button
          onClick={handleRunPenalties}
          disabled={isCalculatingPenalties}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
        >
          <Calculator className="w-4 h-4" />
          <span>{isCalculatingPenalties ? 'Evaluating Overdue...' : 'Run Daily Penalty Engine'}</span>
        </button>
      </div>

      {/* 5 Aging Buckets Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {summaries.map(s => {
          const isSelected = selectedBucket === s.bucket;
          return (
            <div
              key={s.bucket}
              onClick={() => setSelectedBucket(isSelected ? null : s.bucket)}
              className={`glass-card p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{s.bucketLabel}</span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded-full font-bold">
                  {s.count} Loans
                </span>
              </div>
              <div className="mt-3">
                <div className="text-lg font-bold font-mono text-rose-400">
                  {formatCurrency(s.totalAmountOverdue)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  P: {formatCurrency(s.totalPrincipalOverdue)} • Int: {formatCurrency(s.totalInterestOverdue)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue Loans Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Delinquent Loans Register {selectedBucket ? `(${selectedBucket.replace(/_/g, ' ')})` : ''}
          </h3>
          <span className="text-xs text-slate-400">{filteredLoans.length} Loans Total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
              <tr>
                <th className="py-3 px-3">Borrower / Contact</th>
                <th className="py-3 px-3">Loan Account</th>
                <th className="py-3 px-3">Days Overdue</th>
                <th className="py-3 px-3">Missed EMIs</th>
                <th className="py-3 px-3">Principal Due</th>
                <th className="py-3 px-3">Penalties Accrued</th>
                <th className="py-3 px-3">Total Overdue</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading delinquency analysis...
                  </td>
                </tr>
              ) : filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No overdue loans found in this aging bucket.
                  </td>
                </tr>
              ) : (
                filteredLoans.map(loan => (
                  <tr key={loan.loanId} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-sans">
                      <Link to={`/customers/${loan.customerId}`} className="font-semibold text-slate-100 hover:text-brand-400">
                        {loan.customerName}
                      </Link>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{loan.customerPhone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-brand-400">
                      {loan.loanAccountNumber}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded font-bold">
                        {loan.daysOverdue} Days
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-300">
                      {loan.missedInstallmentsCount} Installments
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {formatCurrency(loan.principalOverdue)}
                    </td>
                    <td className="py-3 px-3 text-amber-400 font-semibold">
                      {formatCurrency(loan.penaltiesAccrued)}
                    </td>
                    <td className="py-3 px-3 text-rose-400 font-bold text-sm">
                      {formatCurrency(loan.totalOverdueAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <Link
                        to={`/loans/${loan.loanId}`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition inline-flex items-center space-x-1"
                      >
                        <span>Manage Loan</span>
                        <ArrowRight className="w-3 h-3 text-brand-400" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
