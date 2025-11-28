import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types/profile';
import { DocumentItem } from '../types/document';
import type { DocumentTypeId } from '../constants/documentTypes';

const DOCUMENT_BUCKET = 'supplier_documents';

// Mapeia typeId para o título padrão
const getStandardTitleFromTypeId = (typeId: string, fallbackName?: string): string => {
  const normalizedTypeId = typeId.toLowerCase().trim();
  const titleMap: Record<string, string> = {
    'dcf': 'DCF',
    'dae': 'DAE (Taxa Florestal e Expediente)',
    'dae_receipt': 'Comprovante pagamento DAE',
    'car': 'CAR',
    'mapa': 'MAPA',
    'deed': 'Escritura do imóvel',
    'lease': 'Contrato de arrendamento'
  };
  // Para documentos extras ou não mapeados, usa o fallbackName
  return titleMap[normalizedTypeId] || fallbackName || typeId;
};

export type SupplierDocumentAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  typeId?: DocumentTypeId | 'extra';
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const atobImpl =
    typeof globalThis.atob === 'function'
      ? globalThis.atob
      : (input: string) => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let str = input.replace(/=+$/, '');
          if (str.length % 4 === 1) {
            throw new Error('Sequência base64 inválida.');
          }
          let output = '';
          let bc = 0;
          let bs = 0;
          let buffer;
          for (let idx = 0; (buffer = str.charAt(idx++)); ) {
            const charIndex = chars.indexOf(buffer);
            if (~charIndex) {
              bs = bc % 4 ? bs * 64 + charIndex : charIndex;
              if (bc++ % 4) {
                output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
              }
            }
          }
          return output;
        };

  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = atobImpl(sanitized);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const sanitizeFileName = (value?: string | null) => {
  if (!value) {
    return 'dcf.pdf';
  }
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'dcf.pdf';
};

