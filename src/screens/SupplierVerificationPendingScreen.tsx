import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { useProfile } from '../context/ProfileContext';
import type { SupplyAudience } from '../types/profile';

type Props = {
  onUploadNew: () => void;
};

export const SupplierVerificationPendingScreen: React.FC<Props> = ({ onUploadNew }) => {
  const { profile, refreshProfile, logout } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const status = profile.documentStatus ?? 'pending';
  const isRejected = status === 'rejected';
  const isPending = status === 'pending';

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const updated = await refreshProfile();
      if (updated?.documentStatus === 'approved') {
        Alert.alert('Cadastro aprovado', 'Agora você pode escolher um plano e acessar as siderúrgicas.');
      } else if (updated?.documentStatus === 'rejected') {
        Alert.alert('Documento reprovado', 'Revise as observações do time antes de reenviar a DCF.');
      } else {
        Alert.alert('Em análise', 'Ainda estamos revisando seu documento. Tente novamente em instantes.');
      }
    } catch (error) {
      Alert.alert('Status', 'Não foi possível atualizar seu status agora.');
      console.warn('[SupplierPending] refresh failed', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDocument = () => {
    if (profile.documentUrl) {
      void Linking.openURL(profile.documentUrl);
    }
  };

  const formattedUploadDate = profile.documentUploadedAt
    ? new Date(profile.documentUploadedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'Ainda não enviado';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <Text style={styles.kicker}>Documento em análise</Text>
          <Text style={styles.title}>
            {isRejected ? 'Precisamos de um novo envio' : 'Estamos validando sua DCF'}
          </Text>
          <Text style={styles.subtitle}>
            Assim que o time confirmar os dados e a autenticidade do documento, você será liberado para escolher um plano.
          </Text>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Detalhes enviados</Text>
            <Detail label="Empresa" value={profile.company ?? 'Não informado'} />
            <Detail label="Responsável" value={profile.contact ?? 'Não informado'} />
            <Detail label="Cidade / Estado" value={profile.location ?? 'Não informado'} />
            <Detail label="Densidade média (kg/m³)" value={profile.averageDensityKg ?? 'Não informado'} />
            <Detail label="Volume médio mensal (m³)" value={profile.averageMonthlyVolumeM3 ?? 'Não informado'} />
            <Detail label="Público atendido" value={getAudienceLabel(profile.supplyAudience)} />
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>DCF enviada</Text>
            <Detail label="Arquivo" value={profile.documentUrl ? 'Documento armazenado com segurança' : 'Não enviado'} />
            <Detail label="Data do envio" value={formattedUploadDate} />
            <View style={styles.documentActions}>
              <PrimaryButton
                label="Atualizar status"
                onPress={handleRefresh}
                loading={isRefreshing}
                disabled={isRefreshing}
              />
              {profile.documentUrl ? (
                <TouchableOpacity style={styles.secondaryLink} onPress={openDocument}>
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                  <Text style={styles.secondaryLinkText}>Ver documento</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isRejected ? (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>O que corrigir</Text>
                <Text style={styles.alertMessage}>
                  {profile.documentReviewNotes ??
                    'Identificamos inconsistências no documento. Reenvie uma nova DCF válida para continuar.'}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <PrimaryButton
            label={isRejected ? 'Enviar nova DCF' : 'Trocar documento'}
            onPress={onUploadNew}
            disabled={isRefreshing}
          />
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Sair do app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const getAudienceLabel = (value: SupplyAudience | null | undefined) => {
  switch (value) {
    case 'pf':
      return 'Pessoa física';
    case 'pj':
      return 'Pessoa jurídica';
    case 'both':
      return 'PF e PJ';
    default:
      return 'Não informado';
  }
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  kicker: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  detailRow: {
    gap: spacing.xs
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  documentActions: {
    gap: spacing.sm
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  secondaryLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  alertCard: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE2E0',
    backgroundColor: 'rgba(255,118,112,0.15)',
    padding: spacing.md,
    gap: spacing.xs
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent
  },
  alertMessage: {
    fontSize: 13,
    color: colors.accent,
    lineHeight: 18
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.md
  },
  logoutButton: {
    alignSelf: 'center'
  },
  logoutText: {
    fontSize: 15,
    color: colors.textSecondary
  }
});
