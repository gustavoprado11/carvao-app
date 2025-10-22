import React, { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProfileType, UserProfile } from '../types/profile';

type AuthMode = 'signIn' | 'signUp';

type Props = {
  onAuthComplete: (profile: UserProfile) => Promise<void>;
};

export const AuthScreen: React.FC<Props> = ({ onAuthComplete }) => {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [profileType, setProfileType] = useState<ProfileType>('supplier');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signUp';

  const isValid = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false;
    }
    if (isSignup && (!company.trim() || !contact.trim() || confirmPassword !== password)) {
      return false;
    }
    return true;
  }, [email, password, company, contact, confirmPassword, isSignup]);

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }
    const payload: UserProfile = {
      type: profileType,
      email: email.trim(),
      company: company.trim() || undefined,
      contact: contact.trim() || undefined
    };
    try {
      setIsSubmitting(true);
      await onAuthComplete(payload);
    } catch (error) {
      Alert.alert('Falha ao entrar', 'Não foi possível autenticar. Tente novamente em instantes.');
      console.warn('[Auth] onAuthComplete failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.logoWrapper}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>CC</Text>
            </View>
            <Text style={typography.headline}>Carvão Connect</Text>
            <Text style={[typography.subtitle, styles.subtitle]}>
              Conectamos fornecedores de carvão às melhores siderúrgicas em uma única plataforma.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Acesso</Text>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={[
                { label: 'Entrar', value: 'signIn' },
                { label: 'Cadastrar', value: 'signUp' }
              ]}
            />

            <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Perfil</Text>
            <SegmentedControl
              value={profileType}
              onChange={setProfileType}
              options={[
                { label: 'Fornecedor', value: 'supplier' },
                { label: 'Siderúrgica', value: 'steel' }
              ]}
            />

            {isSignup ? (
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
              </View>
            ) : null}

            <View style={styles.formArea}>
              <TextField
                placeholder="E-mail corporativo"
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
            {!isSignup ? (
              <Text style={styles.helperText}>
                Esqueceu a senha? <Text style={styles.helperHighlight}>Recuperar acesso</Text>
              </Text>
            ) : null}
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Como funciona</Text>
            <Text style={styles.previewText}>
              Visualize tabelas atualizadas em tempo real, inicie conversas com equipes comerciais e acompanhe oportunidades
              de fornecimento com uma experiência fluida e moderna.
            </Text>
            <Image source={require('../../assets/mockup.png')} resizeMode="contain" style={styles.previewImage} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg
  },
  logoWrapper: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2458FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16
  },
  logoText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  subtitle: {
    textAlign: 'center',
    marginHorizontal: spacing.lg
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  sectionSpacing: {
    marginTop: spacing.md
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
  previewCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  previewText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  previewImage: {
    marginTop: spacing.sm,
    width: '100%',
    height: 180,
    backgroundColor: colors.background,
    borderRadius: spacing.md
  }
});
