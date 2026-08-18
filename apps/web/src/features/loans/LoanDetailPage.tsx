import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  ArrowLeft,
  Banknote,
  Calendar,
  CalendarDays,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  FileCheck,
  Percent,
  PlusCircle,
  Clock,
  ArrowUpRight,
  SlidersHorizontal,
  PauseCircle,
  PlayCircle,
  XCircle,
  Edit3,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { Modal } from '../../components/common/Modal.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';
import { CreateLoanWizard } from './CreateLoanWizard.js';

export const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isForeclosureModalOpen, setIsForeclosureModalOpen] = useState(false);
  const [isRestructureModalOpen, setIsRestructureModalOpen] = useState(false);
  const [isChangeDateModalOpen, setIsChangeDateModalOpen] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [isEditPrincipalModalOpen, setIsEditPrincipalModalOpen] = useState(false);

  // Admin Principal Edit State
  const [newPrincipalValue, setNewPrincipalValue] = useState('');
  const [principalChangeReason, setPrincipalChangeReason] = useState('Admin adjusted principal sanction amount');
  const [isUpdatingPrincipal, setIsUpdatingPrincipal] = useState(false);

  // Change Date State
  const [newDueDate, setNewDueDate] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('Borrower requested EMI repayment date change');
  const [isChangingDate, setIsChangingDate] = useState(false);

  // Foreclosure State
  const [foreclosureMethod, setForeclosureMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'ONLINE'>('BANK_TRANSFER');
  const [foreclosureRef, setForeclosureRef] = useState('');
  const [waiverDiscount, setWaiverDiscount] = useState('0');
  const [isSettling, setIsSettling] = useState(false);

  // Restructure State
  const [newRate, setNewRate] = useState('10.0');
  const [newTenure, setNewTenure] = useState(24);
  const [newFirstDate, setNewFirstDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [restructureReason, setRestructureReason] = useState('Borrower requested extended tenure due to cashflow relief');
  const [isRestructuring, setIsRestructuring] = useState(false);

  const { data: loanData, isLoading } = useQuery({
    queryKey: ['loan-detail', id],
    queryFn: () => api.getLoanById(id!),
    enabled: !!id,
  });

  const { data: prepaymentQuote } = useQuery({
    queryKey: ['prepayment-quote', id],
    queryFn: () => api.getPrepaymentQuote(id!),
    enabled: !!id && isForeclosureModalOpen,
  });

  const loan = loanData?.loan;
  const schedule = loanData?.schedule;
  const payments = loanData?.payments || [];

  const handleUpdatePrincipal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !loan || !newPrincipalValue) return;
    setIsUpdatingPrincipal(true);

    try {
      await api.updatePrincipal(id, {
        newPrincipal: newPrincipalValue,
        reason: principalChangeReason,
      });
      setIsEditPrincipalModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
      alert(`Principal amount successfully updated to ₹${Number(newPrincipalValue).toLocaleString('en-IN')}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update principal');
    } finally {
      setIsUpdatingPrincipal(false);
    }
  };

  const handleToggleEmiStatus = async (status: 'OPEN' | 'PAUSED' | 'CLOSED') => {
    if (!id || !loan) return;
    const confirmMsg = status === 'PAUSED'
      ? 'Pause / Freeze EMI collection for this loan (Moratorium Relief)?'
      : status === 'CLOSED'
      ? 'Close EMI collection permanently for this loan?'
      : 'Open / Resume active EMI collection?';

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.toggleEmiStatus(id, {
        emiStatus: status,
        reason: `Admin set EMI status to ${status}`,
      });
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Failed to update EMI status');
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: string) => {
    if (!id) return;
    try {
      await api.toggleScheduleItemStatus(id, itemId, status);
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Failed to update installment');
    }
  };

  const handleForecloseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSettling(true);

    try {
      await api.forecloseLoan(id, {
        loanId: id,
        paymentMethod: foreclosureMethod,
        transactionReference: foreclosureRef || 'FORECLOSURE-FULL-SETTLEMENT',
        waiverDiscount,
      });
      setIsForeclosureModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Foreclosure settlement failed');
    } finally {
      setIsSettling(false);
    }
  };

  const handleRestructureLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !loan) return;
    setIsRestructuring(true);

    try {
      await api.restructureLoan(id, {
        loanId: id,
        newInterestRate: newRate,
        newCalculationMethod: loan.interestCalculationMethod,
        newPaymentFrequency: loan.paymentFrequency,
        newRemainingInstallments: newTenure,
        newFirstPaymentDate: newFirstDate,
        reasonForRestructure: restructureReason,
      });
      setIsRestructureModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Restructuring failed');
    } finally {
      setIsRestructuring(false);
    }
  };

  const handleChangePaymentDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !loan || !newDueDate) return;
    setIsChangingDate(true);

    try {
      const remainingInstallments = Math.max(1, loan.tenureValue - (loan.paidInstallmentsCount || 0));
      await api.restructureLoan(id, {
        loanId: id,
        newInterestRate: loan.interestRate,
        newCalculationMethod: loan.interestCalculationMethod,
        newPaymentFrequency: loan.paymentFrequency,
        newRemainingInstallments: remainingInstallments,
        newFirstPaymentDate: newDueDate,
        reasonForRestructure: dateChangeReason || 'Rescheduled EMI due date upon borrower request',
      });
      setIsChangeDateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Failed to update payment date');
    } finally {
      setIsChangingDate(false);
    }
  };

  if (isLoading || !loan) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const emiStatus = (loan as any).emiCollectionStatus || (loan.status === 'CLOSED' ? 'CLOSED' : 'OPEN');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/loans"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100 font-mono">{loan.loanAccountNumber}</h2>
              <StatusBadge status={loan.status} />
              {schedule?.versionNumber > 1 && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold rounded">
                  Version {schedule.versionNumber}
                </span>
              )}
              {emiStatus === 'PAUSED' && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold rounded flex items-center space-x-1">
                  <PauseCircle className="w-3 h-3 text-amber-400" />
                  <span>EMI PAUSED (Moratorium)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Borrower:{' '}
              <Link to={`/customers/${loan.customerId}`} className="text-brand-400 font-semibold hover:underline">
                {loan.customerName}
              </Link>{' '}
              • {loan.loanType} • {loan.interestCalculationMethod.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Admin Edit Principal Button */}
          <button
            onClick={() => {
              setNewPrincipalValue(loan.principalAmount);
              setIsEditPrincipalModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            title="Admin: Change Principal Sanctioned Amount"
          >
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <span>Edit Principal (₹)</span>
          </button>

          {/* Add Another Loan */}
          <button
            onClick={() => setIsNewLoanModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            title="Add another approved loan for this customer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>+ Add Loan</span>
          </button>

          {/* Change EMI Date */}
          <button
            onClick={() => {
              setNewDueDate(loan.firstPaymentDate || new Date().toISOString().split('T')[0]);
              setIsChangeDateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            title="Change or reschedule EMI due dates"
          >
            <CalendarDays className="w-4 h-4 text-sky-400" />
            <span>Change Date</span>
          </button>

          {/* Restructure */}
          <button
            onClick={() => setIsRestructureModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
          >
            <RotateCcw className="w-4 h-4 text-purple-400" />
            <span>Restructure</span>
          </button>

          {/* Foreclosure */}
          {loan.status !== 'CLOSED' && (
            <button
              onClick={() => setIsForeclosureModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            >
              <FileCheck className="w-4 h-4 text-amber-400" />
              <span>Foreclosure</span>
            </button>
          )}

          {/* Record Repayment */}
          {loan.status !== 'CLOSED' && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
            >
              <Receipt className="w-4 h-4" />
              <span>Record Repayment</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Quick Control Bar: EMI Option Open / Close / Pause */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/40">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-brand-400">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Admin EMI Collection Mode & Status
            </h4>
            <p className="text-[11px] text-slate-400">
              Control active EMI collection, pause for moratorium/relief, or close EMI schedule for this customer.
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1">
          <button
            onClick={() => handleToggleEmiStatus('OPEN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              emiStatus === 'OPEN'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Open (Active EMI)</span>
          </button>

          <button
            onClick={() => handleToggleEmiStatus('PAUSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              emiStatus === 'PAUSED'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Pause EMI (Holiday)</span>
          </button>

          <button
            onClick={() => handleToggleEmiStatus('CLOSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              emiStatus === 'CLOSED'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Close EMI</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Principal Disbursed"
          value={formatCurrency(loan.principalAmount)}
          subtitle={`Interest Rate: ${loan.interestRate}% p.a.`}
          icon={Banknote}
          accentColor="blue"
        />
        <MetricCard
          title="Outstanding Principal"
          value={formatCurrency(loan.outstandingPrincipal)}
          subtitle={`Interest Due: ${formatCurrency(loan.outstandingInterest)}`}
          icon={CreditCard}
          accentColor="emerald"
        />
        <MetricCard
          title="Principal Repaid"
          value={formatCurrency(loan.totalPrincipalPaid)}
          subtitle={`Interest Paid: ${formatCurrency(loan.totalInterestPaid)}`}
          icon={CheckCircle2}
          accentColor="emerald"
        />
        <MetricCard
          title="Penalties & Fees"
          value={formatCurrency(loan.outstandingPenalty)}
          subtitle={`Grace: ${loan.gracePeriodDays} days`}
          icon={AlertTriangle}
          accentColor="amber"
        />
      </div>

      {/* Amortization Schedule Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Amortization & Repayment Schedule (Version {schedule?.versionNumber || 1})
            </h3>
            <p className="text-xs text-slate-400">
              Maturity: {formatDate(loan.maturityDate)} • {loan.paymentFrequency} Installments
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Collect Repayment</span>
            </button>
            <div className="text-xs text-slate-400">
              Total Repayable: <span className="font-bold text-slate-100 font-mono">{formatCurrency(new Decimal(loan.principalAmount).plus(loan.outstandingInterest).plus(loan.totalInterestPaid).toFixed(2))}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3">Opening Bal.</th>
                <th className="py-3 px-3">Principal</th>
                <th className="py-3 px-3">Interest</th>
                <th className="py-3 px-3">Late Penalty</th>
                <th className="py-3 px-3">Total Due</th>
                <th className="py-3 px-3">Amount Paid</th>
                <th className="py-3 px-3">Remaining</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {schedule?.items?.map((item: any) => (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-800/30 transition ${
                    item.status === 'OVERDUE' ? 'bg-rose-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-sans text-slate-400">{item.installmentNumber}</td>
                  <td className="py-3 px-3 font-sans font-medium text-slate-200">{formatDate(item.dueDate)}</td>
                  <td className="py-3 px-3">{formatCurrency(item.openingPrincipal)}</td>
                  <td className="py-3 px-3 text-emerald-400">{formatCurrency(item.principalDue)}</td>
                  <td className="py-3 px-3 text-sky-400">{formatCurrency(item.interestDue)}</td>
                  <td className="py-3 px-3 text-amber-400">{formatCurrency(item.penaltyDue)}</td>
                  <td className="py-3 px-3 font-bold text-slate-100">{formatCurrency(item.totalEmiAmount)}</td>
                  <td className="py-3 px-3 text-emerald-400">{formatCurrency(item.totalPaid)}</td>
                  <td className="py-3 px-3 font-semibold text-rose-300">{formatCurrency(item.remainingBalance)}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <div className="flex items-center justify-end space-x-1">
                      {item.status !== 'PAID' && (
                        <>
                          <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="px-2 py-1 bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 border border-brand-500/30 rounded text-[11px] font-semibold transition"
                            title="Collect payment for this installment"
                          >
                            Pay EMI
                          </button>
                          <button
                            onClick={() => handleUpdateItemStatus(item.id, item.status === 'PAUSED' ? 'UPCOMING' : 'PAUSED')}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-[11px] font-semibold transition"
                            title="Pause or Waive this installment"
                          >
                            {item.status === 'PAUSED' ? 'Resume' : 'Pause'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Payments & Collections Ledger</h3>
            <p className="text-xs text-slate-400">All historical credits, allocations, and receipts issued</p>
          </div>
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1 transition shadow-lg shadow-brand-500/20"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>+ Record Payment</span>
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No payments have been recorded for this loan yet. Click "Record Repayment" above to post a collection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
                <tr>
                  <th className="py-3 px-3">Receipt #</th>
                  <th className="py-3 px-3">Payment Date</th>
                  <th className="py-3 px-3">Method / Ref</th>
                  <th className="py-3 px-3">Total Paid</th>
                  <th className="py-3 px-3">Principal</th>
                  <th className="py-3 px-3">Interest</th>
                  <th className="py-3 px-3">Penalty / Fees</th>
                  <th className="py-3 px-3">Collected By</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-semibold text-brand-400">{p.receiptNumber}</td>
                    <td className="py-3 px-3 font-sans">{formatDate(p.paymentDate)}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="font-semibold text-slate-200">{p.paymentMethod}</span>
                      <p className="text-[10px] text-slate-500 font-mono">{p.transactionReference}</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{formatCurrency(p.paymentAmount)}</td>
                    <td className="py-3 px-3">{formatCurrency(p.principalComponent)}</td>
                    <td className="py-3 px-3">{formatCurrency(p.interestComponent)}</td>
                    <td className="py-3 px-3 text-amber-400">
                      {formatCurrency(new Decimal(p.penaltyComponent || '0').plus(p.feeComponent || '0').toFixed(2))}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-400">{p.collectedByName}</td>
                    <td className="py-3 px-3 text-right">
                      {p.isReversal ? (
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded text-[10px] font-bold">
                          REVERSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold">
                          POSTED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin: Edit Principal Amount Modal */}
      <Modal
        isOpen={isEditPrincipalModalOpen}
        onClose={() => setIsEditPrincipalModalOpen(false)}
        title="Admin: Adjust / Edit Principal Amount"
        subtitle="Modify loan principal sanctioned amount and recalculate schedule"
        maxWidth="md"
      >
        <form onSubmit={handleUpdatePrincipal} className="space-y-4 text-xs">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span>Current Principal Amount:</span>
              <span className="font-bold text-slate-100 font-mono">{formatCurrency(loan.principalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Already Repaid Principal:</span>
              <span className="font-bold text-emerald-400 font-mono">{formatCurrency(loan.totalPrincipalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Outstanding:</span>
              <span className="font-bold text-slate-200 font-mono">{formatCurrency(loan.outstandingPrincipal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">New Principal Amount (₹) *</label>
            <input
              type="number"
              min={1}
              step="1"
              required
              value={newPrincipalValue}
              onChange={e => setNewPrincipalValue(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono text-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Reason for Principal Adjustment *</label>
            <textarea
              required
              rows={2}
              value={principalChangeReason}
              onChange={e => setPrincipalChangeReason(e.target.value)}
              placeholder="e.g. Approved top-up loan sanctioned / Sanction revision"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditPrincipalModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingPrincipal}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {isUpdatingPrincipal ? 'Updating...' : 'Save New Principal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Payment Date Modal */}
      <Modal
        isOpen={isChangeDateModalOpen}
        onClose={() => setIsChangeDateModalOpen(false)}
        title="Change EMI / Repayment Due Date"
        subtitle="Reschedule the next EMI due date for this active loan"
        maxWidth="md"
      >
        <form onSubmit={handleChangePaymentDate} className="space-y-4 text-xs">
          <div className="glass-card p-3 rounded-xl border border-slate-700 text-slate-300">
            Current Loan Account:{' '}
            <span className="font-bold text-slate-100 font-mono">{loan.loanAccountNumber}</span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">New Next Payment / EMI Due Date *</label>
            <input
              type="date"
              required
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Reason for Date Change *</label>
            <textarea
              required
              rows={2}
              value={dateChangeReason}
              onChange={e => setDateChangeReason(e.target.value)}
              placeholder="e.g. Borrower requested shift in salary cycle"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsChangeDateModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isChangingDate}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {isChangingDate ? 'Updating Date...' : 'Save & Reschedule Date'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Foreclosure Payoff Modal */}
      <Modal
        isOpen={isForeclosureModalOpen}
        onClose={() => setIsForeclosureModalOpen(false)}
        title="Full Loan Foreclosure Settlement"
        subtitle="Settle outstanding balance and close the loan account"
        maxWidth="lg"
      >
        <form onSubmit={handleForecloseLoan} className="space-y-4 text-xs">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Principal Balance:</span>
              <span className="font-bold text-slate-200 font-mono">{formatCurrency(prepaymentQuote?.outstandingPrincipal || loan.outstandingPrincipal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accrued Interest to Date:</span>
              <span className="font-bold text-slate-200 font-mono">{formatCurrency(prepaymentQuote?.accruedInterestSinceLastPayment || loan.outstandingInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Late Penalties / Fees:</span>
              <span className="font-bold text-slate-200 font-mono">{formatCurrency(prepaymentQuote?.outstandingPenalty || loan.outstandingPenalty)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-amber-500/20 text-sm">
              <span className="font-bold text-amber-300">Total Settlement Amount Due:</span>
              <span className="font-extrabold text-amber-300 font-mono">
                {formatCurrency(prepaymentQuote?.finalSettlementAmount || loan.outstandingPrincipal)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Payment Method</label>
              <select
                value={foreclosureMethod}
                onChange={e => setForeclosureMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="BANK_TRANSFER">Bank Transfer / IMPS / NEFT</option>
                <option value="ONLINE">UPI / Online Gateway</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Waiver / Discount (₹)</label>
              <input
                type="number"
                min={0}
                value={waiverDiscount}
                onChange={e => setWaiverDiscount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Transaction Reference (UTR / Cheque / Memo) *</label>
            <input
              type="text"
              required
              value={foreclosureRef}
              onChange={e => setForeclosureRef(e.target.value)}
              placeholder="e.g. UTR-2026-99881122"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsForeclosureModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSettling}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSettling ? 'Settling Loan...' : 'Confirm & Close Loan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Restructuring Modal */}
      <Modal
        isOpen={isRestructureModalOpen}
        onClose={() => setIsRestructureModalOpen(false)}
        title="Restructure Loan Schedule"
        subtitle="Recalculate remaining principal with new tenure and interest terms"
        maxWidth="lg"
      >
        <form onSubmit={handleRestructureLoan} className="space-y-4 text-xs">
          <div className="glass-card p-3 rounded-xl border border-slate-700 text-slate-300">
            Current Remaining Principal to Restructure:{' '}
            <span className="font-bold text-slate-100 font-mono">{formatCurrency(loan.outstandingPrincipal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">New Annual Rate (%)</label>
              <input
                type="number"
                step="0.1"
                required
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">New Remaining Installments</label>
              <input
                type="number"
                min={1}
                required
                value={newTenure}
                onChange={e => setNewTenure(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">New First Payment Due Date</label>
            <input
              type="date"
              required
              value={newFirstDate}
              onChange={e => setNewFirstDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Reason for Restructure *</label>
            <textarea
              required
              rows={2}
              value={restructureReason}
              onChange={e => setRestructureReason(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsRestructureModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRestructuring}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {isRestructuring ? 'Restructuring...' : 'Apply Schedule Version 2'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Repayment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['loan-detail', id] })}
        preselectedLoanId={loan.id}
      />

      {/* Add New Loan Wizard for this Customer */}
      <CreateLoanWizard
        isOpen={isNewLoanModalOpen}
        onClose={() => setIsNewLoanModalOpen(false)}
        onSuccess={() => {
          setIsNewLoanModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['loan-detail', id] });
        }}
        preselectedCustomerId={loan.customerId}
      />
    </div>
  );
};
