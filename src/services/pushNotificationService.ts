import { fetchPushTokensByEmail } from './pushTokenService';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH = 100;

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const chunkTokens = (tokens: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size));
  }
  return chunks;
};

export const sendExpoPush = async (tokens: string[], message: PushMessage): Promise<void> => {
  if (!tokens || tokens.length === 0) {
    return;
  }

  const batches = chunkTokens(tokens, MAX_BATCH);

  for (const batch of batches) {
    try {
      const payload = batch.map(token => ({
        to: token,
        title: message.title,
        body: message.body,
        sound: 'default',
        data: message.data ?? {}
      }));

      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn('[Push] Expo push send failed', response.status, text);
      }
    } catch (error) {
      console.warn('[Push] Expo push send error', error);
    }
  }
};

/**
 * Busca tokens do e-mail e envia push (retorna true se enviou para pelo menos 1 token)
 */
export const sendPushToEmail = async (email: string, message: PushMessage): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();
  const tokens = await fetchPushTokensByEmail(normalizedEmail);
  if (tokens.length === 0) {
    return false;
  }
  await sendExpoPush(tokens, message);
  return true;
};
