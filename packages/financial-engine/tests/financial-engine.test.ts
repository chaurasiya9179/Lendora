import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  calculateSimpleInterest,
  calculateCompoundInterest,
  calculateFlatRate,
  generateAmortizationSchedule,
  allocatePaymentWaterfall,
  calculateLatePenalty,
  calculateForeclosureQuote,
  restructureLoanSchedule,
} from '../src/index.js';

describe('Lendora Financial Calculation Engine', () => {
  describe('EMI (Reducing Balance) Calculations', () => {
    it('calculates exact monthly EMI for a standard $10,000 loan at 12% for 12 months', () => {
      const result = calculateEMI(10000, 12, 12, 'MONTHLY');
      // Standard financial formula: EMI ≈ $888.49
      expect(result.emiAmount).toBe('888.49');
      expect(result.totalInstallments).toBe(12);
      expect(Number(result.totalInterestEstimate)).toBeGreaterThan(600);
      expect(Number(result.totalInterestEstimate)).toBeLessThan(700);
    });

    it('handles zero interest loan without NaN/divide by zero', () => {
      const result = calculateEMI(12000, 0, 12, 'MONTHLY');
      expect(result.emiAmount).toBe('1000.00');
      expect(result.totalInterestEstimate).toBe('0.00');
      expect(result.totalRepayableEstimate).toBe('12000.00');
    });

    it('handles 1 single installment', () => {
      const result = calculateEMI(5000, 10, 1, 'MONTHLY');
      // 1 month at 10% annual: interest = 5000 * 0.10 / 12 = 41.67
      expect(result.emiAmount).toBe('5041.67');
      expect(result.totalInterestEstimate).toBe('41.67');
    });
  });

  describe('Amortization Schedule Generation', () => {
    it('generates a 12-month reducing balance schedule where closing balance is exactly 0.00', () => {
      const schedule = generateAmortizationSchedule({
        principalAmount: '10000.00',
        annualInterestRate: '12.0',
        calculationMethod: 'EMI_REDUCING',
        paymentFrequency: 'MONTHLY',
        totalInstallments: 12,
        firstPaymentDate: '2026-01-01',
      });

      expect(schedule.items.length).toBe(12);
      expect(schedule.items[0].openingPrincipal).toBe('10000.00');
      expect(schedule.items[11].closingPrincipal).toBe('0.00');

      // Sum of principal due must strictly equal 10,000.00
      const totalPrincipalPaid = schedule.items.reduce(
        (sum, item) => sum + Number(item.principalDue),
        0
      );
      expect(Math.round(totalPrincipalPaid * 100) / 100).toBe(10000.0);
    });

    it('generates Flat Rate schedule correctly', () => {
      const schedule = generateAmortizationSchedule({
        principalAmount: '12000.00',
        annualInterestRate: '10.0',
        calculationMethod: 'FLAT_RATE',
        paymentFrequency: 'MONTHLY',
        totalInstallments: 12,
        firstPaymentDate: '2026-01-01',
      });

      expect(schedule.items.length).toBe(12);
      // Flat rate total interest for 1 year = 12,000 * 10% = 1,200.00 -> 100/mo
      expect(schedule.items[0].interestDue).toBe('100.00');
      expect(schedule.items[0].principalDue).toBe('1000.00');
      expect(schedule.items[11].closingPrincipal).toBe('0.00');
    });
  });

  describe('Simple & Compound Interest', () => {
    it('calculates simple interest accurately', () => {
      const res = calculateSimpleInterest(50000, 8.5, 2, 'YEARS');
      // SI = 50000 * 8.5% * 2 = 8500
      expect(res.totalInterest).toBe('8500.00');
      expect(res.totalRepayable).toBe('58500.00');
    });

    it('calculates compound interest with monthly compounding', () => {
      const res = calculateCompoundInterest(10000, 12, 1, 'YEARS', 'MONTHLY');
      // A = 10000 * (1 + 0.01)^12 ≈ 11268.25
      expect(res.maturityAmount).toBe('11268.25');
      expect(res.totalInterest).toBe('1268.25');
    });
  });

  describe('Payment Waterfall Allocation', () => {
    const mockPendingItems = [
      {
        id: 'item-1',
        installmentNumber: 1,
        dueDate: '2026-01-01',
        principalDue: '800.00',
        principalPaid: '0.00',
        interestDue: '100.00',
        interestPaid: '0.00',
        penaltyDue: '50.00',
        penaltyPaid: '0.00',
        feesDue: '20.00',
        feesPaid: '0.00',
      },
    ];

    it('allocates partial payment strictly following PENALTY -> FEES -> INTEREST -> PRINCIPAL', () => {
      // Total due is 50 (penalty) + 20 (fees) + 100 (interest) + 800 (principal) = $970.00
      // Customer pays $100.00:
      // Penalty: $50 (paid in full)
      // Fees: $20 (paid in full)
      // Interest: $30 (partially paid, $70 left)
      // Principal: $0 ($800 left)
      const res = allocatePaymentWaterfall(100, mockPendingItems, 'PENALTY_FEES_INTEREST_PRINCIPAL');

      expect(res.penaltyComponent).toBe('50.00');
      expect(res.feesComponent).toBe('20.00');
      expect(res.interestComponent).toBe('30.00');
      expect(res.principalComponent).toBe('0.00');
      expect(res.excessAmount).toBe('0.00');
      expect(res.allocations[0].status).toBe('PARTIALLY_PAID');
      expect(res.allocations[0].remainingInterestDue).toBe('70.00');
      expect(res.allocations[0].remainingPrincipalDue).toBe('800.00');
    });

    it('handles overpayment and tracks excess credit', () => {
      const res = allocatePaymentWaterfall(1000, mockPendingItems, 'PENALTY_FEES_INTEREST_PRINCIPAL');
      // 970 allocated, 30 excess
      expect(res.totalAllocated).toBe('970.00');
      expect(res.excessAmount).toBe('30.00');
      expect(res.allocations[0].status).toBe('PAID');
      expect(res.allocations[0].remainingTotalDue).toBe('0.00');
    });
  });

  describe('Late Penalties', () => {
    it('applies grace period correctly: zero penalty during grace period', () => {
      const res = calculateLatePenalty({
        overdueAmount: 1000,
        daysOverdue: 3,
        gracePeriodDays: 5,
        penaltyType: 'PERCENTAGE',
        penaltyValue: 5,
      });

      expect(res.calculatedPenalty).toBe('0.00');
      expect(res.isGracePeriodApplied).toBe(true);
    });

    it('calculates daily percentage penalty past grace period', () => {
      const res = calculateLatePenalty({
        overdueAmount: 1000,
        daysOverdue: 15,
        gracePeriodDays: 5,
        penaltyType: 'DAILY_PERCENTAGE',
        penaltyValue: 0.1, // 0.1% per day
      });

      // Chargeable days = 15 - 5 = 10 days
      // 1000 * 0.001 * 10 = $10.00
      expect(res.chargeableDays).toBe(10);
      expect(res.calculatedPenalty).toBe('10.00');
    });
  });

  describe('Prepayment & Foreclosure Quote', () => {
    it('generates exact settlement quote with 2% prepayment fee', () => {
      const quote = calculateForeclosureQuote({
        outstandingPrincipal: 20000,
        outstandingInterest: 200,
        accruedInterestSinceLastPayment: 50,
        outstandingPenalty: 30,
        outstandingFees: 10,
        prepaymentPenaltyRate: 2, // 2% of 20000 = 400
      });

      // 20000 + 200 + 50 + 30 + 10 + 400 = 20690
      expect(quote.prepaymentPenaltyCharge).toBe('400.00');
      expect(quote.finalSettlementAmount).toBe('20690.00');
    });
  });

  describe('Loan Restructuring', () => {
    it('generates version 2 schedule for remaining balance', () => {
      const result = restructureLoanSchedule({
        remainingPrincipal: 15000,
        newAnnualInterestRate: 10,
        newCalculationMethod: 'EMI_REDUCING',
        newPaymentFrequency: 'MONTHLY',
        newRemainingInstallments: 24,
        newFirstPaymentDate: '2026-06-01',
        reasonForRestructure: 'Customer requested tenure extension',
        previousScheduleVersion: 1,
      });

      expect(result.newVersionNumber).toBe(2);
      expect(result.newSchedule.items.length).toBe(24);
      expect(result.newSchedule.principalAmount).toBe('15000.00');
      expect(result.newSchedule.items[23].closingPrincipal).toBe('0.00');
    });
  });
});
