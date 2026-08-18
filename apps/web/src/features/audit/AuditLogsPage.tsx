import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Search, Eye, Filter, Code2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Pagination } from '../../components/common/Pagination.js';
import { Modal } from '../../components/common/Modal.js';
import { formatDateTime } from '../../utils/formatters.js';
import { AuditLogEntry } from '@lendora/shared-types';

export const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs-list', search, actionFilter, page],
    queryFn: () =>
      api.getAuditLogs({
        search,
        action: actionFilter,
        page: String(page),
        limit: '20',
      }),
  });

  const logs: AuditLogEntry[] = Array.isArray(data) ? data : (data?.data || []);
  const meta = Array.isArray(data) ? { total: data.length, totalPages: 1 } : (data?.meta || { total: 0, totalPages: 1 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Compliance & Audit Trail</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable system logs recording all financial adjustments, loan creations, payments, and permission changes
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by entity ID, actor email, action..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
        >
          <option value="">All Action Types</option>
          <option value="USER_LOGIN">User Login</option>
          <option value="CUSTOMER_CREATED">Customer Created</option>
          <option value="CUSTOMER_UPDATED">Customer Updated</option>
          <option value="LOAN_CREATED">Loan Created</option>
          <option value="LOAN_FORECLOSED">Loan Foreclosed</option>
          <option value="LOAN_RESTRUCTURED">Loan Restructured</option>
          <option value="PAYMENT_RECORDED">Payment Recorded</option>
          <option value="PAYMENT_REVERSED">Payment Reversed</option>
          <option value="PENALTY_WAIVED">Penalty Waived</option>
          <option value="SETTINGS_UPDATED">Settings Updated</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Actor / User</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Entity / Target ID</th>
                <th className="px-6 py-3.5">IP Address</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No audit log events found matching the criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">{log.userName || 'System'}</div>
                      <div className="text-[11px] text-slate-500">{log.userEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-800 text-brand-400 border border-slate-700 rounded-lg text-xs font-mono font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <span className="text-slate-400 font-sans uppercase text-[10px] mr-1.5">{log.entity}:</span>
                      <span className="text-slate-200 font-bold">{log.entityId}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      >
                        <Code2 className="w-3.5 h-3.5 text-brand-400" />
                        <span>Inspect Payload</span>
                      </button>
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
          pageSize={20}
          onPageChange={setPage}
        />
      </div>

      {/* JSON Payload Diff Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Audit Log Payload Inspector"
          subtitle={`Action: ${selectedLog.action} • Entity: ${selectedLog.entity} (${selectedLog.entityId})`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Actor: {selectedLog.userName} ({selectedLog.userEmail})</span>
              <span>Logged at: {formatDateTime(selectedLog.createdAt)}</span>
            </div>

            {selectedLog.previousValue && (
              <div>
                <span className="font-bold text-rose-400 uppercase text-[10px] tracking-wider block mb-1">
                  Previous State (Before Mutation):
                </span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.previousValue, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <span className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider block mb-1">
                New State (After Mutation):
              </span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-300 overflow-x-auto max-h-56">
                {JSON.stringify(selectedLog.newValue, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
