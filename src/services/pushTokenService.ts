import { Platform } from 'react-native';
import { supabase } from '../lib/supabaseClient';

type PushTokenRecord = {
  email: string;
  token: string;
  platform: string | null;
  updated_at?: string;
};

export const registerPushToken = async (email: string, token: string): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();
  const payload: PushTokenRecord = {
    email: normalizedEmail,
    token,
    platform: Platform.OS,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('push_tokens').upsert(payload, {
    onConflict: 'token'
  });

  if (error) {
    console.warn('[PushToken] upsert failed', error);
  }
};

export const fetchPushTokensByEmail = async (email: string): Promise<string[]> => {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('email', normalizedEmail);

  if (error || !data) {
    console.warn('[PushToken] fetch failed', error);
    return [];
  }

  return (data as Array<{ token: string }>).map(item => item.token).filter(Boolean);
};
