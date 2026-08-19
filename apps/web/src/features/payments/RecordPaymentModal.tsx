import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentMethod, Loan } from '@lendora/shared-types';
import { formatCurrency } from '../../utils/formatters.js';
import { Receipt, CheckCircle, AlertCircle } from 'lucide-react';
import { PaymentReceiptModal } from './PaymentReceiptModal.js';

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedLoanId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedLoanId,
}) => {
  const queryClient = useQueryClient();
  const [loanId, setLoanId] = useState(preselectedLoanId || '');
  const [paymentAmount, setPaymentAmount] = useState('888.49');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedPaymentId, setCompletedPaymentId] = useState<string | null>(null);

  const { data: loansData } = useQuery({
    queryKey: ['active-loans-for-payment'],
    queryFn: () => api.getLoans({ limit: '100' }),
    enabled: isOpen,
  });

  const loansList: Loan[] = Array.isArray(loansData) ? loansData : (loansData?.data || []);
  const loans: Loan[] = loansList.filter((l: Loan) => l.status !== 'CLOSED');

  useEffect(() => {
    if (preselectedLoanId) {
      setLoanId(preselectedLoanId);
    } else if (loans.length > 0 && !loanId) {
      setLoanId(loans[0].id);
    }
  }, [preselectedLoanId, loans, loanId]);

  const selectedLoan = loans.find(l => l.id === loanId);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.recordPayment({
        loanId,
        paymentAmount,
        paymentDate,
        paymentMethod,
        transactionReference: transactionReference || `TXN-${Date.now()}`,
        notes,
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-customers'] });
      queryClient.invalidateQueries({ queryKey: ['loans-list'] });
      queryClient.invalidateQueries({ queryKey: ['loan-detail'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['active-loans-for-payment'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-loans'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-aging'] });

      onSuccess();
      setCompletedPaymentId(res.payment.id);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !completedPaymentId}
        onClose={onClose}
        title="Record Loan Payment Transaction"
        subtitle="Automated payment waterfall allocation (Penalty → Fees → Interest → Principal)"
        maxWidth="lg"
      >
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          {/* Loan Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Loan Account *</label>
            <select
              required
              value={loanId}
              onChange={e => setLoanId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="">-- Select Active Loan --</option>
              {loans.map(l => (
                <option key={l.id} value={l.id}>
                  {l.loanAccountNumber} • {l.customerName} (Bal: {formatCurrency(l.outstandingPrincipal)})
                </option>
              ))}
            </select>
          </div>

          {/* Current Balance Summary Banner */}
          {selectedLoan && (
            <div className="glass-card p-3 rounded-xl flex items-center justify-between text-xs border border-slate-700">
              <div>
                <span className="text-slate-400">Principal Bal:</span>{' '}
                <span className="font-bold text-slate-100 font-mono">{formatCurrency(selectedLoan.outstandingPrincipal)}</span>
              </div>
              <div>
                <span className="text-slate-400">Interest Due:</span>{' '}
                <span className="font-bold text-slate-200 font-mono">{formatCurrency(selectedLoan.outstandingInterest)}</span>
              </div>
              <div>
                <span className="text-slate-400">Late Fees:</span>{' '}
                <span className="font-bold text-amber-400 font-mono">{formatCurrency(selectedLoan.outstandingPenalty)}</span>
              </div>
            </div>
          )}

          {/* Payment Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min={0.01}
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Payment Channel / Mode</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                <option value="IMPS_NEFT">IMPS / NEFT Transfer</option>
                <option value="CASH">Cash Deposit</option>
                <option value="CHEQUE">Cheque / Demand Draft</option>
                <option value="NACH_AUTODEBIT">NACH / e-NACH Auto Debit</option>
                <option value="BANK_TRANSFER">Direct Bank Transfer / RTGS</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">UPI UTR / Cheque / Bank Ref No</label>
              <input
                type="text"
                placeholder="e.g. UPI-UTR-9982716 / CHQ-00129"
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Notes / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Monthly installment payment"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !loanId}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Post Payment & Print Receipt'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {completedPaymentId && (
        <PaymentReceiptModal
          paymentId={completedPaymentId}
          isOpen={true}
          onClose={() => {
            setCompletedPaymentId(null);
            onClose();
          }}
        />
      )}
    </>
  );
};
