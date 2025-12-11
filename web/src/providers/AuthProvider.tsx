'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { ProfileType, SupplyAudience, UserProfile } from '@mobile/types/profile';
import { fetchProfileByEmail, seedProfile, upsertProfile } from '@mobile/services/profileService';
import { syncSteelTableMetadata } from '@mobile/services/tableService';

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshing: boolean;
  signIn: (payload: { email: string; password: string; profileType: ProfileType }) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    profileType: Exclude<ProfileType, 'admin'>;
    company?: string;
    contact?: string;
    location?: string;
    supplyAudience?: SupplyAudience;
    averageDensityKg?: string;
    averageMonthlyVolumeM3?: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const mapAuthError = (raw: unknown): Error => {
  if (raw && typeof raw === 'object') {
    const message = String((raw as { message?: string }).message ?? '').toLowerCase();
    if (message.includes('invalid login credentials')) {
      return new Error('E-mail ou senha inválidos.');
    }
    if (message.includes('email not confirmed')) {
      return new Error('Confirme seu e-mail para continuar.');
    }
    if (message) {
      return new Error(String((raw as { message?: string }).message));
    }
  }
  return new Error('Não foi possível autenticar agora. Tente novamente.');
};

const normalizeProfileType = (value?: string | null): ProfileType | undefined => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'supplier') return 'supplier';
  if (lower === 'steel') return 'steel';
  if (lower === 'admin') return 'admin';
  return undefined;
};

const buildProfileLabel = (type: ProfileType) => {
  switch (type) {
    case 'steel':
      return 'Siderúrgica';
    case 'admin':
      return 'Administrador';
    default:
      return 'Fornecedor';
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const nextSession = data.session ?? null;
        setSession(nextSession);
        const email = nextSession?.user?.email?.toLowerCase();
        if (email) {
          const existing = await fetchProfileByEmail(email);
          if (existing) {
            setProfile(existing);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      if (nextSession?.user?.email) {
        fetchProfileByEmail(nextSession.user.email.toLowerCase())
          .then(existing => existing && setProfile(existing))
          .catch(error => console.warn('[Auth] Failed to sync profile after auth event', error));
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const syncProfileFromSession = useCallback(
    async (expectedType: ProfileType, draft?: Partial<UserProfile>) => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.email) {
        throw new Error('Não foi possível recuperar a sessão ativa.');
      }

      const email = data.user.email.toLowerCase();
      const userId = data.user.id;
      const metadataType = normalizeProfileType((data.user.user_metadata as any)?.profile_type);
      if (metadataType && metadataType !== expectedType) {
        await supabase.auth.signOut().catch(signOutError => console.warn('[Auth] signOut after mismatch', signOutError));
        throw new Error(
          `Este e-mail está cadastrado como ${buildProfileLabel(metadataType)}. Selecione o perfil correspondente para entrar.`
        );
      }

      const existingProfile = await fetchProfileByEmail(email);
      if (existingProfile) {
        if (existingProfile.type !== expectedType) {
          const profileLabel = buildProfileLabel(existingProfile.type);
          await supabase.auth.signOut().catch(signOutError => console.warn('[Auth] signOut after mismatch', signOutError));
          throw new Error(
            `Este e-mail está cadastrado como ${profileLabel}. Selecione o perfil correspondente para entrar.`
          );
        }

        const merged: UserProfile = {
          ...existingProfile,
          id: existingProfile.id ?? userId,
          company: draft?.company ?? existingProfile.company,
          contact: draft?.contact ?? existingProfile.contact,
          location: draft?.location ?? existingProfile.location,
          supplyAudience: draft?.supplyAudience ?? existingProfile.supplyAudience,
          averageDensityKg: draft?.averageDensityKg ?? existingProfile.averageDensityKg,
          averageMonthlyVolumeM3: draft?.averageMonthlyVolumeM3 ?? existingProfile.averageMonthlyVolumeM3,
          status: existingProfile.status ?? (existingProfile.type === 'steel' ? 'pending' : 'approved'),
          documentStatus: existingProfile.documentStatus
        };

        const saved = await upsertProfile({ ...merged, id: userId });
        setProfile(saved ?? merged);
        if (merged.type === 'steel') {
          void syncSteelTableMetadata(email, {
            company: merged.company ?? null,
            location: merged.location ?? null
          });
        }
        return saved ?? merged;
      }

      const fallback: UserProfile = {
        ...draft,
        id: userId,
        email,
        type: expectedType,
        status: expectedType === 'steel' ? 'pending' : 'approved',
        documentStatus: expectedType === 'supplier' ? 'missing' : undefined
      };

      const saved = await seedProfile(fallback);
      setProfile(saved ?? fallback);
      if (expectedType === 'steel') {
        void syncSteelTableMetadata(email, {
          company: fallback.company ?? null,
          location: fallback.location ?? null
        });
      }
      return saved ?? fallback;
    },
    []
  );

  const signIn = useCallback(
    async ({ email, password, profileType }: { email: string; password: string; profileType: ProfileType }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (error) {
        throw mapAuthError(error);
      }
      await supabase.auth.updateUser({ data: { profile_type: profileType } }).catch(err => {
        console.warn('[Auth] Failed to sync profile_type metadata', err);
      });
      await syncProfileFromSession(profileType);
    },
    [syncProfileFromSession]
  );

  const signUp = useCallback(
    async ({
      email,
      password,
      profileType,
      company,
      contact,
      location,
      supplyAudience,
      averageDensityKg,
      averageMonthlyVolumeM3
    }: {
      email: string;
      password: string;
      profileType: Exclude<ProfileType, 'admin'>;
      company?: string;
      contact?: string;
      location?: string;
      supplyAudience?: SupplyAudience;
      averageDensityKg?: string;
      averageMonthlyVolumeM3?: string;
    }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { profile_type: profileType }
        }
      });

      if (error) {
        throw mapAuthError(error);
      }

      const draft: UserProfile = {
        email: normalizedEmail,
        type: profileType,
        company: company?.trim() || undefined,
        contact: contact?.trim() || undefined,
        location: location?.trim() || undefined,
        supplyAudience: supplyAudience ?? undefined,
        averageDensityKg: averageDensityKg?.trim() || undefined,
        averageMonthlyVolumeM3: averageMonthlyVolumeM3?.trim() || undefined
      };

      if (data.session) {
        await syncProfileFromSession(profileType, draft);
        return { needsEmailConfirmation: false };
      }

      // Se a confirmação de e-mail estiver habilitada, o perfil será criado no primeiro login
      return { needsEmailConfirmation: true };
    },
    [syncProfileFromSession]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!profile?.email) {
      return null;
    }
    setRefreshing(true);
    try {
      const latest = await fetchProfileByEmail(profile.email);
      if (latest) {
        setProfile(latest);
      }
      return latest ?? profile;
    } finally {
      setRefreshing(false);
    }
  }, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      refreshing,
      signIn,
      signUp,
      signOut,
      refreshProfile
    }),
    [loading, profile, refreshing, session, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
};
