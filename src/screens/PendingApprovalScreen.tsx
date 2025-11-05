import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '../context/ProfileContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, typography } from '../theme';

export const PendingApprovalScreen: React.FC = () => {
  const { profile, logout, refreshProfile } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const latest = await refreshProfile();
      if (!latest || latest.status !== 'approved') {
        Alert.alert(
          'Cadastro em análise',
          'Ainda não concluímos a verificação. Tente novamente em instantes.'
        );
      }
    } catch (error) {
      Alert.alert('Atualizar status', 'Não foi possível verificar o status agora.');
      console.warn('[PendingApproval] refreshProfile failed', error);
    } finally {
      setIsRefreshing(false);
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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Text style={styles.title}>Seu cadastro está em análise</Text>
        <Text style={styles.subtitle}>
          Assim que um administrador revisar os dados da sua siderúrgica, você receberá a liberação
          para acessar todas as funcionalidades do aplicativo.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados enviados</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <Text style={styles.fieldValue}>{profile.email}</Text>
          </View>
          {profile.company ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Empresa</Text>
              <Text style={styles.fieldValue}>{profile.company}</Text>
            </View>
          ) : null}
          {profile.contact ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Responsável</Text>
              <Text style={styles.fieldValue}>{profile.contact}</Text>
            </View>
          ) : null}
          {profile.location ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Cidade / Estado</Text>
              <Text style={styles.fieldValue}>{profile.location}</Text>
            </View>
          ) : null}
        </View>
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <PrimaryButton
            label="Atualizar status"
            onPress={handleRefresh}
            loading={isRefreshing}
            disabled={isRefreshing}
          />
          <PrimaryButton
            label="Sair"
            onPress={logout}
            disabled={isRefreshing}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.gradientStart
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    gap: spacing.lg
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(15,23,42,0.12)',
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary
  },
  field: {
    gap: spacing.xs
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  fieldValue: {
    fontSize: 15,
    color: colors.textPrimary
  },
  actions: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    gap: spacing.md
  }
});
