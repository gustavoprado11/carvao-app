// Using legacy API until migration to File/Directory classes is completed.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseClient';
import type { PriceTableAIResponse } from '../types/priceTableAI';

type UploadableFile = {
  uri: string;
  name: string;
  type: string;
};

const FUNCTION_NAME = 'price_table_extract_from_file';
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

const normalizeErrorMessage = (message?: unknown) =>
  typeof message === 'string'
    ? message
    : 'Não foi possível ler a tabela. Tente enviar um arquivo mais nítido.';

export const extractPriceTableFromFile = async (file: UploadableFile): Promise<PriceTableAIResponse> => {
  const fileInfo = await FileSystem.getInfoAsync(file.uri);
  if (!fileInfo.exists) {
    throw new Error('Arquivo não encontrado. Selecione outro arquivo e tente novamente.');
  }

  if (fileInfo.size && fileInfo.size > MAX_UPLOAD_SIZE) {
    throw new Error('Arquivo muito grande. Envie um arquivo de até 10MB.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const accessToken = sessionData.session.access_token;
  const baseUrl = SUPABASE_URL ?? '';
  if (!baseUrl) {
    throw new Error('Configuração inválida. Verifique as variáveis do Supabase.');
  }
  const formData = new FormData();

  // React Native usa objetos com uri/nome/tipo para multipart.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY ?? ''
      },
      body: formData
    });
  } catch (error) {
    console.warn('[PriceTableAI] Network request failed', error);
    throw new Error(
      'Não foi possível conectar para ler a tabela. Verifique sua internet e tente novamente em instantes.'
    );
  }

  const rawBody = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.warn('[PriceTableAI] Non-JSON response', {
      status: response.status,
      body: rawBody?.slice?.(0, 500) ?? '<empty>'
    });
    throw new Error('Não foi possível ler a tabela. Tente enviar um arquivo mais nítido.');
  }

  const payload = parsed as { error?: boolean; message?: string } & Partial<PriceTableAIResponse>;

  if (!response.ok || payload.error) {
    console.warn('[PriceTableAI] Function returned error', {
      status: response.status,
      payload: JSON.stringify(payload)?.slice(0, 500),
      body: rawBody?.slice?.(0, 500)
    });
    if (!payload.message) {
      // Server errored sem mensagem amigável, devolve fallback.
    }
    throw new Error(normalizeErrorMessage(payload.message));
  }

  return {
    paymentTerms: payload.paymentTerms,
    queueMode: payload.queueMode,
    ranges: payload.ranges ?? [],
    notes: payload.notes
  };
};
