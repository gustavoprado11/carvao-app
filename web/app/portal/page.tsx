'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, MessageSquare, ShieldCheck, Table } from 'lucide-react';
import { useAuth } from '../../src/providers/AuthProvider';
import { fetchSupplierTables, fetchSteelTableByOwner } from '@mobile/services/tableService';
import { fetchOwnedDocuments, fetchDocumentsSharedWith } from '../../src/services/documentService';
import { fetchConversationsByProfile } from '../../src/services/conversationService';
import { fetchSuppliersByDocumentStatus, fetchSteelProfilesByStatus } from '@mobile/services/profileService';
import type { ConversationPreview } from '@mobile/types/conversation';
import type { PricingTable } from '@mobile/services/tableService';
import type { DocumentItem } from '@mobile/types/document';

type DashboardState = {
  tables: PricingTable[];
  documents: DocumentItem[];
  sharedDocuments: DocumentItem[];
  conversations: ConversationPreview[];
  pendingSuppliers: number;
  pendingSteel: number;
  loading: boolean;
};

const initialState: DashboardState = {
  tables: [],
  documents: [],
  sharedDocuments: [],
  conversations: [],
  pendingSuppliers: 0,
  pendingSteel: 0,
  loading: true
};

export default function PortalDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [state, setState] = useState<DashboardState>(initialState);
  const [activityTab, setActivityTab] = useState<'conversations' | 'documents'>('conversations');

  useEffect(() => {
    const load = async () => {
      if (!profile?.email) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const [tables, docs, sharedDocs, convs, pendingSupplierProfiles, pendingSteelProfiles] = await Promise.all([
        profile.type === 'steel'
          ? fetchSteelTableByOwner(profile.email).then(table => (table ? [table] : []))
          : fetchSupplierTables(),
        profile.id ? fetchOwnedDocuments(profile.id) : Promise.resolve([]),
        profile.id ? fetchDocumentsSharedWith(profile.id) : Promise.resolve([]),
        fetchConversationsByProfile(profile.email, profile.type),
        profile.type === 'admin' ? fetchSuppliersByDocumentStatus('pending') : Promise.resolve([]),
        profile.type === 'admin' ? fetchSteelProfilesByStatus('pending') : Promise.resolve([])
      ]);

      setState({
        tables,
        documents: docs,
        sharedDocuments: sharedDocs,
        conversations: convs,
        pendingSuppliers: pendingSupplierProfiles.length,
        pendingSteel: pendingSteelProfiles.length,
        loading: false
      });
    };
    void load();
  }, [profile]);

  const documentStatusLabel = useMemo(() => {
    if (!profile) return null;
    if (profile.type !== 'supplier') return null;
    if (!profile.documentStatus || profile.documentStatus === 'missing') {
      return { label: 'Documentação pendente', tone: 'warning' as const };
    }
    if (profile.documentStatus === 'pending') {
      return { label: 'Aguardando revisão', tone: 'info' as const };
    }
    if (profile.documentStatus === 'rejected') {
      return { label: 'Precisa reenviar', tone: 'warning' as const };
    }
    return { label: 'Documentação aprovada', tone: 'success' as const };
  }, [profile]);

  const summary = [
    {
      title: 'Tabelas',
      value:
        profile?.type === 'steel'
          ? state.tables.length
            ? '1'
            : '0'
          : String(state.tables.length),
      caption: profile?.type === 'steel' ? 'Publicadas' : 'Disponíveis',
      icon: <Table className="h-7 w-7 text-brand-700" />,
      href: '/portal/tabelas'
    },
    {
      title: 'Documentos',
      value:
        profile?.type === 'supplier'
          ? String(state.documents.length)
          : String(state.sharedDocuments.length),
      caption: profile?.type === 'supplier' ? 'Enviados' : 'Recebidos',
      icon: <FileText className="h-7 w-7 text-brand-700" />,
      href: '/portal/documentos'
    },
    profile?.type === 'admin'
      ? {
          title: 'Aprovações',
          value: `${state.pendingSuppliers + state.pendingSteel}`,
          caption: 'Pendentes',
          icon: <ShieldCheck className="h-7 w-7 text-brand-700" />,
          href: '/portal/admin'
        }
      : {
          title: 'Conversas',
          value: String(state.conversations.length),
          caption: 'Em andamento',
          icon: <MessageSquare className="h-7 w-7 text-brand-700" />,
          href: '/portal/conversas'
        }
  ].filter(Boolean) as Array<{ title: string; value: string; caption: string; icon: React.ReactNode; href: string }>;

  const activityItems = useMemo(() => {
    const conversationItems = state.conversations.slice(0, 6).map(conv => ({
      id: conv.id,
      type: 'conversation' as const,
      title: profile?.type === 'supplier' ? conv.steelEmail : conv.supplierEmail,
      subtitle: conv.lastMessage || 'Sem mensagens ainda.',
      meta: new Date(conv.lastMessageAt).toLocaleString('pt-BR'),
      tone: 'info' as const,
      status: 'Chat'
    }));

    const documentsSource = profile?.type === 'supplier' ? state.documents : state.sharedDocuments;
    const documentItems = documentsSource.slice(0, 6).map(doc => ({
      id: doc.id,
      type: 'document' as const,
      title: doc.title,
      subtitle: doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('pt-BR') : 'Sem data',
      meta: doc.typeId?.toUpperCase?.() ?? 'Documento',
      tone:
        doc.status === 'uploaded' || doc.status === 'shared'
          ? 'success'
          : doc.status === 'pending'
          ? 'warning'
          : 'neutral',
      status:
        doc.status === 'uploaded' || doc.status === 'shared'
          ? 'Disponível'
          : doc.status === 'pending'
          ? 'Pendente'
          : doc.status === 'expired'
          ? 'Vencido'
          : doc.status === 'rejected'
          ? 'Revisar'
          : 'Em revisão'
    }));

    return {
      conversations: conversationItems,
      documents: documentItems
    };
  }, [profile?.type, state.conversations, state.documents, state.sharedDocuments]);

  const activeActivity =
    activityTab === 'conversations' ? activityItems.conversations : activityItems.documents;

  const renderStatusPill = (label: string, tone: 'success' | 'warning' | 'info' | 'neutral') => {
    const toneMap: Record<typeof tone, string> = {
      success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
      warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
      info: 'bg-brand-50 text-brand-800 ring-1 ring-brand-100',
      neutral: 'bg-slate-100 text-ink-700 ring-1 ring-slate-200'
    };
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneMap[tone]}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-400">Visão geral</p>
        <h1 className="text-2xl font-bold text-ink-900"></h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map(item => (
          <Link key={item.title} href={item.href} className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] ring-1 ring-white/80 transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-inner shadow-white/60">
                  {item.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{item.title}</span>
                  <span className="text-sm text-ink-500">{item.caption}</span>
                </div>
              </div>
              <div className="mt-6 flex items-baseline justify-between">
                <p className="text-4xl font-extrabold text-ink-900">{item.value}</p>
                <ArrowRight className="h-5 w-5 text-ink-300 group-hover:text-brand-600" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1.1fr]">
        <div className="rounded-3xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1">
              <button
                type="button"
                onClick={() => setActivityTab('conversations')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  activityTab === 'conversations'
                    ? 'bg-white shadow-sm ring-1 ring-slate-200'
                    : 'text-ink-500'
                }`}
              >
                Conversas
              </button>
              <button
                type="button"
                onClick={() => setActivityTab('documents')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  activityTab === 'documents'
                    ? 'bg-white shadow-sm ring-1 ring-slate-200'
                    : 'text-ink-500'
                }`}
              >
                Documentos
              </button>
            </div>
            <p className="text-sm font-semibold text-ink-500">Atividade Recente</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-inner shadow-white/60">
            {activeActivity.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500">Nada por aqui ainda.</p>
            ) : (
              <ul>
                {activeActivity.map((item, index) => {
                  const last = index === activeActivity.length - 1;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${last ? '' : 'border-b border-slate-100'}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink-900">{item.title}</span>
                        <span className="text-xs text-ink-500">{item.subtitle}</span>
                        <span className="text-[11px] text-ink-400">{item.meta}</span>
                      </div>
                      {renderStatusPill(item.status, item.tone)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-500">Perfil</p>
              <h3 className="text-lg font-bold text-ink-900">Conta e status</h3>
            </div>
            <button
              type="button"
              onClick={() => refreshProfile()}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:text-brand-800"
            >
              Atualizar perfil
            </button>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">E-mail</p>
                <p className="text-sm font-semibold text-ink-900">{profile?.email}</p>
              </div>
              {profile?.type === 'steel'
                ? renderStatusPill(
                    profile.status === 'approved' ? 'Acesso liberado' : 'Aguardando aprovação',
                    profile.status === 'approved' ? 'success' : 'warning'
                  )
                : profile?.type === 'supplier' && documentStatusLabel
                ? renderStatusPill(documentStatusLabel.label, documentStatusLabel.tone)
                : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 rounded-xl bg-white p-3 shadow-inner shadow-white/70 ring-1 ring-white/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Empresa</p>
                <p className="text-sm font-semibold text-ink-900">
                  {profile?.company || 'Preencha para liberar documentos.'}
                </p>
                <p className="text-xs text-ink-500">{profile?.location || 'Cidade / Estado'}</p>
              </div>
              <div className="space-y-1 rounded-xl bg-white p-3 shadow-inner shadow-white/70 ring-1 ring-white/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Perfil</p>
                <p className="text-sm font-semibold text-brand-800">
                  {profile?.type === 'steel'
                    ? 'Siderúrgica'
                    : profile?.type === 'admin'
                    ? 'Administrador'
                    : 'Fornecedor'}
                </p>
                {profile?.type === 'admin' ? (
                  <p className="text-xs text-ink-500">
                    {state.pendingSuppliers} fornecedores • {state.pendingSteel} siderúrgicas pendentes
                  </p>
                ) : (
                  <p className="text-xs text-ink-500">Sincronizado com o app</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
