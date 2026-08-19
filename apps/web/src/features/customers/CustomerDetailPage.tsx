import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  ShieldCheck,
  CreditCard,
  Banknote,
  FileText,
  MessageSquare,
  Plus,
  Clock,
  CheckCircle,
  Edit3,
  Trash2,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters.js';
import { CustomerSummaryProfile, CustomerNoteType, Payment } from '@lendora/shared-types';
import { CreateLoanWizard } from '../loans/CreateLoanWizard.js';
import { EditCustomerModal } from './EditCustomerModal.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal.js';
import { sendPaymentReceiptWhatsApp } from '../../utils/whatsapp.js';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [noteType, setNoteType] = useState<CustomerNoteType>('CALL_LOG');
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | undefined>(undefined);
  const [viewReceiptPaymentId, setViewReceiptPaymentId] = useState<string | null>(null);

  const { data: customer, isLoading } = useQuery<CustomerSummaryProfile>({
    queryKey: ['customer-detail', id],
    queryFn: () => api.getCustomerById(id!),
    enabled: !!id,
  });

  const { data: loansData } = useQuery({
    queryKey: ['customer-loans', id],
    queryFn: () => api.getLoans({ customerId: id! }),
    enabled: !!id,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => api.getPayments({ customerId: id! }),
    enabled: !!id,
  });

  const loans = Array.isArray(loansData) 
    ? (loansData.length > 0 ? loansData : ((customer as any)?.loans || []))
    : (loansData?.data?.length ? loansData.data : ((customer as any)?.loans || []));

  const payments: Payment[] = Array.isArray(paymentsData)
    ? paymentsData
    : (paymentsData?.data || []);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !id) return;
    setIsSubmittingNote(true);

    try {
      await api.addCustomerNote(id, {
        noteType,
        content: noteContent,
      });
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleVerifyKYC = async () => {
    if (!id || !customer) return;
    const newStatus = customer.kycStatus === 'VERIFIED' ? 'PENDING' : 'VERIFIED';
    await api.updateCustomer(id, { kycStatus: newStatus });
    queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
  };

  const handleDeleteCustomer = async () => {
    if (!id || !customer) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete customer "${customer.firstName} ${customer.lastName}"?\n\nThis will remove their profile and records.`
    );
    if (!confirmed) return;

    try {
      await api.deleteCustomer(id);
      alert('Customer deleted successfully!');
      navigate('/customers');
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/customers"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-100">
                {customer.firstName} {customer.lastName}
              </h2>
              <StatusBadge status={customer.kycStatus} />
              <StatusBadge status={(customer as any).customerStatus || customer.status || 'ACTIVE'} />
            </div>
            <p className="text-xs font-mono text-brand-400 mt-0.5">{customer.customerCode}</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* WhatsApp Khata Statement */}
          <button
            onClick={() => {
              const expectedInt = customer.totalInterestExpected || customer.totalOutstandingInterest || '0.00';
              const totalKhata = customer.totalPortfolioAmount || (Number(customer.totalBorrowedPrincipal) + Number(expectedInt)).toFixed(2);
              const totalPaid = customer.totalAmountPaid || customer.totalPaidPrincipal || '0.00';
              const totalDue = (Number(customer.totalOutstandingPrincipal) + Number(customer.totalOutstandingInterest)).toFixed(2);

              const msg =
`📋 *KHATA SUMMARY (BAHI-KHATA)*

Namaste *${customer.firstName} ${customer.lastName}* ji,

Aapke khate ka vartaman hisaab:
📌 *Customer ID:* ${customer.customerCode}
💰 *Total Mool (Principal):* ${formatCurrency(customer.totalBorrowedPrincipal)}
📈 *Total Byaj (Interest):* ${formatCurrency(expectedInt)}
💵 *Total Hisaab (Mool + Byaj):* ${formatCurrency(totalKhata)}
✅ *Total Jama (Paid):* ${formatCurrency(totalPaid)}
⚖️ *Vartaman Bakiya (Outstanding):* ${formatCurrency(totalDue)}
${Number(customer.totalOverdueAmount) > 0 ? `⚠️ *Overdue Amount:* ${formatCurrency(customer.totalOverdueAmount)}\n` : ''}
Kripya kisi bhi jankari ke liye sampark karein.
Dhanyawad! 🙏`;
              const phone = (customer.phone || '').replace(/[^0-9]/g, '');
              const targetPhone = phone.length === 10 ? `91${phone}` : phone;
              window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
            title="Send complete Khata summary to borrower via WhatsApp"
          >
            <span>📲 WhatsApp Khata</span>
          </button>

          <button
            onClick={handleVerifyKYC}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
              customer.kycStatus === 'VERIFIED'
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{customer.kycStatus === 'VERIFIED' ? 'Revoke KYC' : 'Verify KYC'}</span>
          </button>

          <button
            onClick={() => setIsEditCustomerModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
          >
            <Edit3 className="w-4 h-4 text-amber-400" />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={() => setIsNewLoanModalOpen(true)}
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Loan</span>
          </button>

          <button
            onClick={handleDeleteCustomer}
            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            title="Delete Customer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Customer Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Mool (Principal Disbursed)"
          value={formatCurrency(customer.totalBorrowedPrincipal)}
          subtitle={`Repaid: ${formatCurrency(customer.totalPaidPrincipal || '0.00')} • Out: ${formatCurrency(customer.totalOutstandingPrincipal)}`}
          icon={Banknote}
          accentColor="blue"
        />
        <MetricCard
          title="Total Byaj (Expected Interest)"
          value={formatCurrency(customer.totalInterestExpected || customer.totalOutstandingInterest)}
          subtitle={`Earned: ${formatCurrency(customer.totalPaidInterest || '0.00')} • Due: ${formatCurrency(customer.totalOutstandingInterest)}`}
          icon={TrendingUp}
          accentColor="emerald"
        />
        <MetricCard
          title="Total Khata (Mool + Byaj)"
          value={formatCurrency(customer.totalPortfolioAmount || (Number(customer.totalBorrowedPrincipal) + Number(customer.totalInterestExpected || customer.totalOutstandingInterest)).toFixed(2))}
          subtitle={`Paid: ${formatCurrency(customer.totalAmountPaid || customer.totalPaidPrincipal)} • Baki: ${formatCurrency((Number(customer.totalOutstandingPrincipal) + Number(customer.totalOutstandingInterest)).toFixed(2))}`}
          icon={CreditCard}
          accentColor="purple"
        />
        <MetricCard
          title="Current Outstanding (Kul Bakiya)"
          value={formatCurrency((Number(customer.totalOutstandingPrincipal) + Number(customer.totalOutstandingInterest)).toFixed(2))}
          subtitle={`Mool: ${formatCurrency(customer.totalOutstandingPrincipal)} + Byaj: ${formatCurrency(customer.totalOutstandingInterest)}`}
          icon={Clock}
          accentColor="rose"
        />
      </div>

      {/* 2-Column Layout: Customer Details & Loan History vs Notes & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Profile & Loans */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Customer Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2.5">
                <div className="flex items-center text-slate-300 space-x-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center text-slate-300 space-x-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>{customer.email || 'No email provided'}</span>
                </div>
                <div className="flex items-center text-slate-300 space-x-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>
                    {customer.addressLine1 || 'No address'}, {customer.city || ''}, {customer.country || ''}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center text-slate-300 space-x-2">
                  <Briefcase className="w-4 h-4 text-slate-500" />
                  <span>{customer.occupation || 'Occupation N/A'} • Income: {formatCurrency(customer.monthlyIncome)}/mo</span>
                </div>
                <div className="flex items-center text-slate-300 space-x-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  <span>ID: {customer.idType || 'ID'} ({customer.idNumber || 'N/A'}) • Score: {customer.creditScore || 'N/A'}</span>
                </div>
                <div className="text-slate-400">
                  <span>Assigned Officer: </span>
                  <span className="text-slate-200 font-semibold">{customer.assignedStaffName || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Loans List */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Sanctioned Loan Accounts</h3>
                <span className="text-xs text-slate-400">{loans.length} Active / Closed Loans</span>
              </div>
              <button
                onClick={() => setIsNewLoanModalOpen(true)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Issue Loan</span>
              </button>
            </div>

            {loans.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No loans recorded for this customer yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
                    <tr>
                      <th className="py-2.5 px-3">Account No</th>
                      <th className="py-2.5 px-3">Sanctioned Mool</th>
                      <th className="py-2.5 px-3">Byaj Rate</th>
                      <th className="py-2.5 px-3">Kul Byaj</th>
                      <th className="py-2.5 px-3">Baki Mool</th>
                      <th className="py-2.5 px-3">Kul Bakiya</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right font-sans">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loans.map((loan: any) => {
                      const expectedInt = loan.totalInterestExpected || (Number(loan.outstandingInterest || 0) + Number(loan.totalInterestPaid || 0)).toFixed(2);
                      const totalRemaining = (Number(loan.outstandingPrincipal || 0) + Number(loan.outstandingInterest || 0)).toFixed(2);
                      return (
                        <tr key={loan.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-semibold text-brand-400">
                            {loan.loanAccountNumber}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-100">
                            {formatCurrency(loan.principalAmount)}
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-sans">
                            {loan.interestRate}% <span className="text-[10px] text-slate-500">p.a.</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-sky-400">
                            {formatCurrency(expectedInt)}
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-400">
                            {formatCurrency(loan.outstandingPrincipal)}
                          </td>
                          <td className="py-3 px-3 font-bold text-purple-400">
                            {formatCurrency(totalRemaining)}
                          </td>
                          <td className="py-3 px-3 font-sans">
                            <StatusBadge status={loan.status} size="sm" />
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <div className="flex items-center justify-end space-x-1.5">
                              {loan.status === 'ACTIVE' && (
                                <button
                                  onClick={() => {
                                    setSelectedLoanId(loan.id);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Repay</span>
                                </button>
                              )}
                              <Link
                                to={`/loans/${loan.id}`}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                              >
                                Manage
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Customer Payment History & Receipts Table */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Payment History & Receipts (Jamabandi)</span>
                </h3>
                <span className="text-xs text-slate-400">{payments.length} Payments Recorded</span>
              </div>
              <button
                onClick={() => {
                  setSelectedLoanId(loans[0]?.id);
                  setIsPaymentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Collect Payment</span>
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No payment transactions recorded for this customer yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase font-sans">
                    <tr>
                      <th className="py-2.5 px-3">Receipt / Ref</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Loan A/C</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Mool (Prin.)</th>
                      <th className="py-2.5 px-3">Byaj (Int.)</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right font-sans">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {payments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-emerald-400">{p.receiptNumber}</div>
                          {p.transactionReference && (
                            <div className="text-[10px] text-slate-500">{p.transactionReference}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans font-medium text-slate-200">
                          {formatDate(p.paymentDate)}
                        </td>
                        <td className="py-3 px-3 text-brand-400 font-semibold">
                          {p.loanAccountNumber || '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-100">
                          {formatCurrency(p.paymentAmount)}
                        </td>
                        <td className="py-3 px-3 text-emerald-400">
                          {formatCurrency(p.principalComponent || '0.00')}
                        </td>
                        <td className="py-3 px-3 text-sky-400">
                          {formatCurrency(p.interestComponent || '0.00')}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-medium border border-slate-700">
                            {p.paymentMethod?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => setViewReceiptPaymentId(p.id)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center space-x-1"
                              title="View & Print Official Digital Receipt"
                            >
                              <FileText className="w-3 h-3 text-brand-400" />
                              <span>Pavti</span>
                            </button>
                            <button
                              onClick={() => {
                                sendPaymentReceiptWhatsApp({
                                  receiptNumber: p.receiptNumber,
                                  customerName: customer.firstName + ' ' + customer.lastName,
                                  phone: customer.phone,
                                  loanAccountNumber: p.loanAccountNumber,
                                  paymentDate: p.paymentDate,
                                  paymentAmount: p.paymentAmount,
                                  principalPaid: p.principalComponent,
                                  interestPaid: p.interestComponent,
                                  paymentMethod: p.paymentMethod,
                                });
                              }}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/30 transition flex items-center space-x-1"
                              title="Send Payment Receipt on WhatsApp"
                            >
                              <span>📲 WhatsApp</span>
                            </button>
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

        {/* Right Column: CRM Timeline & Call Notes */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-brand-400" />
              <span>CRM Activity & Notes</span>
            </h3>

            {/* Note Input */}
            <form onSubmit={handleAddNote} className="space-y-2 text-xs">
              <div className="flex items-center space-x-2">
                <select
                  value={noteType}
                  onChange={e => setNoteType(e.target.value as CustomerNoteType)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="CALL_LOG">Call Log</option>
                  <option value="COLLECTION">Collection Note</option>
                  <option value="KYC">KYC Review</option>
                  <option value="PAYMENT_REMINDER">Reminder</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <textarea
                required
                rows={3}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Log customer interaction, contact result, or promise to pay..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
              />

              <button
                type="submit"
                disabled={isSubmittingNote}
                className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50"
              >
                {isSubmittingNote ? 'Saving...' : 'Add Note to Timeline'}
              </button>
            </form>

            {/* Timeline Stream */}
            <div className="pt-4 border-t border-slate-800/80 space-y-3 max-h-96 overflow-y-auto">
              {customer.notesList?.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No notes logged yet.</div>
              ) : (
                customer.notesList?.map(n => (
                  <div key={n.id} className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-brand-400">{n.noteType.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{n.content}</p>
                    <div className="text-[10px] text-slate-500 pt-1">Author: {n.authorName || 'Staff'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <EditCustomerModal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
        }}
        customer={customer}
      />

      <CreateLoanWizard
        isOpen={isNewLoanModalOpen}
        onClose={() => setIsNewLoanModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
          queryClient.invalidateQueries({ queryKey: ['customer-loans', id] });
        }}
        preselectedCustomerId={customer.id}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedLoanId(undefined);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
          queryClient.invalidateQueries({ queryKey: ['customer-loans', id] });
          queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
        }}
        preselectedLoanId={selectedLoanId}
      />

      {viewReceiptPaymentId && (
        <PaymentReceiptModal
          paymentId={viewReceiptPaymentId}
          isOpen={true}
          onClose={() => setViewReceiptPaymentId(null)}
        />
      )}
    </div>
  );
};
