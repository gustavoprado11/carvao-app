'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileWarning, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Card } from '../../../src/components/Card';
import { StatusPill } from '../../../src/components/StatusPill';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/providers/AuthProvider';
import {
  fetchSteelProfilesByStatus,
  fetchSuppliersByDocumentStatus,
  updateProfileStatus,
  updateSupplierDocumentStatus
} from '@mobile/services/profileService';
import type { SupplierDocumentStatus, UserProfile } from '@mobile/types/profile';

export default function AdminPage() {
  const { profile } = useAuth();
  const [supplierStatus, setSupplierStatus] = useState<SupplierDocumentStatus>('pending');
  const [steelStatus, setSteelStatus] = useState<'pending' | 'approved'>('pending');
  const [supplierList, setSupplierList] = useState<UserProfile[]>([]);
  const [steelList, setSteelList] = useState<UserProfile[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingSteel, setLoadingSteel] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.type !== 'admin') return;
    setLoadingSuppliers(true);
    fetchSuppliersByDocumentStatus(supplierStatus)
      .then(setSupplierList)
      .finally(() => setLoadingSuppliers(false));
  }, [profile?.type, supplierStatus]);

  useEffect(() => {
    if (profile?.type !== 'admin') return;
    setLoadingSteel(true);
    fetchSteelProfilesByStatus(steelStatus)
      .then(setSteelList)
      .finally(() => setLoadingSteel(false));
  }, [profile?.type, steelStatus]);

  if (profile?.type !== 'admin') {
    return <p className="text-sm text-ink-500">Acesso restrito a administradores.</p>;
  }

  const supplierStatusOptions: SupplierDocumentStatus[] = ['pending', 'approved', 'rejected', 'missing'];

  const renderSupplierCard = (item: UserProfile) => {
    const label =
      item.documentStatus === 'approved'
        ? { label: 'Aprovado', tone: 'success' as const }
        : item.documentStatus === 'rejected'
        ? { label: 'Reprovado', tone: 'warning' as const }
        : { label: 'Pendente', tone: 'info' as const };

    return (
      <div key={item.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-ink-900">{item.company ?? item.email}</p>
            <p className="text-xs text-ink-500">{item.contact}</p>
          </div>
          <StatusPill label={label.label} tone={label.tone} />
        </div>
        <p className="text-xs text-ink-500">{item.location}</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            disabled={actionId === item.id}
            loading={actionId === item.id}
            onClick={async () => {
              if (!item.id) return;
              setActionId(item.id);
              const updated = await updateSupplierDocumentStatus(item.id, 'approved', null, profile.email);
              if (updated) {
                setSupplierList(prev => prev.filter(p => p.id !== item.id));
              }
              setActionId(null);
            }}
            className="gap-2"
          >
            <ThumbsUp className="h-4 w-4" />
            Aprovar
          </Button>
          <Button
            variant="ghost"
            disabled={actionId === item.id}
            onClick={async () => {
              if (!item.id) return;
              setActionId(item.id);
              const updated = await updateSupplierDocumentStatus(
                item.id,
                'rejected',
                'Documento reprovado via portal web.',
                profile.email
              );
              if (updated) {
                setSupplierList(prev => prev.filter(p => p.id !== item.id));
              }
              setActionId(null);
            }}
            className="gap-2 text-red-600"
          >
            <ThumbsDown className="h-4 w-4" />
            Reprovar
          </Button>
        </div>
      </div>
    );
  };

  const renderSteelCard = (item: UserProfile) => {
    const approved = item.status === 'approved';
    return (
      <div key={item.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-ink-900">{item.company ?? item.email}</p>
            <p className="text-xs text-ink-500">{item.contact}</p>
          </div>
          <StatusPill label={approved ? 'Aprovada' : 'Pendente'} tone={approved ? 'success' : 'warning'} />
        </div>
        <p className="text-xs text-ink-500">{item.location}</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            disabled={actionId === item.id}
            loading={actionId === item.id}
            onClick={async () => {
              if (!item.id) return;
              setActionId(item.id);
              const updated = await updateProfileStatus(item.id, approved ? 'pending' : 'approved');
              if (updated) {
                setSteelList(prev => prev.filter(p => p.id !== item.id));
              }
              setActionId(null);
            }}
            className="gap-2"
          >
            {approved ? (
              <>
                <ThumbsDown className="h-4 w-4" />
                Desaprovar
              </>
            ) : (
              <>
                <ThumbsUp className="h-4 w-4" />
                Aprovar
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card
        title="Aprovação de fornecedores"
        actions={
          <div className="flex items-center gap-2">
            {supplierStatusOptions.map(status => (
              <button
                key={status}
                onClick={() => setSupplierStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  supplierStatus === status ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-ink-600'
                }`}
              >
                {status}
              </button>
            ))}
            <Button variant="ghost" onClick={() => setSupplierStatus('pending')} className="p-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {loadingSuppliers ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-500">
            Carregando fornecedores...
          </div>
        ) : supplierList.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhum fornecedor encontrado neste status.</p>
        ) : (
          <div className="space-y-3">{supplierList.map(renderSupplierCard)}</div>
        )}
      </Card>

      <Card
        title="Aprovação de siderúrgicas"
        actions={
          <div className="flex items-center gap-2">
            {(['pending', 'approved'] as const).map(status => (
              <button
                key={status}
                onClick={() => setSteelStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  steelStatus === status ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-ink-600'
                }`}
              >
                {status === 'pending' ? 'Pendentes' : 'Aprovadas'}
              </button>
            ))}
            <Button variant="ghost" onClick={() => setSteelStatus('pending')} className="p-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {loadingSteel ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-500">Carregando...</div>
        ) : steelList.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma siderúrgica neste status.</p>
        ) : (
          <div className="space-y-3">{steelList.map(renderSteelCard)}</div>
        )}
      </Card>
    </div>
  );
}
