import React from 'react';
import Image from 'next/image';
import { LogOut, RefreshCw } from 'lucide-react';
import { Button } from './Button';

type Props = {
  title: string;
  subtitle?: string;
  userEmail?: string;
  profileLabel?: string;
  onSignOut?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export const Topbar: React.FC<Props> = ({
  title,
  subtitle,
  userEmail,
  profileLabel,
  onSignOut,
  onRefresh,
  refreshing
}) => {
  return (
    <header className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-slate-200 backdrop-blur">
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-inner shadow-white/60 ring-1 ring-white/60">
            <Image src="/icon-1024.png" alt="Carvão Connect" width={36} height={36} className="h-8 w-8 object-contain" priority />
          </div>
          <span className="text-lg font-semibold text-ink-900">{title}</span>
          {profileLabel ? (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              {profileLabel}
            </span>
          ) : null}
        </div>
        {subtitle || userEmail ? (
          <div className="text-sm text-ink-500">
            {subtitle}
            {subtitle && userEmail ? <span className="dot-divider" /> : null}
            {userEmail ? <span>{userEmail}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {onRefresh ? (
          <Button variant="outline" onClick={onRefresh} loading={refreshing} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        ) : null}
        {onSignOut ? (
          <Button variant="ghost" onClick={onSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        ) : null}
      </div>
    </header>
  );
};
