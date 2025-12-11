'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Table as TableIcon, Trash2 } from 'lucide-react';
import { Card } from '../../../src/components/Card';
import { StatusPill } from '../../../src/components/StatusPill';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/providers/AuthProvider';
import {
  adminPersistSteelTable,
  fetchSteelTableByOwner,
  fetchSupplierTables,
  persistSteelTable
} from '@mobile/services/tableService';
import { fetchSteelProfilesByStatus } from '@mobile/services/profileService';
import type { PricingTable } from '@mobile/services/tableService';
import type { TableRow, ScheduleType } from '@mobile/types/table';

const defaultRows: TableRow[] = [
  { id: 'row-1', densityMin: '0', densityMax: '199,99', pricePF: '240', pricePJ: '260', unit: 'm3' },
  { id: 'row-2', densityMin: '200', densityMax: '219,99', pricePF: '270', pricePJ: '290', unit: 'm3' },
  { id: 'row-3', densityMin: '220', densityMax: '233', pricePF: '280', pricePJ: '300', unit: 'm3' },
  { id: 'row-4', densityMin: '233', densityMax: '500', pricePF: '1200', pricePJ: '1300', unit: 'tonelada' }
];

const emptyTable = (): PricingTable => ({
  id: '',
  company: '',
  route: '',
  location: '',
  ownerEmail: '',
  updatedAt: '',
  title: 'Tabela de Preços',
  description: 'Defina faixas de classificação e preços para fornecedores.',
  notes: 'Insira observações de umidade, documentação ou regras de entrega.',
  paymentTerms: '',
  scheduleType: 'agendamento',
  isActive: true,
  hasTable: false,
  rows: defaultRows.map(row => ({ ...row, id: crypto.randomUUID?.() ?? row.id }))
});

const cloneRow = (row: TableRow): TableRow => ({
  ...row,
  id: crypto.randomUUID?.() ?? `${row.id}-${Date.now()}`
});

