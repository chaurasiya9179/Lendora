import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { Loan, LoanStatus, LoanType, PaymentFrequency } from '@lendora/shared-types';
import { Save, AlertTriangle } from 'lucide-react';

export interface EditLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: Loan;
}

export const EditLoanModal: React.FC<EditLoanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  loan,
}) => {
  const [formData, setFormData] = useState({
    principalAmount: loan.principalAmount || '0.00',
    outstandingPrincipal: loan.outstandingPrincipal || '0.00',
    outstandingInterest: loan.outstandingInterest || '0.00',
    outstandingPenalty: loan.outstandingPenalty || '0.00',
    interestRate: loan.interestRate || '12.0',
    tenureValue: loan.tenureValue || 12,
    paymentFrequency: loan.paymentFrequency || 'MONTHLY',
    status: loan.status || 'ACTIVE',
  });

  useEffect(() => {
    if (loan) {
      setFormData({
        principalAmount: loan.principalAmount || '0.00',
        outstandingPrincipal: loan.outstandingPrincipal || '0.00',
        outstandingInterest: loan.outstandingInterest || '0.00',
        outstandingPenalty: loan.outstandingPenalty || '0.00',
        interestRate: loan.interestRate || '12.0',
        tenureValue: loan.tenureValue || 12,
        paymentFrequency: loan.paymentFrequency || 'MONTHLY',
        status: loan.status || 'ACTIVE',
      });
    }
  }, [loan]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.updateLoan(loan.id, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Loan: ${loan.loanAccountNumber}`} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Sanctioned Principal (₹) *</label>
            <input
              type="text"
              required
              value={formData.principalAmount}
              onChange={e => setFormData({ ...formData, principalAmount: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Outstanding Principal (₹) *</label>
            <input
              type="text"
              required
              value={formData.outstandingPrincipal}
              onChange={e => setFormData({ ...formData, outstandingPrincipal: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Outstanding Interest (₹)</label>
            <input
              type="text"
              value={formData.outstandingInterest}
              onChange={e => setFormData({ ...formData, outstandingInterest: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Outstanding Penalty (₹)</label>
            <input
              type="text"
              value={formData.outstandingPenalty}
              onChange={e => setFormData({ ...formData, outstandingPenalty: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Annual Interest Rate (%) *</label>
            <input
              type="text"
              required
              value={formData.interestRate}
              onChange={e => setFormData({ ...formData, interestRate: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Tenure (Installments) *</label>
            <input
              type="number"
              required
              value={formData.tenureValue}
              onChange={e => setFormData({ ...formData, tenureValue: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Payment Frequency</label>
            <select
              value={formData.paymentFrequency}
              onChange={e => setFormData({ ...formData, paymentFrequency: e.target.value as PaymentFrequency })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="MONTHLY">MONTHLY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="BI_WEEKLY">BI_WEEKLY</option>
              <option value="DAILY">DAILY</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Loan Lifecycle Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as LoanStatus })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CLOSED">CLOSED</option>
              <option value="RESTRUCTURED">RESTRUCTURED</option>
              <option value="DEFAULTED">DEFAULTED</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Update Loan'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
