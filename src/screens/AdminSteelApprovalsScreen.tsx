import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { SegmentedControl } from '../components/SegmentedControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchSteelProfilesByStatus, updateProfileStatus } from '../services/profileService';
import { ProfileStatus, SupplyAudience, UserProfile } from '../types/profile';
import { useProfile } from '../context/ProfileContext';

type Buckets = Record<ProfileStatus, UserProfile[]>;

const INITIAL_BUCKETS: Buckets = {
  pending: [],
  approved: []
};

export const AdminSteelApprovalsScreen: React.FC = () => {
  const { logout } = useProfile();
  const [statusFilter, setStatusFilter] = useState<ProfileStatus>('pending');
  const [profiles, setProfiles] = useState<Buckets>(INITIAL_BUCKETS);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setRefreshing] = useState<boolean>(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const currentList = profiles[statusFilter];

  const loadProfiles = useCallback(
    async (status: ProfileStatus, showSpinner: boolean) => {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const data = await fetchSteelProfilesByStatus(status);
        setProfiles(prev => ({
          ...prev,
          [status]: data
        }));
      } finally {
        if (showSpinner) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadProfiles(statusFilter, true);
      return undefined;
    }, [loadProfiles, statusFilter])
  );

  const handleRefresh = useCallback(() => {
    loadProfiles(statusFilter, false);
  }, [loadProfiles, statusFilter]);

  const handleApprove = useCallback(
    async (item: UserProfile) => {
      if (!item.id) {
        Alert.alert('Aprovação', 'Registro inválido. Tente novamente.');
        return;
      }
      try {
        setApprovingId(item.id);
        const updated = await updateProfileStatus(item.id, 'approved');
        if (!updated) {
          Alert.alert('Aprovação', 'Não foi possível concluir a aprovação agora.');
          return;
        }
        setProfiles(prev => ({
          pending: prev.pending.filter(profile => profile.id !== item.id),
          approved: [updated, ...prev.approved.filter(profile => profile.id !== item.id)]
        }));
        Alert.alert(
          'Siderúrgica aprovada',
          `${updated.company ?? updated.email} está apta para usar o aplicativo.`
        );
      } finally {
        setApprovingId(null);
      }
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: UserProfile }) => {
      const isPending = statusFilter === 'pending';
      const isApproving = approvingId === item.id;
      const companyName = (item.company ?? '').trim();
      const contactName = (item.contact ?? '').trim();
      const location = (item.location ?? '').trim();
      const density = (item.averageDensityKg ?? '').trim();
      const volume = (item.averageMonthlyVolumeM3 ?? '').trim();
      const audience = item.supplyAudience ? audienceLabels[item.supplyAudience] : 'Não informado';

      const detailEntries = [
        { label: 'E-mail', value: item.email ?? 'Não informado' },
        { label: 'Responsável', value: contactName || 'Não informado' },
        { label: 'Cidade / Estado', value: location || 'Não informado' },
        { label: 'Densidade média (kg/m³)', value: density || 'Não informado' },
        { label: 'Volume médio mensal (m³)', value: volume || 'Não informado' },
        { label: 'Público atendido', value: audience }
      ];

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardTitle}>{companyName || item.email || 'Siderúrgica sem nome'}</Text>
              {contactName ? <Text style={styles.cardSubtitle}>{contactName}</Text> : null}
            </View>
            <Text style={[styles.badge, isPending ? styles.pendingBadge : styles.approvedBadge]}>
              {isPending ? 'Pendente' : 'Aprovada'}
            </Text>
          </View>
          <View style={styles.cardBody}>
            {detailEntries.map(entry => (
              <Detail key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </View>
          {isPending ? (
            <PrimaryButton
              label="Aprovar siderúrgica"
              onPress={() => handleApprove(item)}
              loading={isApproving}
              disabled={isApproving}
            />
          ) : null}
        </View>
      );
    },
    [approvingId, handleApprove, statusFilter]
  );

  const keyExtractor = useCallback((item: UserProfile) => item.id ?? item.email, []);

  const segmentedOptions = useMemo(
    () => [
      { label: 'Pendentes', value: 'pending' as ProfileStatus },
      { label: 'Aprovadas', value: 'approved' as ProfileStatus }
    ],
    []
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Gestão de siderúrgicas</Text>
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={segmentedOptions} />
        </View>
        <FlatList
          data={currentList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.surface} />
          }
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>
                {statusFilter === 'pending'
                  ? 'Nenhuma siderúrgica aguardando aprovação no momento.'
                  : 'Nenhuma siderúrgica aprovada encontrada.'}
              </Text>
            ) : null
          }
          ListFooterComponent={
            <View style={styles.footer}>
              <PrimaryButton label="Sair da conta" onPress={logout} disabled={isLoading || isRefreshing} />
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const audienceLabels: Record<SupplyAudience, string> = {
  pf: 'Pessoa física',
  pj: 'Pessoa jurídica',
  both: 'Ambos'
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
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitleGroup: {
    flex: 1,
    marginRight: spacing.md
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  badge: {
    borderRadius: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    fontWeight: '600'
  },
  pendingBadge: {
    backgroundColor: colors.primaryMuted,
    color: colors.primary
  },
  approvedBadge: {
    backgroundColor: '#E4F8EC',
    color: colors.success
  },
  cardBody: {
    gap: spacing.sm
  },
  detail: {
    gap: spacing.xs
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary
  },
  footer: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: spacing.xl
  }
});
