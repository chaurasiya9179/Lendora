import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, CheckCircle2, Building, DollarSign, ShieldAlert, FileText, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api.js';
import { BusinessProfile, AllocationOrder } from '@lendora/shared-types';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<BusinessProfile>>({
    businessName: '',
    registrationNumber: '',
    taxId: '',
    contactEmail: '',
    contactPhone: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    currencyPrecision: 2,
    allocationOrder: 'PENALTY_FEES_INTEREST_PRINCIPAL',
    defaultGracePeriodDays: 3,
    defaultLatePenaltyType: 'PERCENTAGE',
    defaultLatePenaltyValue: '5.0',
    prepaymentPenaltyRate: '0.0',
    receiptFooterNote: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['business-settings'],
    queryFn: api.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await api.updateSettings(formData);
      setSavedSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Lender Platform Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">Configure business profile, currency, penalty policies, and payment waterfall priorities</p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Lender platform settings updated and logged to audit trail successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* 1. Business Profile */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <Building className="w-4 h-4 text-brand-400" />
            <span>Lender Organization Profile</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={formData.businessName || ''}
                onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Registration / License No</label>
              <input
                type="text"
                value={formData.registrationNumber || ''}
                onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={formData.contactEmail || ''}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Contact Phone *</label>
              <input
                type="tel"
                required
                value={formData.contactPhone || ''}
                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Office Address</label>
              <input
                type="text"
                value={formData.addressLine1 || ''}
                onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">City / State</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Financial & Payment Allocation Rules */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Currency & Payment Waterfall Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Currency Code (ISO)</label>
              <input
                type="text"
                value={formData.currency || 'USD'}
                onChange={e => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Currency Symbol</label>
              <input
                type="text"
                value={formData.currencySymbol || '₹'}
                onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Decimal Precision</label>
              <select
                value={formData.currencyPrecision || 2}
                onChange={e => setFormData({ ...formData, currencyPrecision: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value={0}>0 (No decimals)</option>
                <option value={2}>2 (Standard e.g. INR ₹, Paise)</option>
                <option value={4}>4 (High precision)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Payment Allocation Waterfall Priority *</label>
            <select
              value={formData.allocationOrder || 'PENALTY_FEES_INTEREST_PRINCIPAL'}
              onChange={e => setFormData({ ...formData, allocationOrder: e.target.value as AllocationOrder })}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            >
              <option value="PENALTY_FEES_INTEREST_PRINCIPAL">
                1. Penalty → 2. Fees → 3. Interest → 4. Principal (Standard Default)
              </option>
              <option value="PRINCIPAL_INTEREST_FEES_PENALTY">
                1. Principal → 2. Interest → 3. Fees → 4. Penalty (Borrower Friendly)
              </option>
              <option value="INTEREST_PRINCIPAL_FEES_PENALTY">
                1. Interest → 2. Principal → 3. Fees → 4. Penalty
              </option>
              <option value="FEES_PENALTY_INTEREST_PRINCIPAL">
                1. Fees → 2. Penalty → 3. Interest → 4. Principal
              </option>
            </select>
          </div>
        </div>

        {/* 3. Late Fees & Penalties Policy */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Delinquency & Penalty Policy</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Default Grace Period (Days)</label>
              <input
                type="number"
                min={0}
                value={formData.defaultGracePeriodDays || 0}
                onChange={e => setFormData({ ...formData, defaultGracePeriodDays: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Late Penalty Type</label>
              <select
                value={formData.defaultLatePenaltyType || 'PERCENTAGE'}
                onChange={e => setFormData({ ...formData, defaultLatePenaltyType: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="PERCENTAGE">One-time Percentage (%)</option>
                <option value="DAILY_PERCENTAGE">Daily Accrued Percentage (% / day)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Penalty Value (% or ₹)</label>
              <input
                type="number"
                step="0.1"
                value={formData.defaultLatePenaltyValue || '5.0'}
                onChange={e => setFormData({ ...formData, defaultLatePenaltyValue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Receipt Footer Disclaimers */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Receipt Disclaimers & Footer</span>
          </h3>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Printed Receipt Footer Note</label>
            <textarea
              rows={2}
              value={formData.receiptFooterNote || ''}
              onChange={e => setFormData({ ...formData, receiptFooterNote: e.target.value })}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 text-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save All Business Settings'}</span>
          </button>
        </div>
      </form>

      {/* 5. Team & Staff Management */}
      <TeamManagementSection />
    </div>
  );
};

const TeamManagementSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSuccess, setUserSuccess] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'COLLECTION_AGENT',
    password: 'Admin@123',
  });

  const { data: users = [], refetch } = useQuery({
    queryKey: ['team-users'],
    queryFn: api.getUsers,
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setIsSubmitting(true);

    try {
      await api.registerUser(newUser);
      setUserSuccess(true);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      setIsModalOpen(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'COLLECTION_AGENT',
        password: 'Admin@123',
      });
      setTimeout(() => setUserSuccess(false), 4000);
    } catch (err: any) {
      setUserError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Staff & Team Members</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Manage administrators, branch managers, collection agents, and accountants</p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-brand-500/20"
        >
          <span>+ Add Staff User</span>
        </button>
      </div>

      {userSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>New staff member created and saved to database successfully!</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold">
            <tr>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Phone</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-slate-300">
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-slate-100">{u.firstName} {u.lastName}</td>
                <td className="py-2.5 px-3 text-slate-300 font-mono">{u.email}</td>
                <td className="py-2.5 px-3 text-slate-400">{u.phone || 'N/A'}</td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    u.role === 'MANAGER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    u.role === 'ACCOUNTANT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {u.status || 'ACTIVE'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100">Add New Staff Member</h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {userError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                {userError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.firstName}
                    onChange={e => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.lastName}
                    onChange={e => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="+91 98765 00000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Role *</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="ADMIN">ADMIN (Full Access)</option>
                  <option value="MANAGER">MANAGER (Approvals & Portfolio)</option>
                  <option value="COLLECTION_AGENT">COLLECTION_AGENT (Followups & Calling)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Disbursements & Reports)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
