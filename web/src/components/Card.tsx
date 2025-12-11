import React from 'react';
import clsx from 'clsx';

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  id?: string;
};

export const Card: React.FC<Props> = ({ children, className, title, actions, id }) => {
  return (
    <section
      id={id}
      className={clsx(
        'glass-panel rounded-2xl p-5 shadow-card transition hover:shadow-lg',
        className
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? <h3 className="text-base font-semibold text-ink-900">{title}</h3> : <div />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
};
