import React from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  tone?: 'success' | 'warning' | 'info' | 'neutral';
};

export const StatusPill: React.FC<Props> = ({ label, tone = 'neutral' }) => {
  const tones: Record<NonNullable<Props['tone']>, string> = {
    success: 'bg-green-50 text-green-700 ring-green-100',
    warning: 'bg-amber-50 text-amber-800 ring-amber-100',
    info: 'bg-brand-50 text-brand-800 ring-brand-100',
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200'
  };
  return (
    <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1', tones[tone])}>
      {label}
    </span>
  );
};
