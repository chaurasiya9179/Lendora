import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Search, Plus, Eye, RotateCcw, AlertTriangle, Printer } from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Pagination } from '../../components/common/Pagination.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { RecordPaymentModal } from './RecordPaymentModal.js';
import { PaymentReceiptModal } from './PaymentReceiptModal.js';
import { Modal } from '../../components/common/Modal.js';
import { Payment } from '@lendora/shared-types';

export const PaymentsListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);

  // Reversal Modal State
  const [reversalPayment, setReversalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments-list', search, page],
    queryFn: () =>
      api.getPayments({
        search,
        page: String(page),
        limit: '15',
      }),
  });

  const payments: Payment[] = Array.isArray(data) ? data : (data?.data || []);
  const meta = Array.isArray(data) ? { total: data.length, totalPages: 1 } : (data?.meta || { total: 0, totalPages: 1 });

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment || !reversalReason.trim()) return;
    setIsReversing(true);

    try {
      await api.reversePayment(reversalPayment.id, reversalReason);
      setReversalPayment(null);
      setReversalReason('');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Reversal failed');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Payment Ledger & Receipts</h2>
          <p className="text-xs text-slate-400 mt-0.5">Immutable financial ledger of collections, allocations, and reversals</p>
        </div>

        <button
          onClick={() => setIsRecordOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by receipt no, loan account, customer..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Receipt / Date</th>
                <th className="px-6 py-3.5">Loan / Borrower</th>
                <th className="px-6 py-3.5">Payment Method</th>
                <th className="px-6 py-3.5">Amount Paid</th>
                <th className="px-6 py-3.5">Allocation (P / I / Pen)</th>
                <th className="px-6 py-3.5">Collected By</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading payment transactions...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map(p => (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-800/40 transition ${
                      p.isReversal ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100 flex items-center space-x-1.5">
                        <span>{p.receiptNumber}</span>
                        {p.isReversal && (
                          <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 text-[10px] font-sans font-bold rounded">
                            REVERSAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">{formatDate(p.paymentDate)}</div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <div className="font-semibold text-brand-400 font-mono">{p.loanAccountNumber}</div>
                      <div className="text-xs text-slate-300 mt-0.5">{p.customerName}</div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[11px]">
                        {p.paymentMethod.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold text-sm ${p.isReversal ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(p.paymentAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-slate-400 font-sans">
                      <div>P: <span className="font-mono text-slate-200">{formatCurrency(p.principalComponent)}</span></div>
                      <div>I: <span className="font-mono text-slate-200">{formatCurrency(p.interestComponent)}</span> • Pen: <span className="font-mono text-amber-400">{formatCurrency(p.penaltyComponent)}</span></div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <div className="text-slate-300 font-medium">{p.collectedByName || 'System'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-sans space-x-1.5">
                      <button
                        onClick={() => setViewReceiptId(p.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      >
                        <Printer className="w-3.5 h-3.5 text-brand-400" />
                        <span>Receipt</span>
                      </button>

                      {!p.isReversal && (
                        <button
                          onClick={() => setReversalPayment(p)}
                          title="Reverse Payment"
                          className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition inline-flex items-center"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
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

      <RecordPaymentModal
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
        onSuccess={() => refetch()}
      />

      {viewReceiptId && (
        <PaymentReceiptModal
          paymentId={viewReceiptId}
          isOpen={true}
          onClose={() => setViewReceiptId(null)}
        />
      )}

      {/* Reversal Confirmation Modal */}
      {reversalPayment && (
        <Modal
          isOpen={true}
          onClose={() => setReversalPayment(null)}
          title="Issue Payment Reversal"
          subtitle={`Create compensating ledger entry for ${reversalPayment.receiptNumber}`}
          maxWidth="md"
        >
          <form onSubmit={handleReversePayment} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Reversing this payment will restore the loan balance and record an immutable audit reversal transaction.
              </span>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Reason for Reversal *</label>
              <textarea
                required
                rows={3}
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="e.g. Bank transfer bounced, incorrect amount entered by teller..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReversalPayment(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReversing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                {isReversing ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
