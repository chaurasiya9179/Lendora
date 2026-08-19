import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Eye, Phone, Mail, Building, ShieldCheck, Edit3, Trash2, Banknote } from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Pagination } from '../../components/common/Pagination.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { CreateCustomerModal } from './CreateCustomerModal.js';
import { EditCustomerModal } from './EditCustomerModal.js';
import { CreateLoanWizard } from '../loans/CreateLoanWizard.js';
import { Customer } from '@lendora/shared-types';

export const CustomersListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [issuingLoanCustomerId, setIssuingLoanCustomerId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customers-list', search, kycFilter, page],
    queryFn: () =>
      api.getCustomers({
        search,
        kycStatus: kycFilter,
        page: String(page),
        limit: '15',
      }),
  });

  const customers: Customer[] = Array.isArray(data) ? data : (data?.data || []);
  const meta = Array.isArray(data) ? { total: data.length, totalPages: 1 } : (data?.meta || { total: 0, totalPages: 1 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Customer CRM Directory</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage borrower profiles, credit ratings, KYC documentation and loan history</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, phone, email, customer ID..."
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
            value={kycFilter}
            onChange={e => {
              setKycFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All KYC Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Borrower Name</th>
                <th className="px-6 py-3.5">Contact Details</th>
                <th className="px-6 py-3.5">KYC Status</th>
                <th className="px-6 py-3.5">Credit Score</th>
                <th className="px-6 py-3.5">Assigned Staff</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading customers directory...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{c.firstName} {c.lastName}</div>
                      <div className="text-[11px] text-brand-400 font-mono mt-0.5">{c.customerCode}</div>
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <div className="flex items-center text-slate-300 space-x-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{c.phone}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center text-slate-400 space-x-1.5 mt-1 font-sans text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <StatusBadge status={c.kycStatus || 'PENDING'} size="sm" />
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        (c.creditScore || 700) >= 750
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : (c.creditScore || 700) >= 650
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {c.creditScore || 700}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 font-medium">{c.assignedStaffName || 'Unassigned'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.customerStatus || (c as any).status || 'ACTIVE'} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setIssuingLoanCustomerId(c.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition"
                          title="Issue Loan to this Customer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>Issue Loan</span>
                        </button>
                        <button
                          onClick={() => setEditingCustomer(c)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg border border-slate-700 transition"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm(`Delete customer "${c.firstName} ${c.lastName}"?`);
                            if (!confirmed) return;
                            try {
                              await api.deleteCustomer(c.id);
                              refetch();
                            } catch (err: any) {
                              alert(err.message || 'Failed to delete customer');
                            }
                          }}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/customers/${c.id}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-400" />
                          <span>View 360°</span>
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

      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      {editingCustomer && (
        <EditCustomerModal
          isOpen={!!editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => refetch()}
          customer={editingCustomer}
        />
      )}

      {issuingLoanCustomerId && (
        <CreateLoanWizard
          isOpen={!!issuingLoanCustomerId}
          onClose={() => setIssuingLoanCustomerId(null)}
          onSuccess={() => {
            setIssuingLoanCustomerId(null);
            refetch();
          }}
          preselectedCustomerId={issuingLoanCustomerId}
        />
      )}
    </div>
  );
};