export default function TablesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<PricingTable[]>([]);
  const [tableForm, setTableForm] = useState<PricingTable | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminOwnerEmail, setAdminOwnerEmail] = useState<string>('');
  const [steelOptions, setSteelOptions] = useState<{ email: string; label: string }[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!profile?.email) {
        setLoading(false);
        return;
      }

      if (profile.type === 'steel') {
        const table = await fetchSteelTableByOwner(profile.email);
        setTableForm(table ?? { ...emptyTable(), ownerEmail: profile.email, company: profile.company ?? '' });
        setTables(table ? [table] : []);
      } else {
        const supplierTables = await fetchSupplierTables();
        setTables(supplierTables);
      }

      if (profile.type === 'admin') {
        const approvedSteel = await fetchSteelProfilesByStatus('approved');
        setSteelOptions(
          approvedSteel.map(item => ({
            email: item.email,
            label: item.company ?? item.email
          }))
        );
      }

      setLoading(false);
    };
    void load();
  }, [profile]);

  useEffect(() => {
    if (profile?.type === 'admin' && adminOwnerEmail) {
      fetchSteelTableByOwner(adminOwnerEmail).then(table => {
        setTableForm(
          table ?? { ...emptyTable(), ownerEmail: adminOwnerEmail, company: profile?.company ?? '' }
        );
      });
    }
  }, [adminOwnerEmail, profile?.company, profile?.type]);

  const handleRowChange = (id: string, key: keyof TableRow, value: string) => {
    setTableForm(prev =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map(row => (row.id === id ? { ...row, [key]: value } : row))
          }
        : prev
    );
  };

  const handleAddRow = () => {
    setTableForm(prev =>
      prev
        ? {
            ...prev,
            rows: [...prev.rows, cloneRow({ id: crypto.randomUUID?.() ?? String(Date.now()), densityMin: '', densityMax: '', pricePF: '', pricePJ: '', unit: 'm3' })]
          }
        : prev
    );
  };

  const handleRemoveRow = (id: string) => {
    setTableForm(prev => (prev ? { ...prev, rows: prev.rows.filter(row => row.id !== id) } : prev));
  };

  const handleSave = async () => {
    if (!profile || !tableForm) {
      return;
    }
    setSaving(true);
    try {
      if (profile.type === 'steel') {
        const saved = await persistSteelTable(profile.email, tableForm, profile.company, profile.location);
        if (saved) {
          setTableForm(saved);
          setTables([saved]);
        }
      } else if (profile.type === 'admin' && adminOwnerEmail) {
        const saved = await adminPersistSteelTable(adminOwnerEmail, tableForm, tableForm.company, tableForm.location);
        if (saved) {
          setTableForm(saved);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const supplierView = profile?.type === 'supplier' || profile?.type === 'admin';

  const scheduleLabels: Record<ScheduleType, string> = {
    agendamento: 'Agendamento',
    fila: 'Fila'
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {supplierView ? (
        <Card title="Tabelas disponíveis">
          {tables.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhuma tabela publicada até o momento.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tables.map(table => (
                <div key={table.id} className="rounded-xl border border-slate-100 bg-white/70 p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-ink-900">{table.company ?? 'Siderúrgica parceira'}</p>
                      <p className="text-xs text-ink-500">{table.location ?? 'Localização não informada'}</p>
                    </div>
                    <StatusPill label={table.hasTable === false ? 'Aguardando' : table.isActive === false ? 'Inativa' : 'Ativa'} tone={table.isActive === false ? 'warning' : table.hasTable === false ? 'neutral' : 'success'} />
                  </div>
                  <p className="text-sm text-ink-600">{table.notes || 'Sem observações adicionais.'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-500">
                    <span>Pagamento: {table.paymentTerms || '—'}</span>
                    <span>Agendamento: {table.scheduleType ? scheduleLabels[table.scheduleType] : '—'}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" onClick={() => router.push('/portal/conversas')}>
                      Conversar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {profile?.type === 'steel' || profile?.type === 'admin' ? (
        <Card
          title={profile?.type === 'admin' ? 'Editar tabela de siderúrgica' : 'Sua tabela de preços'}
          actions={
            <Button onClick={handleSave} loading={saving} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar tabela
            </Button>
          }
        >
          {profile?.type === 'admin' ? (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm font-semibold text-ink-700">
                Siderúrgica
                <select
                  value={adminOwnerEmail}
                  onChange={e => setAdminOwnerEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none ring-brand-200 transition focus:ring-2"
                >
                  <option value="">Selecione</option>
                  {steelOptions.map(item => (
                    <option key={item.email} value={item.email}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2">
                <p className="text-xs text-ink-500">Escolha a siderúrgica para editar a tabela publicada.</p>
              </div>
            </div>
          ) : null}

          {tableForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="text-sm font-semibold text-ink-700">
                  Título
                  <input
                    value={tableForm.title}
                    onChange={e => setTableForm(prev => (prev ? { ...prev, title: e.target.value } : prev))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none ring-brand-200 transition focus:ring-2"
                  />
                </label>
                <label className="text-sm font-semibold text-ink-700">
                  Termos de pagamento
                  <input
                    value={tableForm.paymentTerms ?? ''}
                    onChange={e => setTableForm(prev => (prev ? { ...prev, paymentTerms: e.target.value } : prev))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none ring-brand-200 transition focus:ring-2"
                    placeholder="Ex: 30/60 dias"
                  />
                </label>
                <label className="text-sm font-semibold text-ink-700">
                  Agendamento
                  <select
                    value={tableForm.scheduleType ?? 'agendamento'}
                    onChange={e =>
                      setTableForm(prev => (prev ? { ...prev, scheduleType: e.target.value as ScheduleType } : prev))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none ring-brand-200 transition focus:ring-2"
                  >
                    <option value="agendamento">Agendamento</option>
                    <option value="fila">Fila</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-semibold text-ink-700">
                Observações
                <textarea
                  value={tableForm.notes}
                  onChange={e => setTableForm(prev => (prev ? { ...prev, notes: e.target.value } : prev))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none ring-brand-200 transition focus:ring-2"
                  rows={3}
                />
              </label>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="active"
                    type="checkbox"
                    checked={tableForm.isActive ?? true}
                    onChange={e => setTableForm(prev => (prev ? { ...prev, isActive: e.target.checked } : prev))}
                  />
                  <label htmlFor="active" className="text-sm font-semibold text-ink-700">
                    Tabela ativa para fornecedores
                  </label>
                </div>
                <div className="text-xs text-ink-500">
                  Última atualização:{' '}
                  {tableForm.updatedAt ? new Date(tableForm.updatedAt).toLocaleString('pt-BR') : '—'}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <span>Densidade mín.</span>
                  <span>Densidade máx.</span>
                  <span>Preço PF</span>
                  <span>Preço PJ</span>
                  <span>Unidade</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-100">
                  {tableForm.rows.map(row => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] items-center gap-2 px-4 py-2">
                      <input
                        value={row.densityMin}
                        onChange={e => handleRowChange(row.id, 'densityMin', e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={row.densityMax}
                        onChange={e => handleRowChange(row.id, 'densityMax', e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={row.pricePF}
                        onChange={e => handleRowChange(row.id, 'pricePF', e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={row.pricePJ}
                        onChange={e => handleRowChange(row.id, 'pricePJ', e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <select
                        value={row.unit}
                        onChange={e => handleRowChange(row.id, 'unit', e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="m3">m³</option>
                        <option value="tonelada">Tonelada</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-red-500 transition hover:text-red-700"
                        aria-label="Remover linha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="button" variant="outline" onClick={handleAddRow} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar faixa
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-500">Selecione uma siderúrgica para editar ou carregue sua tabela.</p>
          )}
        </Card>
      ) : null}

      {!supplierView && !tableForm ? (
        <Card title="Nenhuma tabela encontrada">
          <p className="text-sm text-ink-500">Publique a primeira tabela para disponibilizar preços aos fornecedores.</p>
        </Card>
      ) : null}
    </div>
  );
}
