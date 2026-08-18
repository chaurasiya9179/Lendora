import React from 'react';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  switch (normalized) {
    case 'ACTIVE':
    case 'DISBURSED':
    case 'VERIFIED':
    case 'PAID':
    case 'RESOLVED':
      colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      break;

    case 'PARTIALLY_PAID':
    case 'PROMISE_TO_PAY':
    case 'IN_PROGRESS':
    case 'CONTACTED':
      colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      break;

    case 'DUE_TODAY':
    case 'UPCOMING':
    case 'PENDING':
      colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      break;

    case 'OVERDUE':
    case 'DEFAULTED':
    case 'REJECTED':
    case 'BLACKLISTED':
    case 'URGENT':
      colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      break;

    case 'CLOSED':
    case 'WAIVED':
    case 'INACTIVE':
      colorClasses = 'bg-slate-700/40 text-slate-400 border-slate-600/40';
      break;

    case 'RESTRUCTURED':
      colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses} tracking-wide`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
