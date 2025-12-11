'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, UploadCloud, XCircle } from 'lucide-react';
import { Card } from '../../../src/components/Card';
import { StatusPill } from '../../../src/components/StatusPill';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/providers/AuthProvider';
import {
  deleteSupplierDocument,
  fetchDocumentsSharedWith,
  fetchOwnedDocuments,
  getDocumentLabel,
  uploadSupplierDocumentWeb
} from '../../../src/services/documentService';
import { DOCUMENT_REQUIREMENTS } from '@mobile/constants/documentTypes';
import type { DocumentItem } from '@mobile/types/document';

type UploadingState = {
  [typeId: string]: boolean;
};

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [ownedDocs, setOwnedDocs] = useState<DocumentItem[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState<UploadingState>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const isSupplier = profile?.type === 'supplier';

  const ownedMap = useMemo(() => {
    const map: Record<string, DocumentItem> = {};
    ownedDocs.forEach(doc => {
      map[doc.typeId] = doc;
    });
    return map;
  }, [ownedDocs]);

  useEffect(() => {
    const load = async () => {
      if (!profile) {
        return;
      }
      if (profile.id) {
        const docs = await fetchOwnedDocuments(profile.id);
        setOwnedDocs(docs);
      }
      if (profile.type !== 'supplier' && profile.id) {
        const shared = await fetchDocumentsSharedWith(profile.id);
        setSharedDocs(shared);
        const firstSupplier =
          shared.find(doc => doc.supplierId)?.supplierId ??
          shared.find(doc => doc.supplierEmail)?.supplierEmail ??
          null;
        setSelectedSupplierId(firstSupplier);
      }
    };
    void load();
  }, [profile]);

  const handleUpload = async (typeId: string, file: File) => {
    if (!profile) return;
    setError(null);
    setUploading(prev => ({ ...prev, [typeId]: true }));
    try {
      await uploadSupplierDocumentWeb(profile, file, typeId as any);
      if (profile.id) {
        const docs = await fetchOwnedDocuments(profile.id);
        setOwnedDocs(docs);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao enviar documento.';
      setError(message);
    } finally {
      setUploading(prev => ({ ...prev, [typeId]: false }));
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!profile?.id) return;
    await deleteSupplierDocument(profile.id, doc);
    const docs = await fetchOwnedDocuments(profile.id);
    setOwnedDocs(docs);
  };

  const renderSupplierCards = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      {DOCUMENT_REQUIREMENTS.map(requirement => {
        const doc = ownedMap[requirement.id];
        const status =
          doc?.status === 'uploaded'
            ? { label: 'Enviado', tone: 'success' as const }
            : { label: requirement.required ? 'Obrigatório' : 'Opcional', tone: requirement.required ? 'warning' as const : 'neutral' as const };

        return (
          <div key={requirement.id} className="rounded-2xl border border-slate-100 bg-white/70 p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-ink-900">{requirement.title}</p>
                <p className="text-xs text-ink-500">{requirement.description ?? 'Anexe o PDF atualizado.'}</p>
              </div>
              <StatusPill label={status.label} tone={status.tone} />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-brand-200 px-4 py-2 text-sm font-semibold text-brand-800 hover:border-brand-400">
                <UploadCloud className="h-4 w-4" />
                {uploading[requirement.id] ? 'Enviando...' : doc ? 'Substituir PDF' : 'Enviar PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleUpload(requirement.id, file);
                    }
                  }}
                />
              </label>
              {doc ? (
                <>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-ink-700"
                  >
                    <Download className="h-4 w-4" />
                    Abrir
                  </a>
                  <button
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(doc)}
                  >
                    Remover
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  const groupedShared = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        name: string;
        email: string;
        location?: string | null;
        docs: DocumentItem[];
      }
    > = {};

    sharedDocs.forEach(doc => {
      const key = doc.supplierId ?? doc.supplierEmail ?? doc.id;
      if (!key) {
        return;
      }
      const entry = map[key] ?? {
        id: key,
        name: doc.supplierName ?? 'Fornecedor',
        email: doc.supplierEmail ?? 'E-mail não informado',
        location: doc.supplierLocation,
        docs: []
      };
      entry.docs.push(doc);
      entry.name = doc.supplierName ?? entry.name;
      entry.email = doc.supplierEmail ?? entry.email;
      entry.location = doc.supplierLocation ?? entry.location;
      map[key] = entry;
    });
    return Object.values(map);
  }, [sharedDocs]);

  const selectedGroup = groupedShared.find(group => group.id === selectedSupplierId) ?? groupedShared[0];

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">{error}</div>
      ) : null}

      {isSupplier ? (
        <Card title="Documentos do fornecedor">
          <p className="mb-4 text-sm text-ink-600">
            Use os mesmos requisitos do app mobile para enviar e atualizar documentos. Os arquivos ficam disponíveis na nuvem e podem ser revisados pelos administradores.
          </p>
          {renderSupplierCards()}
        </Card>
      ) : null}

      {profile?.type !== 'supplier' ? (
        <Card title="Documentos compartilhados">
          {groupedShared.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhum documento compartilhado com este perfil.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                {groupedShared.map(group => {
                  const isActive = selectedGroup?.id === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedSupplierId(group.id)}
                      className={`flex h-full flex-col justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-brand-200 bg-white shadow-[0_16px_40px_rgba(12,60,158,0.12)]'
                          : 'border-slate-100 bg-white/70 hover:border-brand-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-ink-900">{group.name}</p>
                        <p className="text-xs text-ink-500 truncate">{group.email}</p>
                        <p className="text-xs text-ink-400">{group.location ?? 'Localização não informada'}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <StatusPill label={`${group.docs.length} doc(s)`} tone="info" />
                        <ArrowRight className="h-4 w-4 text-ink-300" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedGroup ? (
                <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-inner shadow-white/60">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{selectedGroup.name}</p>
                      <p className="text-xs text-ink-500">{selectedGroup.email}</p>
                    </div>
                    <StatusPill label="Compartilhado" tone="info" />
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {selectedGroup.docs.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{getDocumentLabel(doc.typeId)}</p>
                          <p className="text-xs text-ink-500">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('pt-BR') : '—'}</p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-ink-700"
                        >
                          <Download className="h-4 w-4" />
                          Abrir
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
