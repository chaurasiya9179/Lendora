import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../lib/api.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LoanType,
  CalculationMethod,
  PaymentFrequency,
  TenureUnit,
  Customer,
} from '@lendora/shared-types';
import { formatCurrency } from '../../utils/formatters.js';
import { Calculator, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

export interface CreateLoanWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCustomerId?: string;
}

export const CreateLoanWizard: React.FC<CreateLoanWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
}) => {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '');
  const [loanType, setLoanType] = useState<LoanType>('PERSONAL');
  const [principalAmount, setPrincipalAmount] = useState('50000');
  const [interestRate, setInterestRate] = useState('24.0');
  const [interestRatePeriod, setInterestRatePeriod] = useState<'ANNUAL' | 'MONTHLY' | 'DAILY'>('ANNUAL');
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('INTEREST_ONLY');
  const [tenureValue, setTenureValue] = useState(6);
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>('MONTHS');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MONTHLY');
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstPaymentDate, setFirstPaymentDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [processingFee, setProcessingFee] = useState('0');
  const [insuranceFee, setInsuranceFee] = useState('0');
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [latePenaltyValue, setLatePenaltyValue] = useState('5.0');
  const [prepaymentPenaltyRate, setPrepaymentPenaltyRate] = useState('0.0');
  const [notes, setNotes] = useState('');

  const [previewSchedule, setPreviewSchedule] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: customersData } = useQuery({
    queryKey: ['customers-for-loan'],
    queryFn: () => api.getCustomers({ limit: '100' }),
    enabled: isOpen,
  });

  const customers: Customer[] = Array.isArray(customersData)
    ? customersData
    : (customersData?.data || []);

  useEffect(() => {
    if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId);
    } else if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [preselectedCustomerId, customers, customerId]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  // Live Amortization Calculator Preview
  useEffect(() => {
    if (!isOpen || Number(principalAmount) <= 0 || tenureValue <= 0) return;

    let isMounted = true;
    setIsCalculating(true);

    api
      .previewLoanCalculation({
        principalAmount,
        interestRate,
        interestCalculationMethod: calculationMethod,
        tenureValue,
        tenureUnit,
        paymentFrequency,
        firstPaymentDate,
        disbursementDate,
      })
      .then(res => {
        if (isMounted) {
          setPreviewSchedule(res);
          setIsCalculating(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsCalculating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    principalAmount,
    interestRate,
    calculationMethod,
    tenureValue,
    tenureUnit,
    paymentFrequency,
    firstPaymentDate,
    disbursementDate,
  ]);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const targetCustomerId = customerId || preselectedCustomerId || (customers.length > 0 ? customers[0].id : '');
      if (!targetCustomerId) {
        throw new Error('Please select a valid customer / borrower first');
      }

      await api.createLoan({
        customerId: targetCustomerId,
        loanType,
        principalAmount,
        interestRate,
        interestRatePeriod,
        interestCalculationMethod: calculationMethod,
        tenureValue,
        tenureUnit,
        paymentFrequency,
        disbursementDate,
        firstPaymentDate,
        processingFee,
        insuranceFee,
        otherCharges: '0',
        gracePeriodDays,
        latePenaltyType: 'PERCENTAGE',
        latePenaltyValue,
        prepaymentPenaltyRate,
        notes,
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-loans'] });
      queryClient.invalidateQueries({ queryKey: ['loans-list'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create loan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Loan & Generate Amortization"
      subtitle="Configure interest method, tenure, and view live schedule preview"
      maxWidth="4xl"
    >
      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCreateLoan} className="space-y-6 text-xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Loan Terms & Inputs */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-100 uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
              Loan Terms & Borrower
            </h4>

            {/* Customer Select */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Borrower / Customer *</label>
              <select
                required
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.customerCode}) • {c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Loan Category</label>
                <select
                  value={loanType}
                  onChange={e => setLoanType(e.target.value as LoanType)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="PERSONAL">Personal Loan</option>
                  <option value="BUSINESS">Business / MSME Loan</option>
                  <option value="GOLD_LOAN">Gold Loan</option>
                  <option value="VEHICLE">Vehicle / Two-Wheeler Loan</option>
                  <option value="MICROFINANCE">Microfinance (MFI / JLG)</option>
                  <option value="MORTGAGE">Mortgage / Property Loan</option>
                  <option value="DASTI_DAILY">Dasti / Daily Vyapar Loan</option>
                  <option value="EQUIPMENT">Machinery / Equipment</option>
                  <option value="EDUCATION">Education Loan</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Principal Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1000}
                  value={principalAmount}
                  onChange={e => setPrincipalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Interest & Method */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Interest Rate *</label>
                  <span className="text-[10px] text-brand-400 font-mono">
                    {Number(interestRate) > 0 ? `(${(Number(interestRate) / 12).toFixed(2)}% / mo • ₹${(Number(interestRate) / 12).toFixed(1)} saikda)` : ''}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                    placeholder="e.g. 24 for 2% monthly"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-slate-500 text-xs font-semibold">% p.a.</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Calculation Method</label>
                <select
                  value={calculationMethod}
                  onChange={e => setCalculationMethod(e.target.value as CalculationMethod)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
                >
                  <option value="INTEREST_ONLY">✨ Sirf Byaj Har Mahine + Mool Aakhri me (Interest Only)</option>
                  <option value="EMI_REDUCING">Reducing Balance (Standard EMI)</option>
                  <option value="SIMPLE_INTEREST">Simple Interest</option>
                  <option value="FLAT_RATE">Flat Rate</option>
                  <option value="COMPOUND_INTEREST">Compound Interest</option>
                </select>
              </div>
            </div>

            {calculationMethod === 'INTEREST_ONLY' && (
              <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-[11px] text-brand-300">
                <span className="font-bold">💡 Byaj Mode (Interest-Only):</span> Har mahine sirf byaj aayega{' '}
                <strong className="text-white">
                  ({formatCurrency(Number(principalAmount || 0) * (Number(interestRate || 0) / 1200))}/mahina)
                </strong>
                . Poora mool (Principal: <strong className="text-white">{formatCurrency(principalAmount || 0)}</strong>) aakhiri installment par wapas aayega.
              </div>
            )}

            {/* Tenure & Frequency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tenure (Installments)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={tenureValue}
                  onChange={e => setTenureValue(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Payment Frequency</label>
                <select
                  value={paymentFrequency}
                  onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="BI_WEEKLY">Bi-Weekly (Fortnightly)</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="LUMP_SUM">Lump Sum</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Disbursement Date</label>
                <input
                  type="date"
                  required
                  value={disbursementDate}
                  onChange={e => setDisbursementDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">First Payment Due</label>
                <input
                  type="date"
                  required
                  value={firstPaymentDate}
                  onChange={e => setFirstPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Fees & Penalties */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Processing Fee (₹)</label>
                <input
                  type="number"
                  value={processingFee}
                  onChange={e => setProcessingFee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Grace Days</label>
                <input
                  type="number"
                  min={0}
                  value={gracePeriodDays}
                  onChange={e => setGracePeriodDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Late Fee (%/Fixed)</label>
                <input
                  type="number"
                  step="0.1"
                  value={latePenaltyValue}
                  onChange={e => setLatePenaltyValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Calculation Summary & Amortization Preview */}
          <div className="space-y-4 flex flex-col justify-between">
            <h4 className="font-bold text-slate-100 uppercase tracking-wider text-xs border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Financial Engine Preview</span>
              {isCalculating ? (
                <span className="text-brand-400 animate-pulse font-normal">Recalculating...</span>
              ) : (
                <span className="text-emerald-400 flex items-center space-x-1 font-normal">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Calculated</span>
                </span>
              )}
            </h4>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Periodic Installment</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(previewSchedule?.periodicInstallmentAmount)}
                </div>
              </div>

              <div className="glass-card p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Interest Due</span>
                <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">
                  {formatCurrency(previewSchedule?.totalInterestDue)}
                </div>
              </div>

              <div className="glass-card p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Repayable</span>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                  {formatCurrency(previewSchedule?.totalRepayable)}
                </div>
              </div>

              <div className="glass-card p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Maturity Date</span>
                <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                  {previewSchedule?.maturityDate || 'N/A'}
                </div>
              </div>
            </div>

            {/* Preview Amortization Schedule Table */}
            <div className="glass-panel rounded-xl overflow-hidden border border-slate-800 flex-1 max-h-56 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 sticky top-0 text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Due Date</th>
                    <th className="py-2 px-2.5">Principal (₹)</th>
                    <th className="py-2 px-2.5">Interest (₹)</th>
                    <th className="py-2 px-2.5">Total EMI (₹)</th>
                    <th className="py-2 px-2.5 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                  {previewSchedule?.items?.slice(0, 12).map((item: any) => (
                    <tr key={item.installmentNumber} className="hover:bg-slate-800/30">
                      <td className="py-1.5 px-2.5 text-slate-400">{item.installmentNumber}</td>
                      <td className="py-1.5 px-2.5">{item.dueDate}</td>
                      <td className="py-1.5 px-2.5">{formatCurrency(item.principalDue)}</td>
                      <td className="py-1.5 px-2.5 text-slate-400">{formatCurrency(item.interestDue)}</td>
                      <td className="py-1.5 px-2.5 font-bold text-slate-100">{formatCurrency(item.totalDue)}</td>
                      <td className="py-1.5 px-2.5 text-right text-slate-400">{formatCurrency(item.closingPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
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
            disabled={isSubmitting || !customerId}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 flex items-center space-x-1.5"
          >
            <span>{isSubmitting ? 'Creating Loan...' : 'Confirm & Disburse Loan'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </Modal>
  );
};
