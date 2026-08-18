import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { User, IDType } from '@lendora/shared-types';
import { useQuery } from '@tanstack/react-query';

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    idType: 'AADHAAR' as IDType,
    idNumber: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    occupation: '',
    employerName: '',
    monthlyIncome: '',
    creditScore: 700,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    assignedStaffId: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: api.getUsers,
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        idType: formData.idType || 'AADHAAR',
        country: formData.country || 'India',
        monthlyIncome: String(formData.monthlyIncome || '0'),
        creditScore: formData.creditScore ? Number(formData.creditScore) : 750,
      };

      if (formData.email && formData.email.trim()) payload.email = formData.email.trim();
      if (formData.dateOfBirth && formData.dateOfBirth.trim()) payload.dateOfBirth = formData.dateOfBirth.trim();
      if (formData.idNumber && formData.idNumber.trim()) payload.idNumber = formData.idNumber.trim();
      if (formData.addressLine1 && formData.addressLine1.trim()) payload.addressLine1 = formData.addressLine1.trim();
      if (formData.city && formData.city.trim()) payload.city = formData.city.trim();
      if (formData.state && formData.state.trim()) payload.state = formData.state.trim();
      if (formData.postalCode && formData.postalCode.trim()) payload.postalCode = formData.postalCode.trim();
      if (formData.occupation && formData.occupation.trim()) payload.occupation = formData.occupation.trim();
      if (formData.assignedStaffId && formData.assignedStaffId.trim()) payload.assignedStaffId = formData.assignedStaffId.trim();
      if (formData.emergencyContactName && formData.emergencyContactName.trim()) payload.emergencyContactName = formData.emergencyContactName.trim();
      if (formData.emergencyContactPhone && formData.emergencyContactPhone.trim()) payload.emergencyContactPhone = formData.emergencyContactPhone.trim();
      if (formData.emergencyContactRelation && formData.emergencyContactRelation.trim()) payload.emergencyContactRelation = formData.emergencyContactRelation.trim();
      if (formData.notes && formData.notes.trim()) payload.notes = formData.notes.trim();

      await api.createCustomer(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Customer / Borrower"
      subtitle="Complete profile & KYC information"
      maxWidth="2xl"
    >
      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Personal Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="e.g. John"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="e.g. Doe"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="+1 555-0199"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="john.doe@example.com"
            />
          </div>
        </div>

        {/* KYC & Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">ID Document Type</label>
            <select
              value={formData.idType}
              onChange={e => setFormData({ ...formData, idType: e.target.value as IDType })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVING_LICENSE">Driver's License</option>
              <option value="SSN">SSN</option>
              <option value="TAX_ID">Tax ID</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">ID Number</label>
            <input
              type="text"
              value={formData.idNumber}
              onChange={e => setFormData({ ...formData, idNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              placeholder="e.g. A9281726"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Date of Birth</label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Financial & Occupation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Occupation</label>
            <input
              type="text"
              value={formData.occupation}
              onChange={e => setFormData({ ...formData, occupation: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Monthly Income (₹)</label>
            <input
              type="number"
              placeholder="50000"
              value={formData.monthlyIncome}
              onChange={e => setFormData({ ...formData, monthlyIncome: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
        </div>

        {/* Occupation & Employer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Occupation / Profession</label>
            <input
              type="text"
              placeholder="e.g. Salaried, MSME Business Owner, Shopkeeper, Self-Employed"
              value={formData.occupation}
              onChange={e => setFormData({ ...formData, occupation: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Employer / Business Name</label>
            <input
              type="text"
              placeholder="e.g. Tata Consultancy Services / Verma Traders"
              value={formData.employerName}
              onChange={e => setFormData({ ...formData, employerName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-3 pt-1 border-t border-slate-800">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Residential / Shop Address</label>
            <input
              type="text"
              placeholder="House/Flat No, Street, Landmark"
              value={formData.addressLine1}
              onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">City / District</label>
              <input
                type="text"
                placeholder="e.g. Mumbai, Delhi, Bengaluru"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra, Karnataka, UP"
                value={formData.state}
                onChange={e => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Pincode (6 digits)</label>
              <input
                type="text"
                placeholder="e.g. 400001"
                value={formData.postalCode}
                onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Staff Assignment */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Assign Loan Officer / Agent</label>
          <select
            value={formData.assignedStaffId}
            onChange={e => setFormData({ ...formData, assignedStaffId: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">-- Select Officer --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.role})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Registering...' : 'Register Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