export const uploadSupplierDocument = async (
  profile: UserProfile,
  asset: SupplierDocumentAsset
): Promise<{ path: string; publicUrl: string; recordId?: string } | null> => {
  if (!profile.id) {
    throw new Error('Perfil sem identificador para upload de DCF.');
  }
  if (!asset.uri) {
    throw new Error('Documento sem referência local para upload.');
  }

  // Get authenticated user to use auth.uid() for storage path
  const { data: { user } } = await supabase.auth.getUser();

  const finalName = sanitizeFileName(asset.name);
  const typeId = (asset.typeId ?? 'extra').toLowerCase() as SupplierDocumentAsset['typeId'];
  const isExtraDoc = typeId === 'extra';

  // Para documentos não-extras, verifica se já existe um documento deste tipo para deletar o arquivo antigo do storage
  let existingDoc: { storage_path?: string } | null = null;
  if (!isExtraDoc) {
    const { data } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('owner_profile_id', profile.id)
      .eq('type_id', typeId)
      .single();
    existingDoc = data;
  }

  // Use auth.uid() instead of profile.id for storage path to match RLS policy
  // The storage policy checks if the first path segment equals auth.uid()
  const authUserId = user?.id;
  if (!authUserId) {
    throw new Error('Usuário não autenticado para upload de documento.');
  }
  const targetPath = `${authUserId}/${Date.now()}-${finalName}`;

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: 'base64'
  });
  const fileContents = base64ToUint8Array(base64);

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(targetPath, fileContents, {
      contentType: asset.mimeType ?? 'application/pdf',
      upsert: false
    });

  if (error) {
    console.warn('[Supabase] uploadSupplierDocument failed', error);
    return null;
  }

  const resolvedPath = data?.path ?? targetPath;
  const { data: publicUrlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(resolvedPath);
  const publicUrl = publicUrlData.publicUrl;

  // Cria/atualiza registro na tabela documents para rastrear status e compartilhamento.
  // Para documentos extras, sempre cria um novo registro (insert)
  // Para outros tipos, usa upsert para substituir documentos existentes do mesmo tipo
  let record: any;
  let recordError: any;

  if (isExtraDoc) {
    // Documentos extras: sempre insere novo registro
    const result = await supabase
      .from('documents')
      .insert({
        type_id: typeId,
        name: asset.name ?? finalName,
        owner_profile_id: profile.id,
        status: 'uploaded',
        storage_path: resolvedPath
      })
      .select('id')
      .single();
    record = result.data;
    recordError = result.error;
  } else {
    // Documentos padrão: primeiro tenta encontrar documento existente, depois faz upsert
    const { data: existing } = await supabase
      .from('documents')
      .select('id, name')
      .eq('owner_profile_id', profile.id)
      .eq('type_id', typeId)
      .maybeSingle();

    if (existing) {
      // Atualiza documento existente - PRESERVA o nome original se já existir
      const result = await supabase
        .from('documents')
        .update({
          name: existing.name, // Mantém o nome original do card
          status: 'uploaded',
          storage_path: resolvedPath,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      record = result.data;
      recordError = result.error;
    } else {
      // Cria novo documento - usa o nome do asset apenas se for a primeira vez
      const result = await supabase
        .from('documents')
        .insert({
          type_id: typeId,
          name: asset.name ?? finalName,
          owner_profile_id: profile.id,
          status: 'uploaded',
          storage_path: resolvedPath
        })
        .select('id')
        .single();
      record = result.data;
      recordError = result.error;
    }
  }

  if (recordError) {
    console.error('[Supabase] upsert/insert document failed', recordError);
    console.error('[Supabase] Document details - typeId:', typeId, 'isExtra:', isExtraDoc, 'profileId:', profile.id);
    // Não falha silenciosamente - lança erro para que o usuário saiba
    throw new Error(`Falha ao salvar documento: ${recordError.message || recordError}`);
  }

  // Se upload e upsert foram bem sucedidos, deleta o arquivo antigo do storage (apenas para documentos não-extras)
  if (!isExtraDoc && existingDoc?.storage_path && existingDoc.storage_path !== resolvedPath) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([existingDoc.storage_path]);
  }

  return {
    path: resolvedPath,
    publicUrl,
    recordId: (record as any)?.id
  };
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
    title: getStandardTitleFromTypeId(normalizedTypeId, record.name), // Usa título padrão ou nome para extras
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

  console.log('[deleteSupplierDocument] Iniciando exclusão:', {
    documentId: document.id,
    typeId: document.typeId,
    path: document.path,
    profileId
  });

  // Verifica se o ID é um UUID válido (não é um typeId usado como placeholder)
  const isValidRecordId = (id: string): boolean => {
    // UUID tem 36 caracteres com formato específico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const hasValidId = document.id && isValidRecordId(document.id);
  console.log('[deleteSupplierDocument] ID válido?', hasValidId, 'ID:', document.id);

  // Se não tem ID válido, não há nada para deletar do banco
  if (!hasValidId) {
    console.log('[deleteSupplierDocument] Documento não tem ID válido, não há registro no banco para deletar');
    return;
  }

  // Deleta o registro do banco de dados primeiro
  const { error: deleteError, data: deletedData } = await supabase
    .from('documents')
    .delete()
    .eq('id', document.id)
    .eq('owner_profile_id', profileId)
    .select(); // Retorna os registros deletados

  if (deleteError) {
    console.error('[deleteSupplierDocument] Erro ao deletar registro do banco:', deleteError);
    throw new Error(`Não foi possível remover o registro do documento: ${deleteError.message}`);
  }

  console.log('[deleteSupplierDocument] Registro deletado do banco:', deletedData);

  // Se a exclusão do banco foi bem sucedida, tenta deletar do storage
  if (document.path) {
    console.log('[deleteSupplierDocument] Deletando arquivo do storage:', document.path);
    const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([document.path]);
    if (removeError) {
      console.warn('[deleteSupplierDocument] Erro ao remover do storage (não crítico):', removeError);
      // Não lança erro aqui pois o registro já foi deletado do banco
    } else {
      console.log('[deleteSupplierDocument] Arquivo removido do storage com sucesso');
    }
  }

  console.log('[deleteSupplierDocument] Exclusão concluída com sucesso');
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
    .select('id, type_id, name, description, status, updated_at, storage_path, owner_profile_id, owner:owner_profile_id(id, email, company, contact, location)')
    .in('id', documentIds);

  if (error || !data) {
    console.warn('[Supabase] fetchDocumentsSharedWith documents failed', error);
    return [];
  }

  return (data as DocumentRecord[]).map(mapSharedDocument);
};

// Funções para gerenciar conexões persistentes entre fornecedor e siderúrgica
export const getActiveConnections = async (supplierProfileId: string): Promise<string[]> => {
  const { data, error } = await supabase.rpc('get_active_steel_connections', {
    p_supplier_profile_id: supplierProfileId
  });

  if (error) {
    console.warn('[Supabase] getActiveConnections failed', error);
    return [];
  }

  return (data ?? []).map((row: any) => row.steel_profile_id).filter(Boolean);
};

export const connectSupplierToSteel = async (supplierProfileId: string, steelProfileId: string) => {
  const { error } = await supabase.rpc('connect_supplier_to_steel', {
    p_supplier_profile_id: supplierProfileId,
    p_steel_profile_id: steelProfileId
  });

  if (error) {
    console.error('[Supabase] connectSupplierToSteel failed', error);
    throw new Error('Não foi possível criar a conexão.');
  }
};

export const disconnectSupplierFromSteel = async (supplierProfileId: string, steelProfileId: string) => {
  const { error } = await supabase.rpc('disconnect_supplier_from_steel', {
    p_supplier_profile_id: supplierProfileId,
    p_steel_profile_id: steelProfileId
  });

  if (error) {
    console.error('[Supabase] disconnectSupplierFromSteel failed', error);
    throw new Error('Não foi possível remover a conexão.');
  }
};
