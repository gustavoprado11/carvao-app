import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './screens/AuthScreen';
import { MainTabs } from './navigation/MainTabs';
import { AdminNavigator } from './navigation/AdminNavigator';
import { ProfileProvider } from './context/ProfileContext';
import { TableProvider } from './context/TableContext';
import { NotificationProvider } from './context/NotificationContext';
import { ConversationReadProvider } from './context/ConversationReadContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { EmailConfirmationScreen } from './screens/EmailConfirmationScreen';
import { colors, spacing } from './theme';
import { supabase } from './lib/supabaseClient';
import { AuthPayload } from './types/auth';
import { UserProfile } from './types/profile';
import { fetchProfileByEmail, seedProfile, upsertProfile } from './services/profileService';
import { syncSteelTableMetadata } from './services/tableService';
import { notifySteelSignup } from './services/adminNotificationService';
import { TextField } from './components/TextField';
import { PrimaryButton } from './components/PrimaryButton';
import { PendingApprovalScreen } from './screens/PendingApprovalScreen';
import { SupplierAccessGate } from './screens/SupplierAccessGate';
import { PushTokenRegistrar } from './components/PushTokenRegistrar';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border
  }
};

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(null);
  const [isPasswordResetVisible, setPasswordResetVisible] = useState(false);
  const [isCompletingPasswordReset, setCompletingPasswordReset] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [isProcessingSignup, setIsProcessingSignup] = useState(false);

  const getProfileLabel = (type: string) => {
    switch (type) {
      case 'steel':
        return 'Siderúrgica';
      case 'admin':
        return 'Administrador';
      default:
        return 'Fornecedor';
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session?.user?.email) {
          const email = session.user.email.toLowerCase();
          const existingProfile = await fetchProfileByEmail(email);
          if (existingProfile) {
            setProfile(existingProfile);
          }
        }
      } catch (error) {
        console.warn('[Auth] Failed to restore session', error);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, []);

  // Handle deep links for email confirmation
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('[App] Deep link received:', url);

      // Extra: process Supabase tokens if presentes (access_token/refresh_token)
      const parsed = Linking.parse(url);
      const accessToken = parsed.queryParams?.access_token;
      const refreshToken = parsed.queryParams?.refresh_token;
      if (typeof accessToken === 'string' && typeof refreshToken === 'string') {
        try {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          console.log('[App] Session restored from deep link');
        } catch (error) {
          console.warn('[App] Failed to set session from deep link', error);
        }
      }

      // Check if it's an email confirmation link
      if (url.includes('type=signup') || url.includes('email-confirmation')) {
        setShowEmailConfirmation(true);
      }
    };

    // Check initial URL on app launch
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          void handleDeepLink({ url });
        }
      })
      .catch(error => {
        console.warn('[App] Failed to get initial URL', error);
      });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth state changed:', event);

      if (event === 'PASSWORD_RECOVERY' && session?.user?.email) {
        setPasswordResetEmail(session.user.email.toLowerCase());
        setPasswordResetVisible(true);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setShowEmailConfirmation(false);
        return;
      }

      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user?.email
      ) {
        // Don't interfere with ongoing signup process
        if (isProcessingSignup) {
          console.log('[App] Ignoring auth state change during signup process');
          return;
        }

        try {
          const email = session.user.email.toLowerCase();
          console.log('[App] Auth state change: fetching profile for', email);
          const existingProfile = await fetchProfileByEmail(email);
          if (existingProfile) {
            console.log('[App] Auth state change: profile found, updating state');
            setProfile(existingProfile);
          } else {
            console.log('[App] Auth state change: no profile found yet');
          }
        } catch (error) {
          console.warn('[Auth] Failed to sync profile after auth event', error);
        }
      }
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, [isProcessingSignup]);

  useEffect(() => {
    if (!profile) {
      Notifications.setBadgeCountAsync(0).catch(error =>
        console.warn('[App] Failed to reset badge count when signed out', error)
      );
    }
  }, [profile]);

  const mapSignInError = (rawError: unknown): Error => {
    if (rawError && typeof rawError === 'object') {
      const message = String((rawError as { message?: string }).message ?? '').toLowerCase();

      if (message.includes('email not confirmed')) {
        return new Error('Conta ainda não foi confirmada. Verifique seu e-mail para liberar o acesso.');
      }

      if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
        return new Error('E-mail ou senha incorretos. Revise os dados e tente novamente.');
      }

      if (message) {
        return new Error(String((rawError as { message?: string }).message));
      }
    }

    return new Error('Não foi possível entrar. Tente novamente em instantes.');
  };

  const handleAuthComplete = async ({ mode, profile: draftProfile, password, otpVerified }: AuthPayload) => {
    console.log('[App] handleAuthComplete called:', { mode, email: draftProfile.email, otpVerified });
    const email = draftProfile.email.trim().toLowerCase();
    const normalizedProfile: UserProfile = {
      ...draftProfile,
      email
    };

    if (mode === 'signUp') {
      console.log('[App] Processing signup...');
      setIsProcessingSignup(true);

      try {
        if (!otpVerified) {
          throw new Error('Valide o código enviado por e-mail para concluir o cadastro.');
        }

        console.log('[App] Getting user from session...');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('[App] getUser failed:', userError);
          throw new Error('Não foi possível confirmar seu e-mail. Tente novamente.');
        }

        const user = userData.user;
        if (!user) {
          console.error('[App] No user found after getUser');
          throw new Error('Não encontramos sua conta após confirmar o código. Tente novamente.');
        }

        console.log('[App] User found:', { userId: user.id, email: user.email });
        const userId = user.id;
        const metadataType = (user.user_metadata as { profile_type?: string } | null)?.profile_type;
        console.log('[App] User metadata type:', metadataType);

        if (metadataType && metadataType !== normalizedProfile.type) {
          console.warn('[App] Metadata type mismatch:', { metadataType, expectedType: normalizedProfile.type });
          const profileLabel = getProfileLabel(metadataType);
          await supabase.auth.signOut().catch(signOutError =>
            console.warn('[Auth] signOut after metadata/profile type mismatch failed', signOutError)
          );
          throw new Error(
            `Este e-mail está cadastrado como ${profileLabel}. Selecione o perfil correspondente para entrar.`
          );
        }

        if (!metadataType || metadataType !== normalizedProfile.type) {
          console.log('[App] Updating user metadata to:', normalizedProfile.type);
          const { error: metadataError } = await supabase.auth.updateUser({
            data: { profile_type: normalizedProfile.type }
          });
          if (metadataError) {
            console.warn('[Auth] Failed to sync profile_type metadata after OTP signup', metadataError);
          } else {
            console.log('[App] User metadata updated successfully');
          }
        }

        console.log('[App] Fetching existing profile by email:', email);
        const existingProfile = await fetchProfileByEmail(email);
        console.log('[App] Existing profile:', existingProfile ? 'found' : 'not found');

        if (existingProfile) {
          if (existingProfile.type !== normalizedProfile.type) {
            console.warn('[App] Profile type mismatch:', { existingType: existingProfile.type, expectedType: normalizedProfile.type });
            const profileLabel = getProfileLabel(existingProfile.type);
            await supabase.auth.signOut().catch(signOutError =>
              console.warn('[Auth] signOut after profile type mismatch failed', signOutError)
            );
            throw new Error(
              `Este e-mail está cadastrado como ${profileLabel}. Selecione o perfil correspondente para entrar.`
            );
          }

          console.log('[App] Merging existing profile with new data...');
          const mergedProfile: UserProfile = {
            ...existingProfile,
            id: existingProfile.id ?? userId,
            type: existingProfile.type,
            company: normalizedProfile.company ?? existingProfile.company,
            contact: normalizedProfile.contact ?? existingProfile.contact,
            location: normalizedProfile.location ?? existingProfile.location,
            status: existingProfile.status ?? (existingProfile.type === 'steel' ? 'pending' : 'approved')
          };

          console.log('[App] Upserting merged profile...');
          const saved = await upsertProfile({ ...mergedProfile, id: userId });
          console.log('[App] Profile upserted:', saved ? 'success' : 'failed');
          setProfile(saved ?? mergedProfile);
          console.log('[App] Profile state updated');

          // Atualizar senha após perfil criado
          if (password?.trim()) {
            console.log('[App] Updating user password after profile merge...');
            try {
              const { error: passwordError } = await supabase.auth.updateUser({ password: password.trim() });
              if (passwordError) {
                console.error('[App] Password update failed:', passwordError);
              } else {
                console.log('[App] Password updated successfully');
              }
            } catch (pwdError) {
              console.error('[App] Password update error:', pwdError);
            }
          }
          return;
        }

        console.log('[App] Creating new profile...');
        const profileToSave: UserProfile = {
          ...normalizedProfile,
          id: userId,
          status: normalizedProfile.type === 'steel' ? 'pending' : 'approved',
          documentStatus: normalizedProfile.type === 'supplier' ? 'missing' : undefined
        };

        console.log('[App] Seeding profile:', profileToSave);
        const saved = await seedProfile(profileToSave);
        console.log('[App] Profile seeded:', saved ? 'success' : 'failed');
        if (normalizedProfile.type === 'steel') {
          console.log('[App] Notifying steel signup...');
          notifySteelSignup(profileToSave).catch(error =>
            console.warn('[App] notifySteelSignup failed', error)
          );
        }
        setProfile(saved ?? profileToSave);
        console.log('[App] Profile state updated (new profile)');

        // Agora que o perfil foi criado, vamos setar a senha
        if (password?.trim()) {
          console.log('[App] Updating user password after profile creation...');
          try {
            const { error: passwordError } = await supabase.auth.updateUser({ password: password.trim() });
            if (passwordError) {
              console.error('[App] Password update failed:', passwordError);
              // Não bloquear o fluxo por causa da senha
            } else {
              console.log('[App] Password updated successfully');
            }
          } catch (pwdError) {
            console.error('[App] Password update error:', pwdError);
            // Não bloquear o fluxo
          }
        }
      } catch (error) {
        console.error('[App] Signup process failed:', error);
        throw error;
      } finally {
        setIsProcessingSignup(false);
        console.log('[App] Signup process completed, flag reset');
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const rawMessage = error.message?.toLowerCase?.() ?? '';

      if (
        rawMessage.includes('email not confirmed') ||
        rawMessage.includes('verify your email') ||
        rawMessage.includes('email needs verification')
      ) {
        try {
          await supabase.auth.resend({
            type: 'signup',
            email
          });
        } catch (resendError) {
          console.warn('[Auth] Failed to resend verification email', resendError);
        }

        throw new Error('Conta ainda não foi confirmada. Enviamos um novo e-mail de verificação.');
      }

      throw mapSignInError(error);
    }

    if (!data.user) {
      throw new Error('Não foi possível validar seu acesso. Tente novamente.');
    }

    const userId = data.user.id;
    const metadataType = (data.user.user_metadata as { profile_type?: string } | null)?.profile_type;

    if (metadataType && metadataType !== normalizedProfile.type) {
      const profileLabel = getProfileLabel(metadataType);
      await supabase.auth.signOut().catch(signOutError =>
        console.warn('[Auth] signOut after metadata/profile type mismatch failed', signOutError)
      );
      throw new Error(
        `Este e-mail está cadastrado como ${profileLabel}. Selecione o perfil correspondente para entrar.`
      );
    }

    const existingProfile = await fetchProfileByEmail(email);

    if (existingProfile) {
      if (existingProfile.type !== normalizedProfile.type) {
        const profileLabel = getProfileLabel(existingProfile.type);
        await supabase.auth.signOut().catch(signOutError =>
          console.warn('[Auth] signOut after profile type mismatch failed', signOutError)
        );
        throw new Error(
          `Este e-mail está cadastrado como ${profileLabel}. Selecione o perfil correspondente para entrar.`
        );
      }

      const mergedProfile: UserProfile = {
        ...existingProfile,
        id: existingProfile.id ?? userId,
        type: existingProfile.type,
        company: normalizedProfile.company ?? existingProfile.company,
        contact: normalizedProfile.contact ?? existingProfile.contact,
        location: normalizedProfile.location ?? existingProfile.location,
        status: existingProfile.status ?? (existingProfile.type === 'steel' ? 'pending' : 'approved')
      };

      if (!metadataType) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { profile_type: existingProfile.type }
        });
        if (metadataError) {
          console.warn('[Auth] Failed to sync profile_type metadata', metadataError);
        }
      }

      const saved = await upsertProfile({ ...mergedProfile, id: userId });
      setProfile(saved ?? mergedProfile);
      return;
    }

    const fallbackProfile: UserProfile = {
      ...normalizedProfile,
      id: userId,
      status: normalizedProfile.type === 'steel' ? 'pending' : 'approved',
      documentStatus: normalizedProfile.type === 'supplier' ? 'missing' : undefined
    };

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { profile_type: normalizedProfile.type }
    });
    if (metadataError) {
      console.warn('[Auth] Failed to sync profile_type metadata', metadataError);
    }

    const saved = await upsertProfile(fallbackProfile);
    setProfile(saved ?? fallbackProfile);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    let nextProfile: UserProfile | null = null;
    setProfile(prev => {
      if (!prev) {
        nextProfile = prev;
        return prev;
      }
      nextProfile = { ...prev, ...updates };
      return nextProfile;
    });

    if (!nextProfile) {
      return;
    }

    const saved = await upsertProfile(nextProfile);
    if (saved) {
      setProfile(saved);
      if (saved.type === 'steel' && saved.email) {
        await syncSteelTableMetadata(saved.email, {
          company: saved.company ?? null,
          location: saved.location ?? null
        });
      }
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(error => {
      console.warn('[Auth] signOut failed', error);
    });
    setProfile(null);
  };

  const handleClosePasswordReset = () => {
    setPasswordResetVisible(false);
    setPasswordResetEmail(null);
  };

  const handleRefreshProfile = async (): Promise<UserProfile | null> => {
    const email = profile?.email;
    if (!email) {
      return null;
    }

    try {
      const latest = await fetchProfileByEmail(email);
      if (latest) {
        let resolvedProfile: UserProfile | null = null;
        setProfile(prev => {
          if (!prev) {
            resolvedProfile = latest;
            return latest;
          }
          if (prev.email.toLowerCase() !== latest.email.toLowerCase()) {
            resolvedProfile = prev;
            return prev;
          }
          resolvedProfile = { ...prev, ...latest };
          return resolvedProfile;
        });
        return resolvedProfile ?? latest;
      }
    } catch (error) {
      console.warn('[Profile] refreshProfile failed', error);
    }
    return null;
  };

  const renderAuthenticatedApp = (currentProfile: UserProfile) => {
    if (currentProfile.type === 'admin') {
      return (
        <NavigationContainer theme={navigationTheme}>
          <ProfileProvider
            profile={currentProfile}
            updateProfile={handleUpdateProfile}
            logout={handleLogout}
            refreshProfile={handleRefreshProfile}
          >
            <TableProvider>
              <AdminNavigator />
            </TableProvider>
          </ProfileProvider>
        </NavigationContainer>
      );
    }

    const isAwaitingSteelApproval = currentProfile.type === 'steel' && currentProfile.status !== 'approved';

    if (isAwaitingSteelApproval) {
      return (
        <NavigationContainer theme={navigationTheme}>
          <ProfileProvider
            profile={currentProfile}
            updateProfile={handleUpdateProfile}
            logout={handleLogout}
            refreshProfile={handleRefreshProfile}
          >
            <PendingApprovalScreen />
          </ProfileProvider>
        </NavigationContainer>
      );
    }

    if (currentProfile.type === 'supplier') {
      return (
        <NavigationContainer theme={navigationTheme}>
          <ProfileProvider
            profile={currentProfile}
            updateProfile={handleUpdateProfile}
            logout={handleLogout}
            refreshProfile={handleRefreshProfile}
          >
            <SubscriptionProvider>
              <SupplierAccessGate />
            </SubscriptionProvider>
          </ProfileProvider>
        </NavigationContainer>
      );
    }

    return (
      <NavigationContainer theme={navigationTheme}>
        <ProfileProvider
          profile={currentProfile}
          updateProfile={handleUpdateProfile}
          logout={handleLogout}
          refreshProfile={handleRefreshProfile}
        >
          <SubscriptionProvider>
            <NotificationProvider>
              <PushTokenRegistrar />
              <ConversationReadProvider>
                <TableProvider>
                  <MainTabs />
                </TableProvider>
              </ConversationReadProvider>
            </NotificationProvider>
          </SubscriptionProvider>
        </ProfileProvider>
      </NavigationContainer>
    );
  };

  const handleCompletePasswordReset = async (newPassword: string) => {
    if (!passwordResetEmail) {
      return;
    }
    try {
      setCompletingPasswordReset(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }
      const existingProfile = await fetchProfileByEmail(passwordResetEmail);
      if (existingProfile) {
        setProfile(existingProfile);
      }
      Alert.alert('Senha atualizada', 'Sua nova senha foi registrada com sucesso.');
      setPasswordResetVisible(false);
      setPasswordResetEmail(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar a senha.';
      Alert.alert('Redefinição de senha', message);
      console.warn('[Auth] updateUser password failed', error);
    } finally {
      setCompletingPasswordReset(false);
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />
        {showEmailConfirmation ? (
          <EmailConfirmationScreen onContinue={() => setShowEmailConfirmation(false)} />
        ) : isBootstrapping ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : profile ? (
          renderAuthenticatedApp(profile)
        ) : (
          <AuthScreen onAuthComplete={handleAuthComplete} />
        )}
        <PasswordResetModal
          visible={isPasswordResetVisible}
          email={passwordResetEmail ?? ''}
          loading={isCompletingPasswordReset}
          onClose={handleClosePasswordReset}
          onSubmit={handleCompletePasswordReset}
        />
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  resetCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4
  },
  resetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  resetSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  resetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resetCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary
  }
});

type PasswordResetModalProps = {
  visible: boolean;
  email: string;
  loading: boolean;
  onSubmit: (password: string) => void;
  onClose: () => void;
};

const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ visible, email, loading, onSubmit, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (visible) {
      setPassword('');
      setConfirm('');
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!password.trim()) {
      Alert.alert('Definir nova senha', 'Informe uma senha válida.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Definir nova senha', 'As senhas informadas não são iguais.');
      return;
    }
    onSubmit(password.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.resetBackdrop}>
        <View style={styles.resetCard}>
          <Text style={styles.resetTitle}>Definir nova senha</Text>
          <Text style={styles.resetSubtitle}>Conta: {email || 'seu e-mail cadastrado'}</Text>
          <TextField
            placeholder="Nova senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            placeholder="Confirmar senha"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />
          <View style={styles.resetActions}>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.resetCancel}>Cancelar</Text>
            </TouchableOpacity>
            <PrimaryButton
              label="Atualizar senha"
              onPress={handleSubmit}
              disabled={loading}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default App;
