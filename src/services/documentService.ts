import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types/profile';

const DOCUMENT_BUCKET = 'supplier_documents';

export type SupplierDocumentAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
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
): Promise<{ path: string; publicUrl: string } | null> => {
  if (!profile.id) {
    throw new Error('Perfil sem identificador para upload de DCF.');
  }
  if (!asset.uri) {
    throw new Error('Documento sem referência local para upload.');
  }

  const finalName = sanitizeFileName(asset.name);
  const targetPath = `${profile.id}/${Date.now()}-${finalName}`;

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

  return {
    path: resolvedPath,
    publicUrl
  };
};
