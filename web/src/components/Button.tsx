import React from 'react';
import clsx from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  loading?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  loading,
  disabled,
  ...rest
}) => {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-brand-600 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-700 focus-visible:outline-brand-500',
    ghost: 'bg-transparent text-ink-700 hover:bg-white/60 hover:shadow focus-visible:outline-brand-500',
    outline:
      'border border-slate-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-800 focus-visible:outline-brand-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-500'
  };

  return (
    <button
      className={clsx(base, variants[variant], disabled || loading ? 'opacity-70 cursor-not-allowed' : '', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" /> : null}
      {children}
    </button>
  );
};
