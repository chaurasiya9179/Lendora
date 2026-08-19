import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { Customer, KYCStatus, CustomerStatus } from '@lendora/shared-types';
import { User, Phone, Mail, MapPin, Briefcase, ShieldCheck, DollarSign, Save } from 'lucide-react';

export interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const [formData, setFormData] = useState({
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    phone: customer.phone || '',
    email: customer.email || '',
    dateOfBirth: customer.dateOfBirth || '',
    idType: customer.idType || 'AADHAAR',
    idNumber: customer.idNumber || '',
    addressLine1: customer.addressLine1 || '',
    city: customer.city || '',
    state: customer.state || '',
    postalCode: customer.postalCode || '',
    country: customer.country || 'India',
    occupation: customer.occupation || '',
    employerName: customer.employerName || '',
    monthlyIncome: customer.monthlyIncome || '0.00',
    creditScore: customer.creditScore || 750,
    kycStatus: customer.kycStatus || 'VERIFIED',
    customerStatus: customer.customerStatus || 'ACTIVE',
    notes: customer.notes || '',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
        email: customer.email || '',
        dateOfBirth: customer.dateOfBirth || '',
        idType: customer.idType || 'AADHAAR',
        idNumber: customer.idNumber || '',
        addressLine1: customer.addressLine1 || '',
        city: customer.city || '',
        state: customer.state || '',
        postalCode: customer.postalCode || '',
        country: customer.country || 'India',
        occupation: customer.occupation || '',
        employerName: customer.employerName || '',
        monthlyIncome: customer.monthlyIncome || '0.00',
        creditScore: customer.creditScore || 750,
        kycStatus: customer.kycStatus || 'VERIFIED',
        customerStatus: customer.customerStatus || 'ACTIVE',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.updateCustomer(customer.id, formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Customer: ${customer.firstName} ${customer.lastName}`} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div>
          <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">Personal & Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Employment & Status */}
        <div>
          <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">Employment & Financials</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Monthly Income (₹)</label>
              <input
                type="text"
                value={formData.monthlyIncome}
                onChange={e => setFormData({ ...formData, monthlyIncome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Occupation</label>
              <input
                type="text"
                value={formData.occupation}
                onChange={e => setFormData({ ...formData, occupation: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Credit Score (300-900)</label>
              <input
                type="number"
                value={formData.creditScore}
                onChange={e => setFormData({ ...formData, creditScore: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* KYC & Account Status */}
        <div>
          <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">KYC & Account Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">KYC Verification Status</label>
              <select
                value={formData.kycStatus}
                onChange={e => setFormData({ ...formData, kycStatus: e.target.value as KYCStatus })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="VERIFIED">VERIFIED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Customer Account Status</label>
              <select
                value={formData.customerStatus}
                onChange={e => setFormData({ ...formData, customerStatus: e.target.value as CustomerStatus })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BLACKLISTED">BLACKLISTED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Notes</label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Special customer remarks..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Actions */}
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
            <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
