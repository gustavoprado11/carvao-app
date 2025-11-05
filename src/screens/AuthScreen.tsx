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

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }
    const trimmedEmail = email.trim();
    const payload: UserProfile = {
      type: resolvedProfileType,
      email: trimmedEmail,
      company: company.trim() || undefined,
      contact: contact.trim() || undefined,
      location: location.trim() || undefined
    };
    try {
      setIsSubmitting(true);
      await onAuthComplete({
        mode,
        profile: payload,
        password
      });
      if (isSignup && resolvedProfileType === 'steel') {
        Alert.alert(
          'Confirmação necessária',
          'Enviamos um e-mail de verificação. Confirme o endereço para que possamos aprovar seu acesso como siderúrgica.'
        );
      }
    } catch (error) {
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
          behavior={Platform.select({ ios: 'padding', android: undefined })}
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
              label={isSignup ? 'Criar conta' : 'Entrar'}
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
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
    borderRadius: spacing.xxl,
    padding: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(15,23,42,0.12)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 6
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
  }
});
