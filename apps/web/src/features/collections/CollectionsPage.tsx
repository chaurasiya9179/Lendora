import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  Search,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { CollectionTask, CollectionStatus, ContactResult } from '@lendora/shared-types';

export const CollectionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);

  // Note Modal State
  const [updateStatus, setUpdateStatus] = useState<CollectionStatus>('PROMISE_TO_PAY');
  const [contactResult, setContactResult] = useState<ContactResult>('PROMISED');
  const [promiseDate, setPromiseDate] = useState(new Date().toISOString().split('T')[0]);
  const [promiseAmount, setPromiseAmount] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: tasksData = [], isLoading } = useQuery({
    queryKey: ['collection-tasks', statusFilter],
    queryFn: () => api.getCollectionTasks({ status: statusFilter }),
  });

  const { data: performanceData = [] } = useQuery({
    queryKey: ['collection-performance'],
    queryFn: api.getAgentPerformance,
  });

  const tasks: CollectionTask[] = Array.isArray(tasksData) ? tasksData : (tasksData?.data || []);
  const performance: any[] = Array.isArray(performanceData) ? performanceData : (performanceData?.data || []);

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !noteContent.trim()) return;
    setIsUpdating(true);

    try {
      await api.updateCollectionNote(selectedTask.id, {
        status: updateStatus,
        contactResult,
        promiseToPayDate: updateStatus === 'PROMISE_TO_PAY' ? promiseDate : undefined,
        promiseAmount: updateStatus === 'PROMISE_TO_PAY' ? promiseAmount : undefined,
        notes: noteContent,
      });

      setSelectedTask(null);
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['collection-tasks'] });
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Collection Agent Command Portal</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track daily assigned follow-ups, Promise-to-Pay (PTP) commitments, and call outcomes</p>
        </div>
      </div>

      {/* Agent Target Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {performance.map((agent: any) => (
          <div key={agent.agentId} className="glass-card rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-200 uppercase">
                  {agent.agentName[0]}
                </div>
                <span className="text-xs font-bold text-slate-200">{agent.agentName}</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">{agent.efficiencyPercentage}%</span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Collected: {formatCurrency(agent.collectedAmount)}</span>
                <span>Target: {formatCurrency(agent.targetAmount)}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (Number(agent.collectedAmount) / Number(agent.targetAmount)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>{agent.assignedTasksCount} Tasks Assigned</span>
              <span>{agent.resolvedTasksCount} Resolved / PTP</span>
            </div>
          </div>
        ))}
      </div>

      {/* Follow-up Tasks List */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            Follow-Up & Delinquency Call Queue
          </h3>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Follow-up Statuses</option>
            <option value="PENDING">Pending Action</option>
            <option value="PROMISE_TO_PAY">Promise to Pay (PTP)</option>
            <option value="CONTACTED">Contacted</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <tr>
                <th className="py-3 px-3">Borrower / Contact</th>
                <th className="py-3 px-3">Loan Account</th>
                <th className="py-3 px-3">Due / Overdue Amt</th>
                <th className="py-3 px-3">Assigned Agent</th>
                <th className="py-3 px-3">PTP Date & Commitment</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading collection tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No active collection tasks found.
                  </td>
                </tr>
              ) : (
                tasks.map((task: any) => (
                  <tr key={task.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{task.customerName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{task.customerPhone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-brand-400">
                      {task.loanAccountNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-400 font-bold">
                      {formatCurrency(task.overdueAmount)}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-medium">
                      {task.assignedAgentName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-3">
                      {task.promiseToPayDate ? (
                        <div>
                          <div className="font-semibold text-amber-400">{formatDate(task.promiseToPayDate)}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Amt: {formatCurrency(task.promiseAmount)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setUpdateStatus(task.status);
                          setPromiseDate(task.promiseToPayDate || new Date().toISOString().split('T')[0]);
                          setPromiseAmount(task.promiseAmount || '');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition inline-flex items-center space-x-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                        <span>Log Call</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Call / Follow-up Note Modal */}
      {selectedTask && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          title="Log Collection Call & Outcome"
          subtitle={`Borrower: ${selectedTask.customerName} (${selectedTask.customerPhone})`}
          maxWidth="md"
        >
          <form onSubmit={handleUpdateNote} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Follow-up Outcome Status *</label>
              <select
                value={updateStatus}
                onChange={e => setUpdateStatus(e.target.value as CollectionStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="PROMISE_TO_PAY">Promise to Pay (PTP)</option>
                <option value="CONTACTED">Customer Contacted (In Negotiation)</option>
                <option value="RESOLVED">Resolved (Paid)</option>
                <option value="DEFAULTED">Refused / High Risk Default</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Call Contact Result</label>
              <select
                value={contactResult}
                onChange={e => setContactResult(e.target.value as ContactResult)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="PROMISED">Promised to Pay</option>
                <option value="REACHED">Reached (Spoke to borrower)</option>
                <option value="UNREACHABLE">Unreachable (Ringing/Voicemail)</option>
                <option value="WRONG_NUMBER">Wrong / Disconnected Number</option>
                <option value="REFUSED_TO_PAY">Refused to Pay</option>
              </select>
            </div>

            {updateStatus === 'PROMISE_TO_PAY' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Promised Pay Date</label>
                  <input
                    type="date"
                    required
                    value={promiseDate}
                    onChange={e => setPromiseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Promised Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={promiseAmount}
                    onChange={e => setPromiseAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                    placeholder="25000.00"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Call Notes & Remarks *</label>
              <textarea
                required
                rows={3}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Detail the conversation, agreed payment method, or dispute reasons..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save Follow-up Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
