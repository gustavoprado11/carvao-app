import { supabase } from '../lib/supabaseClient';
import { ProfileStatus, ProfileType, UserProfile } from '../types/profile';

type ProfileRecord = {
  id: string;
  email: string;
  type: string;
  company?: string | null;
  contact?: string | null;
  location?: string | null;
  supply_audience?: string | null;
  average_density_kg?: string | null;
  average_volume_m3?: string | null;
  status?: string | null;
  document_status?: string | null;
  document_url?: string | null;
  document_storage_path?: string | null;
  document_uploaded_at?: string | null;
  document_reviewed_at?: string | null;
  document_reviewed_by?: string | null;
  document_review_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

const TABLE_NAME = 'profiles';

const toDomainProfile = (record: ProfileRecord): UserProfile => {
  const type = (record.type as UserProfile['type']) ?? 'supplier';
  const status = (record.status as ProfileStatus) ?? (type === 'steel' ? 'approved' : undefined);
  const documentStatus =
    (record.document_status as UserProfile['documentStatus']) ?? (type === 'supplier' ? 'missing' : undefined);

  return {
    id: record.id,
    email: record.email,
    type,
    company: record.company ?? undefined,
    contact: record.contact ?? undefined,
    location: record.location ?? undefined,
    supplyAudience: (record.supply_audience as UserProfile['supplyAudience']) ?? undefined,
    averageDensityKg: record.average_density_kg ?? undefined,
    averageMonthlyVolumeM3: record.average_volume_m3 ?? undefined,
    status,
    documentStatus,
    documentUrl: record.document_url ?? undefined,
    documentStoragePath: record.document_storage_path ?? undefined,
    documentUploadedAt: record.document_uploaded_at ?? undefined,
    documentReviewedAt: record.document_reviewed_at ?? undefined,
    documentReviewedBy: record.document_reviewed_by ?? undefined,
    documentReviewNotes: record.document_review_notes ?? undefined
  };
};

export const fetchProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status, document_status, document_url, document_storage_path, document_uploaded_at, document_reviewed_at, document_reviewed_by, document_review_notes'
    )
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
    contact: profile.contact ?? null,
    location: profile.location ?? null,
    supply_audience: profile.supplyAudience ?? null,
    average_density_kg: profile.averageDensityKg ?? null,
    average_volume_m3: profile.averageMonthlyVolumeM3 ?? null,
    status: profile.status ?? (profile.type === 'steel' ? 'pending' : 'approved'),
    document_status: profile.documentStatus ?? null,
    document_url: profile.documentUrl ?? null,
    document_storage_path: profile.documentStoragePath ?? null,
    document_uploaded_at: profile.documentUploadedAt ?? null,
    document_reviewed_at: profile.documentReviewedAt ?? null,
    document_reviewed_by: profile.documentReviewedBy ?? null,
    document_review_notes: profile.documentReviewNotes ?? null
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'email' })
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status, document_status, document_url, document_storage_path, document_uploaded_at, document_reviewed_at, document_reviewed_by, document_review_notes'
    )
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] upsertProfile failed', error);
    return null;
  }

  const record = (data ?? null) as ProfileRecord | null;
  return record ? toDomainProfile(record) : { ...profile, id: profile.id ?? undefined };
};

export const seedProfile = async (profile: UserProfile): Promise<UserProfile | null> => {
  if (!profile.id) {
    throw new Error('Perfil sem identificador para seed_profile.');
  }

  const { data, error } = await supabase.rpc('seed_profile', {
    p_id: profile.id,
    p_email: profile.email,
    p_type: profile.type,
    p_company: profile.company ?? null,
    p_contact: profile.contact ?? null,
    p_location: profile.location ?? null,
    p_supply_audience: profile.supplyAudience ?? null,
    p_average_density: profile.averageDensityKg ?? null,
    p_average_volume: profile.averageMonthlyVolumeM3 ?? null,
    p_status: profile.status ?? (profile.type === 'steel' ? 'pending' : 'approved'),
    p_document_status: profile.documentStatus ?? null,
    p_document_url: profile.documentUrl ?? null,
    p_document_storage_path: profile.documentStoragePath ?? null,
    p_document_uploaded_at: profile.documentUploadedAt ?? null,
    p_document_reviewed_at: profile.documentReviewedAt ?? null,
    p_document_reviewed_by: profile.documentReviewedBy ?? null,
    p_document_review_notes: profile.documentReviewNotes ?? null
  });

  if (error || !data) {
    console.warn('[Supabase] seed_profile RPC failed', error);
    return null;
  }

  const [record] = data as ProfileRecord[];
  return record ? toDomainProfile(record) : profile;
};

