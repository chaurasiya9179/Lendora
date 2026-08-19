import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Banknote, Search, Plus, Eye, Calendar, User, TrendingUp, Edit3, Trash2, Receipt } from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Pagination } from '../../components/common/Pagination.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { sendLoanSummaryWhatsApp } from '../../utils/whatsapp.js';
import { CreateLoanWizard } from './CreateLoanWizard.js';
import { EditLoanModal } from './EditLoanModal.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';
import { Loan } from '@lendora/shared-types';

export const LoansListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [repayingLoanId, setRepayingLoanId] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loans-list', search, statusFilter, page],
    queryFn: () =>
      api.getLoans({
        search,
        status: statusFilter,
        page: String(page),
        limit: '15',
      }),
  });

  const loans: Loan[] = Array.isArray(data) ? data : (data?.data || []);
  const meta = Array.isArray(data) ? { total: data.length, totalPages: 1 } : (data?.meta || { total: 0, totalPages: 1 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Loan Portfolio Register</h2>
          <p className="text-xs text-slate-400 mt-0.5">Master ledger of active, disbursed, restructured, and closed loans</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Loan</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by account no, borrower, phone..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Loan Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="OVERDUE">Overdue</option>
            <option value="RESTRUCTURED">Restructured</option>
            <option value="CLOSED">Closed</option>
            <option value="DEFAULTED">Defaulted</option>
          </select>
        </div>
      </div>

      {/* Loans Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Account / Borrower</th>
                <th className="px-6 py-3.5">Type & Method</th>
                <th className="px-6 py-3.5">Principal Disbursed</th>
                <th className="px-6 py-3.5">Outstanding Bal.</th>
                <th className="px-6 py-3.5">Maturity Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading loan portfolio...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No loan records found.
                  </td>
                </tr>
              ) : (
                loans.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-sans">
                      <div className="font-semibold text-slate-100 font-mono">{l.loanAccountNumber}</div>
                      <div className="text-xs text-brand-400 font-medium mt-0.5">{l.customerName}</div>
                      <div className="text-[11px] text-slate-500">{l.customerPhone}</div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <div className="font-semibold text-slate-200">{l.loanType}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {l.interestCalculationMethod.replace(/_/g, ' ')} ({l.interestRate}%)
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-100">{formatCurrency(l.principalAmount)}</div>
                      <div className="text-[11px] text-slate-500 font-sans">Paid: {formatCurrency(l.totalPrincipalPaid)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-200">{formatCurrency(l.outstandingPrincipal)}</div>
                      <div className="text-[11px] text-slate-400 font-sans">Int. Due: {formatCurrency(l.outstandingInterest)}</div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <div className="text-slate-200">{formatDate(l.maturityDate)}</div>
                      <div className="text-[11px] text-slate-500">{l.tenureValue} installments</div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <StatusBadge status={l.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1.5">
                        {l.status === 'ACTIVE' && (
                          <button
                            onClick={() => setRepayingLoanId(l.id)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                            title="Record Repayment"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Repay</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            sendLoanSummaryWhatsApp({
                              customerName: l.customerName || 'Borrower',
                              phone: l.customerPhone,
                              loanAccountNumber: l.loanAccountNumber,
                              loanType: l.loanType,
                              principalAmount: l.principalAmount,
                              interestRate: l.interestRate,
                              calculationMethod: l.interestCalculationMethod,
                              outstandingPrincipal: l.outstandingPrincipal,
                              outstandingInterest: l.outstandingInterest,
                              totalPaid: l.totalPrincipalPaid,
                            });
                          }}
                          className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition"
                          title="Send Statement on WhatsApp"
                        >
                          <span className="text-xs">📲</span>
                        </button>
                        <button
                          onClick={() => setEditingLoan(l)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg border border-slate-700 transition"
                          title="Edit Loan Parameters"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm(`Delete loan account "${l.loanAccountNumber}"?`);
                            if (!confirmed) return;
                            try {
                              await api.deleteLoan(l.id);
                              refetch();
                            } catch (err: any) {
                              alert(err.message || 'Failed to delete loan');
                            }
                          }}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition"
                          title="Delete Loan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/loans/${l.id}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-400" />
                          <span>Schedule</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          pageSize={15}
          onPageChange={setPage}
        />
      </div>

      <CreateLoanWizard
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['loans-list'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          refetch();
        }}
      />

      {editingLoan && (
        <EditLoanModal
          isOpen={!!editingLoan}
          onClose={() => setEditingLoan(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['loans-list'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });
            refetch();
          }}
          loan={editingLoan}
        />
      )}

      <RecordPaymentModal
        isOpen={!!repayingLoanId}
        onClose={() => setRepayingLoanId(undefined)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['loans-list'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });
          refetch();
        }}
        preselectedLoanId={repayingLoanId}
      />
    </div>
  );
};
