import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { supabase } from '../lib/supabaseClient';

type ConfirmationStatus = 'loading' | 'success' | 'error' | 'already_confirmed';

type Props = {
  onContinue: () => void;
};

export const EmailConfirmationScreen: React.FC<Props> = ({ onContinue }) => {
  const [status, setStatus] = useState<ConfirmationStatus>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    verifyEmailConfirmation();
  }, []);

  const fetchUserWithRefresh = async () => {
    // Tenta atualizar sessão (server) com timeout curto; cai em getSession se der erro
    const refreshResult = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('refresh-timeout')), 7000))
    ]).catch(async error => {
      console.warn('[EmailConfirmation] refreshSession fallback', error);
      return supabase.auth.getSession();
    });

    const refreshedUser = 'data' in refreshResult ? refreshResult.data.session?.user : null;
    if (refreshedUser?.email) {
      setUserEmail(refreshedUser.email);
    }
    if (refreshedUser) {
      return refreshedUser;
    }

    // Fallback: consulta direta ao user
    const userResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('get-user-timeout')), 7000))
    ]).catch(error => {
      console.warn('[EmailConfirmation] getUser fallback', error);
      return null;
    });

    const user = userResult && 'data' in userResult ? userResult.data.user : null;
    if (user?.email) {
      setUserEmail(user.email);
    }
    return user;
  };

  const verifyEmailConfirmation = async () => {
    try {
      // Aguarda um pouco para o Supabase processar a confirmação
      await new Promise(resolve => setTimeout(resolve, 800));

      const user = await fetchUserWithRefresh();
      if (user?.email_confirmed_at) {
        setStatus('success');
        return;
      }

      // Tenta mais uma vez após pequeno atraso (processamento no backend)
      await new Promise(resolve => setTimeout(resolve, 1200));
      const retryUser = await fetchUserWithRefresh();
      if (retryUser?.email_confirmed_at) {
        setStatus('success');
        return;
      }

      setStatus('error');
    } catch (error) {
      console.warn('[EmailConfirmation] verifyEmailConfirmation failed', error);
      setStatus('error');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <View style={styles.content}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Verificando seu e-mail...</Text>
            <Text style={styles.subtitle}>Aguarde um momento</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
            </View>
            <Text style={styles.title}>E-mail confirmado com sucesso!</Text>
            <Text style={styles.subtitle}>
              Sua conta{userEmail ? ` (${userEmail})` : ''} foi verificada. Agora você pode continuar o cadastro e enviar sua DCF para análise.
            </Text>
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.stepText}>E-mail verificado</Text>
              </View>
              <View style={styles.stepItem}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <Text style={styles.stepText}>Próximo: Enviar DCF</Text>
              </View>
            </View>
            <PrimaryButton
              label="Continuar cadastro"
              onPress={onContinue}
            />
          </View>
        );

      case 'already_confirmed':
        return (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="information-circle" size={80} color={colors.primary} />
            </View>
            <Text style={styles.title}>E-mail já confirmado</Text>
            <Text style={styles.subtitle}>
              Seu e-mail já foi verificado anteriormente. Você pode continuar usando o app normalmente.
            </Text>
            <PrimaryButton
              label="Continuar"
              onPress={onContinue}
            />
          </View>
        );

      case 'error':
      default:
        return (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={80} color={colors.accent} />
            </View>
            <Text style={styles.title}>Erro ao verificar e-mail</Text>
            <Text style={styles.subtitle}>
              Não foi possível confirmar seu e-mail. O link pode ter expirado ou já foi usado.
            </Text>
            <Text style={styles.helperText}>
              Volte ao app e use o botão "Reenviar e-mail" para receber um novo link de verificação.
            </Text>
            <PrimaryButton
              label="Voltar ao app"
              onPress={onContinue}
            />
          </View>
        );
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {renderContent()}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg
  },
  iconContainer: {
    marginBottom: spacing.md
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center'
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 400
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 400
  },
  stepsList: {
    gap: spacing.md,
    marginVertical: spacing.lg,
    alignSelf: 'stretch',
    maxWidth: 400
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  stepText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  }
});
