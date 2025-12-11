import { supabase } from '@mobile/lib/supabaseClient';
import type { UserProfile } from '@mobile/types/profile';
import type { DocumentTypeId } from '@mobile/constants/documentTypes';
import type { DocumentItem } from '@mobile/types/document';

const DOCUMENT_BUCKET = 'supplier_documents';

const sanitizeFileName = (value?: string | null) => {
  if (!value) {
    return 'documento.pdf';
  }
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'documento.pdf';
};

export const uploadSupplierDocumentWeb = async (
  profile: UserProfile,
  file: File,
  typeId: DocumentTypeId | 'extra'
): Promise<{ path: string; publicUrl: string; recordId?: string }> => {
  if (!profile?.id) {
    throw new Error('Perfil inválido para upload.');
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUserId = authData.user?.id;
  if (!authUserId) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const finalName = sanitizeFileName(file.name);
  const normalizedType = (typeId ?? 'extra').toLowerCase() as DocumentTypeId | 'extra';
  const isExtra = normalizedType === 'extra';

  let existingDoc: { id?: string; storage_path?: string; name?: string } | null = null;
  if (!isExtra) {
    const { data: existing } = await supabase
      .from('documents')
      .select('id, storage_path, name')
      .eq('owner_profile_id', profile.id)
      .eq('type_id', normalizedType)
      .maybeSingle();
    existingDoc = existing;
  }

  const targetPath = `${authUserId}/${Date.now()}-${finalName}`;
  const buffer = await file.arrayBuffer();
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(targetPath, buffer, { contentType: file.type || 'application/pdf', upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const resolvedPath = uploadData?.path ?? targetPath;
  const { data: publicUrlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(resolvedPath);
  const publicUrl = publicUrlData.publicUrl;

  let recordId: string | undefined;
  if (isExtra) {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        type_id: normalizedType,
        name: file.name ?? finalName,
        owner_profile_id: profile.id,
        status: 'uploaded',
        storage_path: resolvedPath
      })
      .select('id')
      .single();
    if (error) throw error;
    recordId = data?.id;
  } else if (existingDoc?.id) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        name: existingDoc.name ?? file.name ?? finalName,
        status: 'uploaded',
        storage_path: resolvedPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingDoc.id)
      .select('id')
      .single();
    if (error) throw error;
    recordId = data?.id;
  } else {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        type_id: normalizedType,
        name: file.name ?? finalName,
        owner_profile_id: profile.id,
        status: 'uploaded',
        storage_path: resolvedPath
      })
      .select('id')
      .single();
    if (error) throw error;
    recordId = data?.id;
  }

  if (!isExtra && existingDoc?.storage_path && existingDoc.storage_path !== resolvedPath) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([existingDoc.storage_path]).catch(() => undefined);
  }

  return { path: resolvedPath, publicUrl, recordId };
};

export type UploadResult = Awaited<ReturnType<typeof uploadSupplierDocumentWeb>>;

export const getDocumentLabel = (typeId: string) => {
  const map: Record<string, string> = {
    dcf: 'DCF',
    dae: 'DAE (Taxa Florestal e Expediente)',
    dae_receipt: 'Comprovante pagamento DAE',
    car: 'CAR',
    mapa: 'MAPA',
    deed: 'Escritura do imóvel',
    lease: 'Contrato de arrendamento'
  };
  return map[typeId] ?? typeId.toUpperCase();
};

type DocumentRecord = {
  id: string;
  type_id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  updated_at?: string | null;
  storage_path?: string | null;
  owner_profile_id?: string | null;
  owner?: {
    id?: string | null;
    email?: string | null;
    company?: string | null;
    contact?: string | null;
    location?: string | null;
  } | null;
};

