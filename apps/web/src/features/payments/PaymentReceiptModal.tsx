import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { Printer, Download, CheckCircle, Banknote, ShieldCheck } from 'lucide-react';
import { PaymentReceiptData } from '@lendora/shared-types';

export interface PaymentReceiptModalProps {
  paymentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  paymentId,
  isOpen,
  onClose,
}) => {
  const { data: receipt, isLoading } = useQuery<PaymentReceiptData>({
    queryKey: ['payment-receipt', paymentId],
    queryFn: () => api.getPaymentReceipt(paymentId),
    enabled: isOpen && !!paymentId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Payment Receipt"
      subtitle="Financial transaction statement & audit record"
      maxWidth="2xl"
    >
      {isLoading || !receipt ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Printable Receipt Canvas */}
          <div
            id="printable-receipt"
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-6 text-slate-100 shadow-xl"
          >
            {/* Header / Brand */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                    <Banknote className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-base font-extrabold tracking-tight text-white uppercase">
                    {receipt.businessName}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">{receipt.businessAddress}</p>
                <p className="text-[10px] text-slate-500">{receipt.businessPhone} • {receipt.businessEmail}</p>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20 inline-block">
                  {receipt.receiptNumber}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Date: {formatDate(receipt.paymentDate)}</p>
                <div className="flex items-center justify-end space-x-1 text-[10px] text-emerald-400 mt-0.5">
                  <CheckCircle className="w-3 h-3" />
                  <span>TRANSACTION VERIFIED</span>
                </div>
              </div>
            </div>

            {/* Borrower & Account Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Customer / Borrower</span>
                <div className="font-bold text-slate-100">{receipt.customerName}</div>
                <div className="text-slate-400 font-mono">Code: {receipt.customerCode}</div>
                <div className="text-slate-400">Phone: {receipt.customerPhone}</div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Loan & Method</span>
                <div className="font-mono font-bold text-slate-100">{receipt.loanAccountNumber}</div>
                <div className="text-slate-300">Method: {receipt.paymentMethod.replace(/_/g, ' ')}</div>
                <div className="text-slate-400 font-mono text-[11px]">Ref: {receipt.transactionReference || 'N/A'}</div>
              </div>
            </div>

            {/* Itemized Allocation Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] font-sans uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Financial Component</th>
                    <th className="py-2.5 px-4 text-right">Amount Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  <tr>
                    <td className="py-2.5 px-4 font-sans">Principal Repayment</td>
                    <td className="py-2.5 px-4 text-right font-bold">{formatCurrency(receipt.principalPaid)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans">Interest Repayment</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(receipt.interestPaid)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans">Late Penalty Accrual Paid</td>
                    <td className="py-2.5 px-4 text-right text-amber-400">{formatCurrency(receipt.penaltyPaid)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans">Fees & Service Charges</td>
                    <td className="py-2.5 px-4 text-right">{formatCurrency(receipt.feesPaid)}</td>
                  </tr>
                  <tr className="bg-slate-950/60 font-sans font-bold text-sm text-brand-400">
                    <td className="py-3 px-4 uppercase">Total Payment Amount Received</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400 text-base">
                      {formatCurrency(receipt.paymentAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Remaining Balance Summary */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs">
              <span className="text-slate-400">Remaining Principal Balance:</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                {formatCurrency(receipt.remainingPrincipalBalance)}
              </span>
            </div>

            {/* Footer Notes */}
            <div className="pt-2 text-[10px] text-slate-500 text-center border-t border-slate-800 space-y-1">
              <p>{receipt.footerNote || 'Official computerized financial receipt. No physical signature required.'}</p>
              <p>Collected by: {receipt.collectedByName || 'Authorized Officer'}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 no-print">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 text-xs flex items-center space-x-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt / PDF</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
