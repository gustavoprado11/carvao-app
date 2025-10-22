import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types/profile';

type ProfileRecord = {
  id: string;
  email: string;
  type: string;
  company?: string | null;
  contact?: string | null;
  created_at?: string;
  updated_at?: string;
};

const TABLE_NAME = 'profiles';

const toDomainProfile = (record: ProfileRecord): UserProfile => ({
  id: record.id,
  email: record.email,
  type: (record.type as UserProfile['type']) ?? 'supplier',
  company: record.company ?? undefined,
  contact: record.contact ?? undefined
});

export const fetchProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, email, type, company, contact')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] fetchProfileByEmail failed', error);
    return null;
  }

  const record = (data ?? null) as ProfileRecord | null;
  return record ? toDomainProfile(record) : null;
};

export const upsertProfile = async (profile: UserProfile): Promise<UserProfile | null> => {
  const payload = {
    id: profile.id,
    email: profile.email.toLowerCase(),
    type: profile.type,
    company: profile.company ?? null,
    contact: profile.contact ?? null
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'email' })
    .select('id, email, type, company, contact')
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] upsertProfile failed', error);
    return null;
  }

  const record = (data ?? null) as ProfileRecord | null;
  return record ? toDomainProfile(record) : { ...profile, id: profile.id ?? undefined };
};
