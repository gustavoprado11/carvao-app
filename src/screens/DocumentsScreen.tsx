import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { useProfile } from '../context/ProfileContext';
import { DOCUMENT_REQUIREMENTS } from '../constants/documentTypes';
import type { DocumentItem, DocumentStatus } from '../types/document';
import { uploadSupplierDocument } from '../services/documentService';
import { fetchProfilesByType } from '../services/profileService';
import type { UserProfile } from '../types/profile';

type DocumentCardProps = {
  item: DocumentItem;
  onUpload?: () => void;
  onShare?: () => void;
  actionLabel?: string;
  onPress?: () => void;
};

const DocumentCard: React.FC<DocumentCardProps> = ({ item, onUpload, onShare, actionLabel, onPress }) => {
  const statusLabel = {
    missing: 'Pendente',
    pending: 'Em análise',
    shared: 'Compartilhado',
    expired: 'Vencido',
    rejected: 'Rejeitado',
    uploaded: 'Enviado'
  }[item.status];

  const statusStyleMap: Record<DocumentStatus, object> = {
    missing: styles.statusMissing,
    pending: styles.statusPending,
    shared: styles.statusShared,
    expired: styles.statusExpired,
    rejected: styles.statusRejected,
    uploaded: styles.statusUploaded
  };

  const statusStyle = statusStyleMap[item.status] ?? styles.statusMissing;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.description ? <Text style={styles.cardSubtitle}>{item.description}</Text> : null}
        </View>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      {item.updatedAt ? (
        <Text style={styles.meta}>Atualizado em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</Text>
      ) : null}
      <View style={styles.cardActions}>
        {onUpload ? (
          <PrimaryButton label={actionLabel ?? 'Enviar'} onPress={onUpload} style={styles.cardButton} />
        ) : null}
        {onShare ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onShare}>
            <Ionicons name="share-social-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Compartilhar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {item.sharedWith && item.sharedWith.length > 0 ? (
        <Text style={styles.sharedWith}>
          Compartilhado com: {item.sharedWith.join(', ')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const fallbackSteelList = ['Siderúrgica Alfa', 'Siderúrgica Beta', 'Siderúrgica Gama'];

export const DocumentsScreen: React.FC = () => {
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const isSupplier = profile.type === 'supplier';

  const [documents, setDocuments] = useState<DocumentItem[]>(() =>
    DOCUMENT_REQUIREMENTS.map(req => ({
      id: req.id,
      typeId: req.id,
      title: req.title,
      description: req.description,
      status: 'missing'
    }))
  );
  const [extraDocuments, setExtraDocuments] = useState<DocumentItem[]>([]);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [steelOptions, setSteelOptions] = useState<UserProfile[]>([]);
  const [selectedSteelIds, setSelectedSteelIds] = useState<Set<string>>(new Set());
  const [loadingSteel, setLoadingSteel] = useState(false);

  const [sharedDocs] = useState<DocumentItem[]>(() => [
    {
      id: 'shared-dcf',
      typeId: 'dcf',
      title: 'DCF',
      description: 'Declaração de Colheita de Florestas Plantadas',
      status: 'shared',
      updatedAt: new Date().toISOString(),
      sharedWith: ['Sua siderúrgica'],
      url: '#',
      path: '#',
      // supplier metadata (mock)
      supplierId: 'supplier-1',
      supplierName: 'Fornecedor Bandeirante',
      supplierLocation: 'Minas Gerais'
    } as DocumentItem & { supplierId: string; supplierName: string; supplierLocation?: string },
    {
      id: 'shared-dae',
      typeId: 'dae',
      title: 'DAE (Taxa Florestal e Expediente)',
      status: 'shared',
      updatedAt: new Date().toISOString(),
      sharedWith: ['Sua siderúrgica'],
      url: '#',
      path: '#',
      supplierId: 'supplier-1',
      supplierName: 'Fornecedor Bandeirante',
      supplierLocation: 'Minas Gerais'
    } as DocumentItem & { supplierId: string; supplierName: string; supplierLocation?: string }
  ]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const updateDocumentList = (
    setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>,
    targetId: string,
    payload: Partial<DocumentItem>
  ) => {
    setter(prev => prev.map(doc => (doc.id === targetId ? { ...doc, ...payload } : doc)));
  };

  const handleUpload = useCallback(
    async (item: DocumentItem, setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>) => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          multiple: false,
          type: ['application/pdf', 'image/jpeg', 'image/png'],
          copyToCacheDirectory: true
        });
        if (result.canceled) {
          return;
        }
        const asset = result.assets?.[0];
        if (!asset) {
          return;
        }
        const uploadResult = await uploadSupplierDocument(profile, {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType ?? 'application/pdf'
        });
        if (!uploadResult) {
          Alert.alert('Upload', 'Não foi possível enviar o documento. Tente novamente.');
          return;
        }
        const timestamp = new Date().toISOString();
        updateDocumentList(setter, item.id, {
          status: 'uploaded',
          updatedAt: timestamp,
          url: uploadResult.publicUrl,
          path: uploadResult.path,
          title: item.title || asset.name || 'Documento'
        });
        Alert.alert('Documento enviado', `${item.title || asset.name || 'Documento'} foi enviado com sucesso.`);
      } catch (error) {
        Alert.alert('Upload', 'Não foi possível selecionar ou enviar o documento agora.');
        console.warn('[Documents] upload failed', error);
      }
    },
    [profile]
  );

  const handleShare = useCallback(
    (item: DocumentItem, setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>) => {
      const sharedWith = fallbackSteelList.slice(0, 2);
      setter(prev => prev.map(doc => (doc.id === item.id ? { ...doc, status: 'shared', sharedWith } : doc)));
      Alert.alert('Compartilhado', `${item.title} foi disponibilizado para as siderúrgicas selecionadas.`);
    },
    []
  );

  const handleAddExtraDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true
      });
      if (result.canceled) {
        return;
      }
      const asset = result.assets?.[0];
      if (!asset) {
        return;
      }
      const uploadResult = await uploadSupplierDocument(profile, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf'
      });
      if (!uploadResult) {
        Alert.alert('Upload', 'Não foi possível enviar o documento. Tente novamente.');
        return;
      }
      const timestamp = new Date().toISOString();
      const newId = `extra-${Date.now()}`;
      setExtraDocuments(prev => [
        ...prev,
        {
          id: newId,
          typeId: 'extra',
          title: asset.name ?? 'Documento extra',
          status: 'uploaded',
          updatedAt: timestamp,
          url: uploadResult.publicUrl,
          path: uploadResult.path
        }
      ]);
      Alert.alert('Documento enviado', `${asset.name ?? 'Documento extra'} foi enviado com sucesso.`);
    } catch (error) {
      Alert.alert('Upload', 'Não foi possível selecionar ou enviar o documento agora.');
      console.warn('[Documents] upload extra failed', error);
    }
  }, [profile]);

  const supplierContent = (
    <>
      <Text style={styles.kicker}>Documentos obrigatórios</Text>
      <Text style={styles.subtitle}>
        Anexe cada documento e compartilhe apenas com as siderúrgicas desejadas. Formatos aceitos: PDF, JPG, PNG.
      </Text>
      <PrimaryButton
        label="Compartilhar todos"
        onPress={() => {
          setShareModalVisible(true);
          void loadSteelOptions();
        }}
        style={styles.fullWidthButton}
      />
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          item={doc}
          onUpload={() => handleUpload(doc, setDocuments)}
          onShare={
            doc.status === 'uploaded' || doc.status === 'shared'
              ? () => handleShare(doc, setDocuments)
              : undefined
          }
          actionLabel={doc.status === 'missing' ? 'Enviar' : 'Substituir'}
        />
      ))}
      <View style={styles.sectionDivider} />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Outros documentos</Text>
      </View>
      <PrimaryButton
        label="Adicionar documento extra"
        onPress={handleAddExtraDocument}
        style={styles.fullWidthButton}
      />
      {extraDocuments.length === 0 ? (
        <Text style={styles.subtitle}>Envie documentos adicionais que julgar relevantes.</Text>
      ) : null}
      {extraDocuments.map(doc => (
        <DocumentCard
          key={doc.id}
          item={doc}
          onUpload={() => handleUpload(doc, setExtraDocuments)}
          onShare={() => handleShare(doc, setExtraDocuments)}
          actionLabel={doc.status === 'missing' ? 'Enviar' : 'Substituir'}
          onPress={() => handleOpenDocument(doc)}
        />
      ))}
    </>
  );

  const steelContent = (
    <>
      <Text style={styles.kicker}>Documentos recebidos</Text>
      <Text style={styles.subtitle}>
        Aqui ficam os documentos compartilhados pelos fornecedores. Toque em um fornecedor para ver tudo que ele enviou.
      </Text>
      {sharedDocs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhum documento disponível</Text>
          <Text style={styles.emptyText}>Quando um fornecedor compartilhar algo, ele aparecerá aqui.</Text>
        </View>
      ) : null}

      {sharedDocs.length > 0 ? (
        selectedSupplierId ? (
          <>
            <TouchableOpacity onPress={() => setSelectedSupplierId(null)}>
              <Text style={styles.backLink}>← Voltar para fornecedores</Text>
            </TouchableOpacity>
            {sharedDocs
              .filter(
                (doc): doc is DocumentItem & { supplierId: string; supplierName?: string; supplierLocation?: string } =>
                  (doc as any).supplierId === selectedSupplierId
              )
              .map(doc => (
                <DocumentCard
                  key={doc.id}
                  item={doc}
                  actionLabel="Baixar"
                  onPress={() => handleOpenDocument(doc)}
                />
              ))}
          </>
        ) : (
          Array.from(
            new Map(
              sharedDocs
                .map(doc => ({
                  supplierId: (doc as any).supplierId,
                  supplierName: (doc as any).supplierName ?? 'Fornecedor',
                  supplierLocation: (doc as any).supplierLocation
                }))
                .filter(item => item.supplierId)
                .map(item => [item.supplierId, item])
            ).values()
          ).map(supplier => (
            <TouchableOpacity
              key={supplier.supplierId}
              style={styles.supplierCard}
              onPress={() => setSelectedSupplierId(supplier.supplierId)}
            >
              <Text style={styles.cardTitle}>{supplier.supplierName}</Text>
              {supplier.supplierLocation ? (
                <Text style={styles.cardSubtitle}>{supplier.supplierLocation}</Text>
              ) : null}
              <Text style={styles.meta}>
                {sharedDocs.filter((doc: any) => doc.supplierId === supplier.supplierId).length} documentos
              </Text>
            </TouchableOpacity>
          ))
        )
      ) : null}
    </>
  );

  const loadSteelOptions = useCallback(async () => {
    try {
      setLoadingSteel(true);
      const steels = await fetchProfilesByType('steel');
      const approved = steels.filter(partner => partner.status === 'approved');
      setSteelOptions(approved);
    } catch (error) {
      console.warn('[Documents] load steel options failed', error);
      Alert.alert('Compartilhar', 'Não foi possível carregar a lista de siderúrgicas agora.');
    } finally {
      setLoadingSteel(false);
    }
  }, []);

  const toggleSteelSelection = useCallback((id: string) => {
    setSelectedSteelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleShareAll = useCallback(() => {
    if (selectedSteelIds.size === 0) {
      Alert.alert('Compartilhar', 'Selecione ao menos uma siderúrgica para compartilhar.');
      return;
    }
    const names = steelOptions.filter(s => s.id && selectedSteelIds.has(s.id)).map(s => s.company ?? s.email);
    const sharedWith = names.length ? names : ['Siderúrgica selecionada'];
    setDocuments(prev => prev.map(doc => ({ ...doc, status: 'shared', sharedWith })));
    setExtraDocuments(prev => prev.map(doc => ({ ...doc, status: 'shared', sharedWith })));
    setShareModalVisible(false);
    Alert.alert('Compartilhado', 'Documentação enviada para as siderúrgicas selecionadas.');
  }, [selectedSteelIds, steelOptions]);

  const handleOpenDocument = useCallback((item: DocumentItem) => {
    if (item.url) {
      Linking.openURL(item.url).catch(err => {
        console.warn('[Documents] openURL failed', err);
        Alert.alert('Documento', 'Não foi possível abrir o documento agora.');
      });
    } else {
      Alert.alert('Documento', 'Nenhum arquivo disponível para este documento.');
    }
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, spacing.xxxl) }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Documentos</Text>
          {isSupplier ? supplierContent : steelContent}
        </ScrollView>
        {isSupplier ? (
          <Modal
            visible={isShareModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setShareModalVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Compartilhar documentos</Text>
                  <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>Selecione as siderúrgicas que receberão sua documentação.</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {loadingSteel ? (
                    <Text style={styles.modalSubtitle}>Carregando lista...</Text>
                  ) : steelOptions.length === 0 ? (
                    <Text style={styles.modalSubtitle}>Nenhuma siderúrgica encontrada.</Text>
                  ) : (
                    steelOptions.map(option => {
                      const checked = option.id ? selectedSteelIds.has(option.id) : false;
                      return (
                        <TouchableOpacity
                          key={option.id ?? option.email}
                          style={styles.checkboxRow}
                          onPress={() => option.id && toggleSteelSelection(option.id)}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.optionTitle}>{option.company ?? option.email}</Text>
                            {option.location ? <Text style={styles.modalSubtitle}>{option.location}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
                <PrimaryButton label="Compartilhar" onPress={handleShareAll} style={styles.fullWidthButton} />
              </View>
            </View>
          </Modal>
        ) : null}
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
    flex: 1
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    gap: spacing.md
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  cardButton: {
    flex: 1
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  secondaryButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  fullWidthButton: {
    alignSelf: 'stretch'
  },
  addButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.5,
    borderRadius: spacing.sm,
    backgroundColor: colors.primaryMuted
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  statusMissing: {
    backgroundColor: '#FFF6E5'
  },
  statusUploaded: {
    backgroundColor: '#E5F4FF'
  },
  statusShared: {
    backgroundColor: '#E5FFF0'
  },
  statusPending: {
    backgroundColor: '#EAF0FF'
  },
  statusRejected: {
    backgroundColor: '#FFE9E7'
  },
  statusExpired: {
    backgroundColor: '#F7F7F7'
  },
  sharedWith: {
    fontSize: 13,
    color: colors.textSecondary
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xs,
    alignItems: 'flex-start'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary
  },
  backLink: {
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.sm
  },
  supplierCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.sm
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  }
});
