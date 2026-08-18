import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { MetricCard } from '../../components/common/MetricCard.js';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters.js';
import { CustomerSummaryProfile, CustomerNoteType } from '@lendora/shared-types';
import { CreateLoanWizard } from '../loans/CreateLoanWizard.js';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [noteType, setNoteType] = useState<CustomerNoteType>('CALL_LOG');
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);

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

  const loans = Array.isArray(loansData) ? loansData : (loansData?.data || []);

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
      <div className="flex items-center justify-between">
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

        <div className="flex items-center space-x-2">
          <button
            onClick={handleVerifyKYC}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
              customer.kycStatus === 'VERIFIED'
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{customer.kycStatus === 'VERIFIED' ? 'Revoke KYC' : 'Verify KYC'}</span>
          </button>

          <button
            onClick={() => setIsNewLoanModalOpen(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Issue New Loan</span>
          </button>
        </div>
      </div>

      {/* Customer Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Borrowed"
          value={formatCurrency(customer.totalBorrowedPrincipal)}
          subtitle={`${customer.totalLoansCount} Total Loans (${customer.activeLoansCount} Active)`}
          icon={Banknote}
          accentColor="blue"
        />
        <MetricCard
          title="Principal Outstanding"
          value={formatCurrency(customer.totalOutstandingPrincipal)}
          subtitle={`Interest Due: ${formatCurrency(customer.totalOutstandingInterest)}`}
          icon={CreditCard}
          accentColor="emerald"
        />
        <MetricCard
          title="Principal Repaid"
          value={formatCurrency(customer.totalPaidPrincipal)}
          icon={CheckCircle}
          accentColor="emerald"
        />
        <MetricCard
          title="Overdue Amount"
          value={formatCurrency(customer.totalOverdueAmount)}
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
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Loan Accounts</h3>
                <span className="text-xs text-slate-400">{loans.length} Loans Total</span>
              </div>
              <button
                onClick={() => setIsNewLoanModalOpen(true)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Loan</span>
              </button>
            </div>

            {loans.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No loans recorded for this customer yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Account No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Principal</th>
                      <th className="py-2.5 px-3">Outstanding</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {loans.map((loan: any) => (
                      <tr key={loan.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-semibold text-brand-400">
                          {loan.loanAccountNumber}
                        </td>
                        <td className="py-3 px-3">{loan.loanType}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-100">
                          {formatCurrency(loan.principalAmount)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-200">
                          {formatCurrency(loan.outstandingPrincipal)}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={loan.status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            to={`/loans/${loan.id}`}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                          >
                            Schedule
                          </Link>
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

      <CreateLoanWizard
        isOpen={isNewLoanModalOpen}
        onClose={() => setIsNewLoanModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
          queryClient.invalidateQueries({ queryKey: ['customer-loans', id] });
        }}
        preselectedCustomerId={customer.id}
      />
    </div>
  );
};
