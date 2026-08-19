import { Customer, Loan, Payment } from '@lendora/shared-types';
import { formatCurrency, formatDate } from './formatters.js';

export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

export function openWhatsApp(phone: string, text: string): void {
  const targetPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  const url = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Generates and opens WhatsApp payment due reminder
 */
export function sendDueReminderWhatsApp(params: {
  customerName: string;
  phone?: string;
  loanAccountNumber: string;
  dueDate: string;
  dueAmount: string | number;
  principalDue?: string | number;
  interestDue?: string | number;
  upiId?: string;
  businessName?: string;
}): void {
  const bizName = params.businessName || 'Lendora Finance';
  const msg = 
`🙏 *नमस्ते ${params.customerName} ji,*

Aapke loan account ka bhugtan vivran:
📌 *Loan A/c:* ${params.loanAccountNumber}
📅 *Due Date:* ${formatDate(params.dueDate)}
💰 *Total Due Amount:* ${formatCurrency(params.dueAmount)}
${params.interestDue && Number(params.interestDue) > 0 ? `• Byaj (Interest): ${formatCurrency(params.interestDue)}\n` : ''}${params.principalDue && Number(params.principalDue) > 0 ? `• Mool (Principal): ${formatCurrency(params.principalDue)}\n` : ''}
Kripya samay par bhugtan karein.
${params.upiId ? `💳 *UPI ID for Payment:* \`${params.upiId}\`\n` : ''}
Dhanyawad,
*${bizName}*`;

  openWhatsApp(params.phone || '', msg);
}

/**
 * Generates and opens WhatsApp instant payment receipt
 */
export function sendPaymentReceiptWhatsApp(params: {
  customerName: string;
  phone?: string;
  receiptNumber: string;
  paymentAmount: string | number;
  paymentDate: string;
  paymentMethod: string;
  loanAccountNumber?: string;
  principalPaid?: string | number;
  interestPaid?: string | number;
  remainingPrincipal?: string | number;
  businessName?: string;
}): void {
  const bizName = params.businessName || 'Lendora Finance';
  const msg = 
`✅ *PAYMENT RECEIPT (PAVTII)* - *${bizName}*

Namaste ${params.customerName} ji, aapka bhugtan praapt ho gaya hai:

🧾 *Receipt No:* ${params.receiptNumber}
${params.loanAccountNumber ? `📌 *Loan A/c:* ${params.loanAccountNumber}\n` : ''}💵 *Amount Received:* ${formatCurrency(params.paymentAmount)}
${params.principalPaid && Number(params.principalPaid) > 0 ? `• Mool (Principal): ${formatCurrency(params.principalPaid)}\n` : ''}${params.interestPaid && Number(params.interestPaid) > 0 ? `• Byaj (Interest): ${formatCurrency(params.interestPaid)}\n` : ''}📅 *Payment Date:* ${formatDate(params.paymentDate)}
💳 *Payment Mode:* ${params.paymentMethod}
${params.remainingPrincipal !== undefined ? `⚖️ *Remaining Balance:* ${formatCurrency(params.remainingPrincipal)}\n` : ''}
Aapke samay par bhugtan ke liye dhanyawad! 🙏`;

  openWhatsApp(params.phone || '', msg);
}

/**
 * Generates and opens WhatsApp loan balance summary statement
 */
export function sendLoanSummaryWhatsApp(params: {
  customerName: string;
  phone?: string;
  loanAccountNumber: string;
  loanType: string;
  principalAmount: string | number;
  interestRate: string | number;
  calculationMethod: string;
  outstandingPrincipal: string | number;
  outstandingInterest?: string | number;
  totalPaid: string | number;
  businessName?: string;
}): void {
  const bizName = params.businessName || 'Lendora Finance';
  const isInterestOnly = params.calculationMethod === 'INTEREST_ONLY';

  const msg = 
`📋 *LOAN ACCOUNT SUMMARY* - *${bizName}*

Namaste ${params.customerName} ji,

📌 *Loan A/c:* ${params.loanAccountNumber}
🏷️ *Type:* ${params.loanType}
💰 *Total Principal Amount:* ${formatCurrency(params.principalAmount)}
📈 *Interest Rate:* ${params.interestRate}% ${isInterestOnly ? '(Sirf Byaj Har Mahine)' : 'p.a.'}
✅ *Total Amount Paid So Far:* ${formatCurrency(params.totalPaid)}
⚖️ *Current Outstanding Principal:* ${formatCurrency(params.outstandingPrincipal)}
${params.outstandingInterest && Number(params.outstandingInterest) > 0 ? `⏳ *Outstanding Interest:* ${formatCurrency(params.outstandingInterest)}\n` : ''}
Kisi bhi jaankari ke liye humse sampark karein.
Dhanyawad! 🙏`;

  openWhatsApp(params.phone || '', msg);
}