export const fetchProfilesByType = async (type: ProfileType): Promise<UserProfile[]> => {
  if (type === 'steel') {
    const { data, error } = await supabase.rpc('get_steel_profiles');
    if (!error && data) {
      return (data as ProfileRecord[]).map(toDomainProfile);
    }
    console.warn('[Supabase] get_steel_profiles RPC fallback', error);
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status, document_status, document_url, document_storage_path, document_uploaded_at, document_reviewed_at, document_reviewed_by, document_review_notes'
    )
    .eq('type', type);

  if (type === 'steel') {
    if (error || !data || data.length === 0) {
      console.warn('[Supabase] fetchProfilesByType direct query failed', error);
      return [];
    }
  }

  if (error || !data) {
    console.warn('[Supabase] fetchProfilesByType failed', error);
    return [];
  }

  return (data as ProfileRecord[]).map(toDomainProfile);
};

export const fetchSupplierProfilesByEmails = async (emails: string[]): Promise<UserProfile[]> => {
  const normalized = Array.from(
    new Set(
      emails
        .map(email => email?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (normalized.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_supplier_profiles', {
    emails: normalized
  });

  if (!error && data) {
    return (data as ProfileRecord[]).map(toDomainProfile);
  }

  console.warn('[Supabase] get_supplier_profiles RPC failed', error);

  const { data: fallbackData, error: fallbackError } = await supabase
    .from(TABLE_NAME)
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status'
    )
    .in('email', normalized);

  if (fallbackError || !fallbackData) {
    console.warn('[Supabase] fetchSupplierProfilesByEmails fallback failed', fallbackError);
    return [];
  }

  return (fallbackData as ProfileRecord[]).map(toDomainProfile);
};

export const fetchSteelProfilesByStatus = async (status: ProfileStatus): Promise<UserProfile[]> => {
  const { data, error } = await supabase.rpc('get_steel_profiles_by_status', {
    target_status: status
  });

  if (!error && data) {
    return (data as ProfileRecord[]).map(toDomainProfile);
  }

  console.warn('[Supabase] get_steel_profiles_by_status RPC fallback', error);

  const { data: tableData, error: tableError } = await supabase
    .from(TABLE_NAME)
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status, document_status, document_url, document_storage_path, document_uploaded_at, document_reviewed_at, document_reviewed_by, document_review_notes'
    )
    .eq('type', 'steel')
    .eq('status', status);

  if (tableError || !tableData) {
    console.warn('[Supabase] fetchSteelProfilesByStatus direct query failed', tableError);
    return [];
  }

  return (tableData as ProfileRecord[]).map(toDomainProfile);
};

export const updateProfileStatus = async (profileId: string, status: ProfileStatus): Promise<UserProfile | null> => {
  const { data, error } = await supabase.rpc('update_steel_status', {
    target_id: profileId,
    new_status: status
  });

  if (!error && data && Array.isArray(data) && data.length > 0) {
    const record = data[0] as ProfileRecord;
    return toDomainProfile(record);
  }

  if (error) {
    console.warn('[Supabase] update_steel_status RPC failed', error);
  }

  const { data: tableData, error: tableError } = await supabase
    .from(TABLE_NAME)
    .update({ status })
    .eq('id', profileId)
    .select(
      'id, email, type, company, contact, location, supply_audience, average_density_kg, average_volume_m3, status, document_status, document_url, document_storage_path, document_uploaded_at, document_reviewed_at, document_reviewed_by, document_review_notes'
    )
    .maybeSingle();

  if (tableError) {
    console.warn('[Supabase] updateProfileStatus direct update failed', tableError);
    return null;
  }

  const record = (tableData ?? null) as ProfileRecord | null;
  return record ? toDomainProfile(record) : null;
};
