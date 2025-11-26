import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../theme';
import { SegmentedControl } from '../components/SegmentedControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { SupplierDocumentStatus, UserProfile } from '../types/profile';
import {
  fetchSuppliersByDocumentStatus,
  updateSupplierDocumentStatus
} from '../services/profileService';
import { useProfile } from '../context/ProfileContext';

type Buckets = Record<SupplierDocumentStatus, UserProfile[]>;

const INITIAL_BUCKETS: Buckets = {
  pending: [],
  approved: [],
  rejected: [],
  missing: []
};

export const AdminSupplierApprovalsScreen: React.FC = () => {
  const { profile: adminProfile, logout } = useProfile();
  const [statusFilter, setStatusFilter] = useState<SupplierDocumentStatus>('pending');
  const [profiles, setProfiles] = useState<Buckets>(INITIAL_BUCKETS);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setRefreshing] = useState<boolean>(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    visible: boolean;
    target: UserProfile | null;
    notes: string;
  }>({ visible: false, target: null, notes: '' });

  const currentList = profiles[statusFilter] ?? [];

  const loadProfiles = useCallback(
    async (status: SupplierDocumentStatus, showSpinner: boolean) => {
      if (showSpinner) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const data = await fetchSuppliersByDocumentStatus(status);
        setProfiles(prev => ({
          ...prev,
          [status]: data
        }));
      } catch (error) {
        console.warn('[AdminSupplier] fetch failed', error);
        Alert.alert('Fornecedores', 'Não foi possível carregar a lista agora.');
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

  const moveBetweenBuckets = useCallback(
    (updated: UserProfile, previousStatus: SupplierDocumentStatus) => {
      setProfiles(prev => {
        const next = { ...prev };
        next[previousStatus] = (next[previousStatus] ?? []).filter(p => p.id !== updated.id);
        next[updated.documentStatus ?? 'pending'] = [
          updated,
          ...(next[updated.documentStatus ?? 'pending'] ?? []).filter(p => p.id !== updated.id)
        ];
        return next;
      });
    },
    []
  );

  const handleApprove = useCallback(
    async (item: UserProfile) => {
      if (!item.id) {
        Alert.alert('Aprovar', 'Registro inválido. Tente novamente.');
        return;
      }
      try {
        setActionId(item.id);
        const updated = await updateSupplierDocumentStatus(item.id, 'approved', null, adminProfile.email);
        if (!updated) {
          Alert.alert('Aprovar', 'Não foi possível concluir agora.');
          return;
        }
        moveBetweenBuckets(updated, item.documentStatus ?? 'pending');
        Alert.alert('Fornecedor aprovado', `${updated.company ?? updated.email} liberado para uso.`);
      } finally {
        setActionId(null);
      }
    },
    [adminProfile.email, moveBetweenBuckets]
  );

  const handleReject = useCallback(() => {
    if (!rejectModal.target?.id) {
      setRejectModal({ visible: false, target: null, notes: '' });
      return;
    }
    const notes = rejectModal.notes.trim() || 'Documento inválido. Reenvie a DCF correta.';
    const target = rejectModal.target;
    const previousStatus = target.documentStatus ?? 'pending';
    setActionId(target.id);
    updateSupplierDocumentStatus(target.id, 'rejected', notes, adminProfile.email)
      .then(updated => {
        if (!updated) {
          Alert.alert('Reprovar', 'Não foi possível reprovar agora.');
          return;
        }
        moveBetweenBuckets(updated, previousStatus);
        Alert.alert('Documento reprovado', 'O fornecedor foi notificado para reenviar a DCF.');
      })
      .catch(error => {
        console.warn('[AdminSupplier] reject failed', error);
        Alert.alert('Reprovar', 'Não foi possível reprovar agora.');
      })
      .finally(() => {
        setActionId(null);
        setRejectModal({ visible: false, target: null, notes: '' });
      });
  }, [adminProfile.email, moveBetweenBuckets, rejectModal]);

  const renderItem = useCallback(
    ({ item }: { item: UserProfile }) => {
      const isPending = statusFilter === 'pending';
      const isApproving = actionId === item.id;
      const companyName = (item.company ?? '').trim() || item.email || 'Fornecedor sem nome';
      const contactName = (item.contact ?? '').trim();
      const location = (item.location ?? '').trim();
      const uploadedAt = item.documentUploadedAt
        ? new Date(item.documentUploadedAt).toLocaleString('pt-BR')
        : 'Não enviado';
      const reviewedAt = item.documentReviewedAt
        ? new Date(item.documentReviewedAt).toLocaleString('pt-BR')
        : '—';

      const detailEntries = [
        { label: 'E-mail', value: item.email ?? 'Não informado' },
        { label: 'Responsável', value: contactName || 'Não informado' },
        { label: 'Cidade / Estado', value: location || 'Não informado' },
        { label: 'DCF enviada em', value: uploadedAt },
        { label: 'Revisado em', value: reviewedAt },
        { label: 'Observações', value: item.documentReviewNotes ?? '—' }
      ];

      const openDocument = () => {
        if (item.documentUrl) {
          void Linking.openURL(item.documentUrl);
        } else {
          Alert.alert('Documento', 'Nenhum arquivo disponível para este fornecedor.');
        }
      };

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardTitle}>{companyName}</Text>
              {contactName ? <Text style={styles.cardSubtitle}>{contactName}</Text> : null}
            </View>
            <Text
              style={[
                styles.badge,
                statusFilter === 'approved' ? styles.approvedBadge : statusFilter === 'rejected' ? styles.rejectedBadge : styles.pendingBadge
              ]}
            >
              {statusFilter === 'approved' ? 'Aprovado' : statusFilter === 'rejected' ? 'Reprovado' : 'Pendente'}
            </Text>
          </View>
          <View style={styles.cardBody}>
            {detailEntries.map(entry => (
              <Detail key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </View>
          <View style={styles.actions}>
            <PrimaryButton label="Ver DCF" onPress={openDocument} disabled={!item.documentUrl} />
            {isPending ? (
              <View style={styles.actionRow}>
                <PrimaryButton
                  label="Aprovar fornecedor"
                  onPress={() => handleApprove(item)}
                  loading={isApproving}
                  disabled={isApproving}
                />
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => setRejectModal({ visible: true, target: item, notes: '' })}
                  disabled={isApproving}
                >
                  <Text style={styles.rejectText}>Reprovar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [actionId, handleApprove, statusFilter]
  );

  const keyExtractor = useCallback((item: UserProfile) => item.id ?? item.email, []);

  const segmentedOptions = useMemo(
    () => [
      { label: 'Pendentes', value: 'pending' as SupplierDocumentStatus },
      { label: 'Aprovados', value: 'approved' as SupplierDocumentStatus },
      { label: 'Reprovados', value: 'rejected' as SupplierDocumentStatus }
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
          <Text style={styles.title}>Gestão de fornecedores</Text>
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
                  ? 'Nenhum fornecedor aguardando aprovação.'
                  : statusFilter === 'approved'
                  ? 'Nenhum fornecedor aprovado encontrado.'
                  : 'Nenhum fornecedor reprovado encontrado.'}
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

      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal({ visible: false, target: null, notes: '' })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reprovar fornecedor</Text>
            <Text style={styles.modalSubtitle}>
              Informe uma observação (opcional). O fornecedor verá essa mensagem ao reenviar a DCF.
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              placeholder="Ex.: Documento ilegível, envie foto nítida."
              placeholderTextColor={colors.textSecondary}
              value={rejectModal.notes}
              onChangeText={text => setRejectModal(prev => ({ ...prev, notes: text }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setRejectModal({ visible: false, target: null, notes: '' })}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <PrimaryButton label="Reprovar" onPress={handleReject} loading={actionId === rejectModal.target?.id} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
  rejectedBadge: {
    backgroundColor: '#FFE2E0',
    color: '#E53E3E'
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
  actions: {
    gap: spacing.md
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  rejectButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  rejectText: {
    color: '#E53E3E',
    fontWeight: '700'
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.xl,
    gap: spacing.md
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  modalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    color: colors.textPrimary,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md
  },
  modalCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  modalCancelText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600'
  }
});
