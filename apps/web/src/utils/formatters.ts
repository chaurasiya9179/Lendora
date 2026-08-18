export function formatCurrency(
  amount: number | string | undefined | null,
  currencySymbol: string = '₹',
  precision: number = 2
): string {
  if (amount === undefined || amount === null || amount === '') return `${currencySymbol}0.00`;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
  if (isNaN(num)) return `${currencySymbol}0.00`;

  return `${currencySymbol}${num.toLocaleString('en-IN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatPercentage(rate: number | string | undefined | null): string {
  if (rate === undefined || rate === null) return '0.00%';
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(2)}%`;
}