const mapSharedDocument = (record: DocumentRecord): DocumentItem => {
  const storagePath = record.storage_path ?? (record as any)?.document_storage_path ?? (record as any)?.storage_path;
  const { data: urlData } = storagePath
    ? supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(storagePath)
    : { data: { publicUrl: undefined } as any };

  const normalizedTypeId = record.type_id ? String(record.type_id).trim().toLowerCase() : '';

  return {
    id: record.id,
    typeId: normalizedTypeId,
    title: getDocumentLabel(normalizedTypeId),
    description: record.description ?? undefined,
    status: (record.status as DocumentItem['status']) ?? 'shared',
    updatedAt: record.updated_at ?? undefined,
    url: urlData?.publicUrl ?? undefined,
    path: storagePath ?? undefined,
    supplierId: record.owner?.id ?? record.owner_profile_id ?? undefined,
    supplierName: record.owner?.company ?? record.owner?.email ?? undefined,
    supplierLocation: record.owner?.location ?? undefined
  };
};

export const fetchOwnedDocuments = async (profileId: string): Promise<DocumentItem[]> => {
  const { data, error } = await supabase
    .from('documents')
    .select('id, type_id, name, description, status, updated_at, storage_path')
    .eq('owner_profile_id', profileId);

  if (error || !data) {
    console.warn('[Supabase] fetchOwnedDocuments failed', error);
    return [];
  }

  return (data as any[]).map(record => {
    const storagePath = record.storage_path ?? (record as any)?.document_storage_path ?? (record as any)?.storage_path;
    const normalizedTypeId = record.type_id ? String(record.type_id).trim().toLowerCase() : '';
    const { data: urlData } = storagePath
      ? supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(storagePath)
      : { data: { publicUrl: undefined } as any };
    return {
      id: record.id,
      typeId: normalizedTypeId,
      title: record.name,
      description: record.description ?? undefined,
      status: (record.status as DocumentItem['status']) ?? 'uploaded',
      updatedAt: record.updated_at ?? undefined,
      url: urlData?.publicUrl ?? undefined,
      path: storagePath ?? undefined
    } as DocumentItem;
  });
};

export const shareDocumentWithProfiles = async (documentId: string, targetProfileIds: string[]) => {
  const tasks = targetProfileIds.map(targetId =>
    supabase.rpc('share_document', { p_document: documentId, p_target: targetId })
  );
  const results = await Promise.allSettled(tasks);
  const failures = results.filter(r => r.status === 'rejected' || ('value' in r && (r as any).value.error));
  if (failures.length > 0) {
    console.warn('[Supabase] shareDocumentWithProfiles failures', failures);
    throw new Error('Não foi possível compartilhar alguns documentos agora.');
  }
};

export const deleteSupplierDocument = async (profileId: string, document: DocumentItem) => {
  if (!profileId || !document) {
    throw new Error('Perfil ou documento inválido para exclusão.');
  }

  const isValidRecordId = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const hasValidId = document.id && isValidRecordId(document.id);
  if (!hasValidId) {
    return;
  }

  const { error: deleteError, data: deletedData } = await supabase
    .from('documents')
    .delete()
    .eq('id', document.id)
    .eq('owner_profile_id', profileId)
    .select();

  if (deleteError) {
    console.error('[deleteSupplierDocument] Erro ao deletar registro do banco:', deleteError);
    throw new Error(`Não foi possível remover o registro do documento: ${deleteError.message}`);
  }

  if (document.path) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([document.path]).catch(() => undefined);
  }
};

export const fetchDocumentsSharedWith = async (profileId: string): Promise<DocumentItem[]> => {
  const { data: shareRows, error: shareError } = await supabase
    .from('document_shares')
    .select('document_id')
    .eq('shared_with_profile_id', profileId)
    .is('revoked_at', null);

  if (shareError || !shareRows || shareRows.length === 0) {
    if (shareError) {
      console.warn('[Supabase] fetchDocumentsSharedWith shares failed', shareError);
    }
    return [];
  }

  const documentIds = Array.from(
    new Set(
      shareRows
        .map(row => (row as { document_id?: string | null }).document_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (!documentIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('documents')
    .select(
      'id, type_id, name, description, status, updated_at, storage_path, owner_profile_id, owner:owner_profile_id(id, email, company, contact, location)'
    )
    .in('id', documentIds);

  if (error || !data) {
    console.warn('[Supabase] fetchDocumentsSharedWith documents failed', error);
    return [];
  }

  return (data as DocumentRecord[]).map(mapSharedDocument);
};
