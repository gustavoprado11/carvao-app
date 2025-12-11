import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export const SidebarNav: React.FC<{ items: NavItem[] }> = ({ items }) => {
  const pathname = usePathname();
  return (
    <nav className="space-y-2">
      {items.map(item => {
        const active = pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
              active
                ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                : 'text-ink-700 hover:bg-white hover:text-brand-800 hover:shadow-sm'
            )}
          >
            <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', active ? 'bg-white shadow' : 'bg-white/70')}>
              <Icon className={clsx('h-4 w-4', active ? 'text-brand-700' : 'text-ink-700')} />
            </span>
            <span className="flex flex-col">
              {item.label}
              {item.description ? <span className="text-xs font-normal text-ink-500">{item.description}</span> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
