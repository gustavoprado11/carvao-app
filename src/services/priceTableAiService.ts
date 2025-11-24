import * as FileSystem from 'expo-file-system';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
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

  const response = await fetch(`${baseUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  const rawBody = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Não foi possível ler a tabela. Tente enviar um arquivo mais nítido.');
  }

  const payload = parsed as { error?: boolean; message?: string } & Partial<PriceTableAIResponse>;

  if (!response.ok || payload.error) {
    throw new Error(normalizeErrorMessage(payload.message));
  }

  return {
    paymentTerms: payload.paymentTerms,
    queueMode: payload.queueMode,
    ranges: payload.ranges ?? [],
    notes: payload.notes
  };
};
