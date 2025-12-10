import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../theme';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { AuthMode, AuthPayload } from '../types/auth';
import { ProfileType, UserProfile } from '../types/profile';
import { supabase } from '../lib/supabaseClient';
import { adminSignupCode } from '../constants/appConfig';

const LOGIN_TIMEOUT_MS = 15000;

const runWithTimeout = <T,>(promise: Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('login-timeout'));
    }, LOGIN_TIMEOUT_MS);
    promise
      .then(value => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

type Props = {
  onAuthComplete: (payload: AuthPayload) => Promise<void>;
};

export const AuthScreen: React.FC<Props> = ({ onAuthComplete }) => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [primaryProfile, setPrimaryProfile] = useState<Exclude<ProfileType, 'admin'>>('supplier');
  const [isAdminMode, setAdminMode] = useState(false);
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpModalVisible, setOtpModalVisible] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{ profile: UserProfile; password: string } | null>(null);

  const isSignup = mode === 'signUp';
  const allowAdminSignup = Boolean(adminSignupCode);
  const resolvedProfileType: ProfileType = isAdminMode ? 'admin' : primaryProfile;

  useEffect(() => {
    if (isSignup && isAdminMode && !allowAdminSignup) {
      setAdminMode(false);
    }
  }, [isSignup, isAdminMode, allowAdminSignup]);

  useEffect(() => {
    setAdminCode('');
  }, [primaryProfile, mode, isAdminMode]);

  useEffect(() => {
    setOtpModalVisible(false);
    setPendingSignup(null);
    setOtpCode('');
  }, [mode]);

  const profileOptions = useMemo(
    () => [
      { label: 'Fornecedor', value: 'supplier' as const },
      { label: 'Siderúrgica', value: 'steel' as const }
    ],
    []
  );

  const isValid = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false;
    }
    if (isSignup) {
      if (resolvedProfileType === 'admin') {
        if (!allowAdminSignup) {
          return false;
        }
        if (!adminCode.trim() || adminCode.trim() !== adminSignupCode) {
          return false;
        }
      } else {
        if (!company.trim() || !contact.trim() || confirmPassword !== password) {
          return false;
        }
        if (!location.trim()) {
          return false;
        }
      }
    }
    return true;
  }, [
    email,
    password,
    company,
    contact,
    confirmPassword,
    isSignup,
    resolvedProfileType,
    location,
    adminCode,
    allowAdminSignup
  ]);

  const handleSendOtp = async (payload: UserProfile) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: payload.email,
        options: {
          shouldCreateUser: true,
          data: {
            profile_type: payload.type
          }
        }
      });

      if (error) {
        throw new Error(error.message || 'Não foi possível enviar o código de verificação.');
      }

      setPendingSignup({ profile: payload, password });
      setOtpCode('');
      setOtpModalVisible(true);
      Alert.alert(
        'Código enviado',
        'Enviamos um código de 6 dígitos para o seu e-mail. Digite-o para confirmar sua conta.'
      );
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Não foi possível enviar o código agora. Tente novamente.';
      Alert.alert('Verificação de e-mail', message);
      console.warn('[Auth] signInWithOtp failed', error);
    }
  };

  const handleVerifyOtp = async () => {
    if (!pendingSignup) {
      console.warn('[Auth] handleVerifyOtp called without pendingSignup');
      return;
    }
    const token = otpCode.trim();
    if (!token) {
      Alert.alert('Código de verificação', 'Informe o código recebido por e-mail.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      console.log('[Auth] Starting OTP verification for:', pendingSignup.profile.email);

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingSignup.profile.email,
        token,
        type: 'email'
      });

      console.log('[Auth] verifyOtp response:', {
        hasData: !!data,
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message
      });

      if (error || !data.session) {
        throw new Error(error?.message || 'Código inválido ou expirado. Solicite um novo e tente novamente.');
      }

      console.log('[Auth] Calling onAuthComplete...');
      const trimmedPassword = pendingSignup.password.trim();
      await onAuthComplete({
        mode: 'signUp',
        profile: pendingSignup.profile,
        password: trimmedPassword,
        otpVerified: true
      });
      console.log('[Auth] onAuthComplete finished successfully');

      if (pendingSignup.profile.type === 'steel') {
        Alert.alert(
          'Confirmação necessária',
          'Código validado! Seu acesso como siderúrgica será liberado após a aprovação da equipe.'
        );
      }

      setPendingSignup(null);
      setOtpModalVisible(false);
      console.log('[Auth] OTP verification completed successfully');
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Não foi possível validar o código. Tente novamente.';
      Alert.alert('Código de verificação', message);
      console.error('[Auth] verifyOtp failed:', error);
    } finally {
      console.log('[Auth] Setting isVerifyingOtp to false');
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingSignup) {
      return;
    }
    await handleSendOtp(pendingSignup.profile);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const payload: UserProfile = {
      type: resolvedProfileType,
      email: trimmedEmail,
      company: company.trim() || undefined,
      contact: contact.trim() || undefined,
      location: location.trim() || undefined
    };
    try {
      setIsSubmitting(true);
      if (isSignup) {
        await handleSendOtp(payload);
        return;
      }
      await runWithTimeout(
        onAuthComplete({
          mode,
          profile: payload,
          password
        })
      );
    } catch (error) {
      const timeoutError = error instanceof Error && error.message === 'login-timeout';
      if (timeoutError) {
        Alert.alert(
          'Tempo esgotado',
          'Não conseguimos concluir o login. Verifique se selecionou o perfil correto e se seus dados estão atualizados. Caso o problema persista, entre em contato com o suporte.'
        );
        return;
      }
      const message = error instanceof Error && error.message
        ? error.message
        : 'Não foi possível autenticar. Tente novamente em instantes.';
      Alert.alert('Falha ao entrar', message);
      console.warn('[Auth] onAuthComplete failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const openResetModal = () => {
    setResetEmail(email.trim());
    setResetFeedback(null);
    setResetModalVisible(true);
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail) {
      Alert.alert('Recuperar acesso', 'Informe o e-mail cadastrado para recuperar a senha.');
      return;
    }
    try {
      setIsSendingReset(true);
      await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: Linking.createURL('reset-password')
      });
      setResetFeedback('Enviamos um e-mail com instruções de redefinição. Verifique sua caixa de entrada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar o e-mail de recuperação.';
      Alert.alert('Recuperar acesso', message);
      console.warn('[Auth] resetPasswordForEmail failed', error);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior="padding"
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
        >
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.hero}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/icon-original.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[typography.headline, styles.title]}>
                Bem-vindo ao Carvão Connect
              </Text>
              <Text style={[typography.subtitle, styles.subtitle]}>
                Nunca foi tão fácil comprar e vender carvão.
              </Text>
            </View>

          <View style={styles.card}>
            <View style={styles.segmentedWrapper}>
              <SegmentedControl
                value={mode}
                onChange={setMode}
                options={[
                  { label: 'Entrar', value: 'signIn' },
                  { label: 'Cadastrar', value: 'signUp' }
                ]}
              />
            </View>

            <View style={styles.profileWrapper}>
              <Text style={styles.sectionLabel}>Selecione seu perfil</Text>
              <SegmentedControl
                value={primaryProfile}
                onChange={value => {
                  setPrimaryProfile(value);
                  setAdminMode(false);
                }}
                options={profileOptions}
              />
              {(allowAdminSignup || !isSignup) && (
                <Pressable
                  onPress={() => setAdminMode(prev => !prev)}
                  style={styles.adminToggle}
                  accessibilityRole="button"
                >
                  <Text style={styles.adminToggleText}>
                    {isAdminMode ? 'Usar perfis padrão' : 'Sou administrador'}
                  </Text>
                </Pressable>
              )}
              {isAdminMode ? (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeLabel}>Perfil administrativo selecionado</Text>
                </View>
              ) : null}
            </View>

            {isSignup ? resolvedProfileType !== 'admin' ? (
              <View style={styles.formArea}>
                <TextField
                  placeholder="Nome da empresa"
                  autoCapitalize="words"
                  value={company}
                  onChangeText={setCompany}
                />
                <TextField
                  placeholder="Responsável"
                  autoCapitalize="words"
                  value={contact}
                  onChangeText={setContact}
                />
                <TextField
                  placeholder="Cidade / Estado"
                  autoCapitalize="words"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            ) : (
              <View style={styles.formArea}>
                <Text style={styles.helperText}>
                  Informe o código administrativo fornecido pela equipe para criar um acesso interno.
                </Text>
                <TextField
                  placeholder="Código administrativo"
                  autoCapitalize="none"
                  value={adminCode}
                  onChangeText={setAdminCode}
                />
              </View>
            ) : null}

            <View style={styles.formArea}>
              <TextField
                placeholder="E-mail"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                placeholder="Senha"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {isSignup ? (
                <TextField
                  placeholder="Confirmar senha"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              ) : null}
            </View>

            <PrimaryButton
              label={isSignup ? 'Receber código' : 'Entrar'}
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting || isVerifyingOtp}
              loading={isSubmitting}
            />
            {isSignup ? (
              <Text style={styles.helperText}>
                Já possui uma conta?{' '}
                <Text style={styles.helperHighlight} onPress={() => setMode('signIn')}>
                  Entrar
                </Text>
              </Text>
            ) : (
              <View style={styles.helperRow}>
                <Text style={styles.helperText}>
                  Esqueceu a senha?{' '}
                  <Text style={styles.helperHighlight} onPress={openResetModal}>
                    Recuperar acesso
                  </Text>
                </Text>
                <Pressable onPress={() => setMode('signUp')}>
                  <Text style={styles.switchMode}>
                    Não tem conta? Cadastre-se
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
          <Modal
            visible={isResetModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setResetModalVisible(false)}
          >
            <View style={styles.resetBackdrop}>
              <View style={styles.resetCard}>
                <Text style={styles.resetTitle}>Recuperar acesso</Text>
                <Text style={styles.resetSubtitle}>
                  Informe o e-mail cadastrado para receber o link de redefinição de senha.
                </Text>
                <TextField
                  placeholder="E-mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                />
                {resetFeedback ? <Text style={styles.resetFeedback}>{resetFeedback}</Text> : null}
                <View style={styles.resetActions}>
                  <Pressable onPress={() => setResetModalVisible(false)} disabled={isSendingReset}>
                    <Text style={styles.resetCancel}>Cancelar</Text>
                  </Pressable>
                  <PrimaryButton
                    label="Enviar"
                    onPress={handleSendPasswordReset}
                    disabled={isSendingReset}
                    loading={isSendingReset}
                  />
                </View>
              </View>
            </View>
          </Modal>
          <Modal
            visible={isOtpModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setOtpModalVisible(false)}
          >
            <View style={styles.resetBackdrop}>
              <View style={styles.resetCard}>
                <Text style={styles.resetTitle}>Confirme seu e-mail</Text>
                <Text style={styles.resetSubtitle}>
                  Enviamos um código de 6 dígitos para {pendingSignup?.profile.email || email}.
                </Text>
                <TextField
                  placeholder="Código"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  maxLength={6}
                />
                <View style={styles.resetActions}>
                  <Pressable onPress={() => setOtpModalVisible(false)} disabled={isVerifyingOtp}>
                    <Text style={styles.resetCancel}>Editar dados</Text>
                  </Pressable>
                  <PrimaryButton
                    label="Validar código"
                    onPress={handleVerifyOtp}
                    disabled={isVerifyingOtp}
                    loading={isVerifyingOtp}
                  />
                </View>
                <Pressable style={styles.resendLink} onPress={handleResendOtp} disabled={isVerifyingOtp}>
                  <Text style={styles.resendText}>Reenviar código</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.gradientStart
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl
  },
  content: {
    flexGrow: 1,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.xxl
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl
  },
  heroLogo: {
    width: 64,
    height: 64
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  title: {
    textAlign: 'center',
    color: colors.textPrimary
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 320
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  segmentedWrapper: {
    width: '100%'
  },
  profileWrapper: {
    gap: spacing.sm
  },
  adminToggle: {
    alignSelf: 'flex-end'
  },
  adminToggleText: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline'
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryMuted,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.5
  },
  adminBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.4
  },
  formArea: {
    gap: spacing.sm
  },
  helperText: {
    textAlign: 'center',
    color: colors.textSecondary
  },
  helperHighlight: {
    color: colors.primary,
    fontWeight: '600'
  },
  helperRow: {
    gap: spacing.sm,
    alignItems: 'center'
  },
  switchMode: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontWeight: '500'
  },
  resetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  resetCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  resetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  resetSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  resetFeedback: {
    fontSize: 13,
    color: colors.primary
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
  },
  resendLink: {
    alignItems: 'center',
    marginTop: spacing.sm
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
