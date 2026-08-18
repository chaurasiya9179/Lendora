import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Eye, Phone, Mail, Building, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Pagination } from '../../components/common/Pagination.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { CreateCustomerModal } from './CreateCustomerModal.js';
import { Customer } from '@lendora/shared-types';

export const CustomersListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
            placeholder="Search by name, phone, code..."
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
            <option value="VERIFIED">KYC Verified</option>
            <option value="PENDING">KYC Pending</option>
            <option value="REJECTED">KYC Rejected</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Customer / Code</th>
                <th className="px-6 py-3.5">Contact</th>
                <th className="px-6 py-3.5">KYC Status</th>
                <th className="px-6 py-3.5">Income & Credit</th>
                <th className="px-6 py-3.5">Assigned Officer</th>
                <th className="px-6 py-3.5">Customer Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No customers found matching the criteria.
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{c.firstName} {c.lastName}</div>
                      <div className="text-[11px] font-mono text-brand-400 mt-0.5">{c.customerCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5 text-slate-200">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{c.phone}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.kycStatus} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-slate-200 font-semibold">{formatCurrency(c.monthlyIncome)}/mo</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Score: {c.creditScore || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 font-medium">{c.assignedStaffName || 'Unassigned'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.customerStatus} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-400" />
                        <span>View 360° Profile</span>
                      </Link>
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
    </div>
  );
};
