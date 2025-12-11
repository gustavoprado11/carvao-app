'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, FileText, Home, MessageSquare, ShieldCheck, Table } from 'lucide-react';
import { SidebarNav, type NavItem } from '../../src/components/SidebarNav';
import { Topbar } from '../../src/components/Topbar';
import { useAuth } from '../../src/providers/AuthProvider';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut, refreshProfile, refreshing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !profile && !pathname?.includes('/portal/login')) {
      router.replace('/portal/login');
    }
  }, [loading, pathname, profile, router]);

  const navItems = useMemo(() => {
    const items: NavItem[] = [
      { label: 'Visão geral', href: '/portal', icon: Home, description: 'Resumo da conta' },
      { label: 'Tabelas', href: '/portal/tabelas', icon: Table, description: 'Preços e rotas' },
      { label: 'Documentos', href: '/portal/documentos', icon: FileText, description: 'Uploads e revisão' },
      { label: 'Conversas', href: '/portal/conversas', icon: MessageSquare, description: 'Mensagens e propostas' }
    ];

    if (profile?.type === 'admin') {
      items.push({
        label: 'Administração',
        href: '/portal/admin',
        icon: ShieldCheck,
        description: 'Aprovações e tabelas'
      });
    }

    return items;
  }, [profile?.type]);

  if (!profile && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  if (!profile) {
    return <>{children}</>;
  }

  const profileLabel =
    profile.type === 'steel' ? 'Siderúrgica' : profile.type === 'admin' ? 'Administrador' : 'Fornecedor';

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="mx-auto flex max-w-screen-2xl gap-6 px-6 py-8">
        <aside className="w-72 shrink-0 space-y-6">
          <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-inner shadow-white/70 ring-1 ring-white/70">
                <Image src="/icon-1024.png" alt="Carvão Connect" width={44} height={44} className="h-10 w-10 object-contain" priority />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-600">Carvão Connect</p>
                <p className="text-lg font-semibold text-ink-900">Portal Web</p>
              </div>
            </div>
            <SidebarNav items={navItems} />
          </div>
        </aside>
        <main className="flex-1 space-y-4 pb-12">
          <Topbar
            title="Carvão Connect"
            subtitle="Acesse as mesmas informações do app agora no navegador."
            userEmail={profile.email}
            profileLabel={profileLabel}
            onSignOut={() => signOut().then(() => router.replace('/portal/login'))}
            onRefresh={refreshProfile}
            refreshing={refreshing}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
