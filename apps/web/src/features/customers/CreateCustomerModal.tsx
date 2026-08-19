import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { User, IDType, LoanType, CalculationMethod, TenureUnit, PaymentFrequency } from '@lendora/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Sparkles } from 'lucide-react';

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
  const queryClient = useQueryClient();

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

  // Initial Loan Option
  const [issueInitialLoan, setIssueInitialLoan] = useState(false);
  const [initialLoanData, setInitialLoanData] = useState({
    loanType: 'PERSONAL' as LoanType,
    principalAmount: '50000',
    interestRate: '24.0',
    calculationMethod: 'INTEREST_ONLY' as CalculationMethod,
    tenureValue: 6,
    tenureUnit: 'MONTHS' as TenureUnit,
    paymentFrequency: 'MONTHLY' as PaymentFrequency,
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

      const newCust = await api.createCustomer(payload);
      const createdCustomer = newCust?.data || newCust;
      const createdCustomerId = createdCustomer?.id;

      if (issueInitialLoan && createdCustomerId && Number(initialLoanData.principalAmount) > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthStr = nextMonth.toISOString().split('T')[0];

        await api.createLoan({
          customerId: createdCustomerId,
          loanType: initialLoanData.loanType,
          principalAmount: initialLoanData.principalAmount,
          interestRate: initialLoanData.interestRate,
          interestRatePeriod: 'ANNUAL',
          interestCalculationMethod: initialLoanData.calculationMethod,
          tenureValue: initialLoanData.tenureValue,
          tenureUnit: initialLoanData.tenureUnit,
          paymentFrequency: initialLoanData.paymentFrequency,
          disbursementDate: todayStr,
          firstPaymentDate: nextMonthStr,
          processingFee: '0',
          insuranceFee: '0',
          otherCharges: '0',
          gracePeriodDays: 3,
          latePenaltyType: 'PERCENTAGE',
          latePenaltyValue: '5.0',
          prepaymentPenaltyRate: '0.0',
          notes: 'Initial loan issued during borrower registration',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      queryClient.invalidateQueries({ queryKey: ['customers-for-loan'] });
      queryClient.invalidateQueries({ queryKey: ['loans-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });

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

        {/* Initial Loan Creation (Optional) */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-200 cursor-pointer flex items-center space-x-1.5">
                  <input
                    type="checkbox"
                    checked={issueInitialLoan}
                    onChange={e => setIssueInitialLoan(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>⚡ Issue Initial Loan / Udhar Now (Abhi Loan Dena Hai?)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Customer register hote hi unka loan account & byaj hisaab turant start ho jayega.
                </p>
              </div>
            </div>
          </div>

          {issueInitialLoan && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Principal Amount (₹ Mool) *</label>
                  <input
                    type="number"
                    required={issueInitialLoan}
                    min="1"
                    value={initialLoanData.principalAmount}
                    onChange={e => setInitialLoanData({ ...initialLoanData, principalAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono font-bold"
                    placeholder="e.g. 50000"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Interest Rate (% p.a.) • <span className="text-emerald-400">₹{(Number(initialLoanData.interestRate) / 12).toFixed(1)} Saikda</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required={issueInitialLoan}
                    value={initialLoanData.interestRate}
                    onChange={e => setInitialLoanData({ ...initialLoanData, interestRate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                    placeholder="e.g. 24 for 2% / mo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Calculation Method (Byaj Type)</label>
                  <select
                    value={initialLoanData.calculationMethod}
                    onChange={e => setInitialLoanData({ ...initialLoanData, calculationMethod: e.target.value as CalculationMethod })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 text-xs"
                  >
                    <option value="INTEREST_ONLY">✨ Sirf Byaj Har Mahine + Mool Aakhri me (Interest Only)</option>
                    <option value="EMI_REDUCING">Reducing Balance EMI (Bank Standard)</option>
                    <option value="FLAT_RATE">Flat Rate EMI</option>
                    <option value="SIMPLE_INTEREST">Simple Interest at End</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tenure (Installments)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min="1"
                      required={issueInitialLoan}
                      value={initialLoanData.tenureValue}
                      onChange={e => setInitialLoanData({ ...initialLoanData, tenureValue: parseInt(e.target.value, 10) || 1 })}
                      className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                    />
                    <select
                      value={initialLoanData.tenureUnit}
                      onChange={e => setInitialLoanData({ ...initialLoanData, tenureUnit: e.target.value as TenureUnit })}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                    >
                      <option value="MONTHS">Months (Mahine)</option>
                      <option value="DAYS">Days (Din)</option>
                      <option value="WEEKS">Weeks (Hafte)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            {isSubmitting ? (
              <span>Processing...</span>
            ) : issueInitialLoan ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Register Customer & Issue Loan</span>
              </>
            ) : (
              <span>Register Customer</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
