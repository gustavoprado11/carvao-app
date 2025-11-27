import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Animated,
  TextInput,
  Switch,
  Pressable
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
import {
  uploadSupplierDocument,
  fetchDocumentsSharedWith,
  fetchOwnedDocuments,
  shareDocumentWithProfiles,
  deleteSupplierDocument
} from '../services/documentService';
import { fetchProfilesByType } from '../services/profileService';
import type { UserProfile } from '../types/profile';
import { useRef } from 'react';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type DocumentCardProps = {
  item: DocumentItem;
  onPrimary?: () => void;
  primaryLabel?: string;
  onView?: () => void;
  onDelete?: () => void;
};

const DocumentCard: React.FC<DocumentCardProps> = ({ item, onPrimary, primaryLabel, onView, onDelete }) => {
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
    <View style={styles.card}>
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
        {onPrimary ? (
          <PrimaryButton
            label={primaryLabel ?? (item.status === 'missing' ? 'Enviar' : 'Substituir')}
            onPress={onPrimary}
            style={styles.cardButton}
          />
        ) : null}
      </View>
      <View style={styles.inlineActions}>
        {onView ? (
          <TouchableOpacity
            style={styles.textAction}
            disabled={!item.url}
            onPress={item.url ? onView : undefined}
          >
            <Ionicons name="eye-outline" size={16} color={item.url ? colors.primary : colors.textSecondary} />
            <Text style={[styles.textActionLabel, !item.url && styles.textActionDisabled]}>Visualizar</Text>
          </TouchableOpacity>
        ) : null}
        {onDelete ? (
          <TouchableOpacity style={styles.textAction} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.accent} />
            <Text style={[styles.textActionLabel, { color: colors.accent }]}>Excluir</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {item.sharedWith && item.sharedWith.length > 0 ? (
        <Text style={styles.sharedWith}>
          Compartilhado com: {item.sharedWith.join(', ')}
        </Text>
      ) : null}
    </View>
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
  const [includeLease, setIncludeLease] = useState(false);
  const [extraDocuments, setExtraDocuments] = useState<DocumentItem[]>([]);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [steelOptions, setSteelOptions] = useState<UserProfile[]>([]);
  const [selectedSteelIds, setSelectedSteelIds] = useState<Set<string>>(new Set());
  const [loadingSteel, setLoadingSteel] = useState(false);

  const [sharedDocs, setSharedDocs] = useState<DocumentItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [loadingShared, setLoadingShared] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [selectedList, setSelectedList] = useState<'main' | 'extra'>('main');
  const [isSheetVisible, setSheetVisible] = useState(false);
  const sheetOpacity = useMemo(() => new Animated.Value(0), []);
  const [shareButtonState, setShareButtonState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [isAddExtraModalVisible, setAddExtraModalVisible] = useState(false);
  const [newExtraName, setNewExtraName] = useState('');
  const [isPickingDocument, setIsPickingDocument] = useState(false);
  const pickingRef = useRef(false);
  const leaseDoc = useMemo(() => {
    const isLease = (doc: DocumentItem) => doc.typeId === 'lease' || doc.id === 'lease';
    return documents.find(isLease) ?? null;
  }, [documents]);

  const isSentStatus = (status: DocumentStatus) => status !== 'missing';

  const normalizeTypeId = useCallback((value?: string) => (value ?? '').toString().trim().toLowerCase(), []);

  const forceCloseOverlays = useCallback(() => {
    setShareModalVisible(false);
    setAddExtraModalVisible(false);
    setSheetVisible(false);
    setSelectedDoc(null);
    sheetOpacity.setValue(0);
  }, [sheetOpacity]);

  const visibleMainDocuments = useMemo(() => {
    const isLease = (doc: DocumentItem) => doc.typeId === 'lease' || doc.id === 'lease';
    const withoutLease = documents.filter(doc => !isLease(doc));
    if (includeLease && leaseDoc) {
      return [...withoutLease, leaseDoc];
    }
    return withoutLease;
  }, [documents, includeLease, leaseDoc]);

  useEffect(() => {
    const loadShared = async () => {
      if (profile.type !== 'steel') {
        return;
      }
      if (!profile.id) {
        console.warn('[Documents] steel profile sem id para buscar documentos compartilhados.');
        return;
      }
      try {
        setLoadingShared(true);
        const docs = await fetchDocumentsSharedWith(profile.id);
        setSharedDocs(docs);
      } catch (error) {
        console.warn('[Documents] load shared documents failed', error);
        Alert.alert('Documentos', 'Não foi possível carregar os documentos compartilhados agora.');
      } finally {
        setLoadingShared(false);
      }
    };
    loadShared();
  }, [profile.id, profile.type]);

  const updateDocumentList = (
    setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>,
    targetId: string,
    payload: Partial<DocumentItem>
  ) => {
    setter(prev => prev.map(doc => (doc.id === targetId ? { ...doc, ...payload } : doc)));
  };

  useEffect(() => {
    const loadSupplierDocs = async () => {
      if (profile.type !== 'supplier' || !profile.id) {
        return;
      }
      try {
        setLoadingDocuments(true);
        const remoteDocs = await fetchOwnedDocuments(profile.id);
        setDocuments(prev => {
          const merged = DOCUMENT_REQUIREMENTS.map(req => {
            const remote = remoteDocs.find(doc => normalizeTypeId(doc.typeId) === req.id);
            if (remote) {
              return {
                ...remote,
                typeId: normalizeTypeId(remote.typeId) || req.id,
                title: remote.title || req.title,
                description: remote.description ?? req.description
              };
            }
            return {
              id: req.id,
              typeId: req.id,
              title: req.title,
              description: req.description,
              status: 'missing' as DocumentStatus
            };
          });
          return merged;
        });
        // Extra docs (typeId === 'extra')
        setExtraDocuments(remoteDocs.filter(doc => normalizeTypeId(doc.typeId) === 'extra'));
      } catch (error) {
        console.warn('[Documents] load supplier docs failed', error);
        Alert.alert('Documentos', 'Não foi possível carregar seus documentos agora.');
      } finally {
        setLoadingDocuments(false);
      }
    };
    loadSupplierDocs();
  }, [profile.id, profile.type]);

  const handleUpload = useCallback(
    async (item: DocumentItem, setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>) => {
      try {
        if (pickingRef.current) {
          return;
        }
        pickingRef.current = true;
        setIsPickingDocument(true);
        await sleep(120); // pequena folga para iOS encerrar pickers anteriores
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
          mimeType: asset.mimeType ?? 'application/pdf',
          typeId: item.typeId as any
        });
        if (!uploadResult) {
          Alert.alert('Upload', 'Não foi possível enviar o documento. Tente novamente.');
          return;
        }
        const timestamp = new Date().toISOString();
        updateDocumentList(setter, item.id, {
          id: uploadResult.recordId ?? item.id,
          typeId: item.typeId, // Preserva o typeId
          status: 'uploaded',
          updatedAt: timestamp,
          url: uploadResult.publicUrl,
          path: uploadResult.path,
          title: item.title || asset.name || 'Documento'
        });
        Alert.alert('Documento enviado', `${item.title || asset.name || 'Documento'} foi enviado com sucesso.`);
      } catch (error) {
        console.error('[Documents] upload failed:', error);
        if ((error as any)?.code === 'ERR_PICKING_IN_PROGRESS') {
          Alert.alert('Upload', 'Aguarde o seletor fechar antes de tentar novamente.');
        } else {
          Alert.alert('Upload', 'Não foi possível selecionar ou enviar o documento agora.');
        }
      } finally {
        pickingRef.current = false;
        setIsPickingDocument(false);
      }
    },
    [profile]
  );

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

  const handleView = useCallback(
    (item: DocumentItem) => {
      if (!item.url) {
        Alert.alert('Documento', 'Nenhum arquivo disponível para este documento.');
        return;
      }
      handleOpenDocument(item);
    },
    [handleOpenDocument]
  );

  const handleDelete = useCallback(
    async (item: DocumentItem, setter: React.Dispatch<React.SetStateAction<DocumentItem[]>>) => {
      try {
        if (item.status === 'missing') {
          return;
        }
        await deleteSupplierDocument(profile.id ?? '', item);
        if (item.typeId === 'extra') {
          setter(prev => prev.filter(doc => doc.id !== item.id));
        } else {
          updateDocumentList(setter, item.id, {
            status: 'missing',
            url: undefined,
            path: undefined,
            updatedAt: undefined,
            sharedWith: undefined
          });
        }
        Alert.alert('Documento', 'Arquivo excluído com sucesso.');
      } catch (error) {
        console.warn('[Documents] delete failed', error);
        Alert.alert('Documento', 'Não foi possível excluir o documento agora.');
      }
    },
    [profile.id]
  );

  const isDocRequired = useCallback(
    (typeId: string) => {
      const normalized = normalizeTypeId(typeId);
      if (normalized === 'lease' && !includeLease) return false;
      return DOCUMENT_REQUIREMENTS.some(req => req.id === normalized && (req.id === 'lease' ? includeLease : true));
    },
    [includeLease, normalizeTypeId]
  );

  // Para gamificação: conta todos os documentos sugeridos (exceto lease se não ativado)
  const suggestedDocs = useMemo(
    () => DOCUMENT_REQUIREMENTS.filter(req => req.id === 'lease' ? includeLease : true),
    [includeLease]
  );

  const sentCount = useMemo(() => {
    const count = suggestedDocs.reduce((acc, req) => {
      const doc = documents.find(d => normalizeTypeId(d.typeId) === req.id);
      const isSent = doc && isSentStatus(doc.status);
      console.log('[Documents] Counting doc type:', req.id, 'found:', !!doc, 'status:', doc?.status, 'isSent:', isSent);
      return acc + (isSent ? 1 : 0);
    }, 0);
    console.log('[Documents] Total sentCount:', count, 'of', suggestedDocs.length);
    return count;
  }, [documents, suggestedDocs, normalizeTypeId]);

  const totalSuggested = suggestedDocs.length;

  const openSheet = useCallback((item: DocumentItem, list: 'main' | 'extra') => {
    setSelectedDoc(item);
    setSelectedList(list);
    setSheetVisible(true);
    Animated.timing(sheetOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true
    }).start();
  }, [sheetOpacity]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true
    }).start(() => {
      setSheetVisible(false);
      setSelectedDoc(null);
    });
  }, [sheetOpacity]);

  const renderProgress = () => (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text style={styles.kicker}>Resumo</Text>
        <Text style={styles.progressTitle}>
          {sentCount} de {totalSuggested} documentos anexados
        </Text>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, (sentCount / Math.max(totalSuggested, 1)) * 100)}%` }
          ]}
        />
      </View>
      <View style={styles.progressActionRow}>
        <PrimaryButton
          label={shareButtonState === 'success' ? '✓ Documentação enviada' : 'Compartilhar com siderúrgica'}
          loading={shareButtonState === 'loading'}
          onPress={() => {
            console.log('[Documents] Share button pressed!');
            handleOpenShareModal();
          }}
          style={styles.shareAllButton}
        />
      </View>
    </View>
  );

  const DocumentRow: React.FC<{ item: DocumentItem; list: 'main' | 'extra'; isLast?: boolean }> = ({
    item,
    list,
    isLast
  }) => {
    const sent = isSentStatus(item.status);
    return (
      <TouchableOpacity
        style={[styles.listRow, !isLast ? styles.listRowSpacing : null]}
        activeOpacity={0.9}
        onPress={() => openSheet(item, list)}
      >
        <View style={[styles.checkboxWrapper, sent ? styles.checkboxCheckedBg : styles.checkboxUncheckedBg]}>
          {sent ? <Ionicons name="checkmark" size={14} color={colors.primary} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.listTitle}>{item.title}</Text>
          {item.description ? <Text style={styles.listSubtitle}>{item.description}</Text> : null}
          <Text style={styles.listMeta}>
            {item.updatedAt ? `Atualizado em ${new Date(item.updatedAt).toLocaleDateString('pt-BR')}` : 'Ainda não anexado'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const handleAddExtraDocument = useCallback(async (customName?: string) => {
    try {
      if (pickingRef.current) {
        return;
      }
      pickingRef.current = true;
      setIsPickingDocument(true);
      await sleep(120); // pequena folga para iOS encerrar pickers anteriores
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
      setAddExtraModalVisible(false);
      const resolvedName = customName?.trim() || asset.name || 'Documento extra';
      const uploadResult = await uploadSupplierDocument(profile, {
        uri: asset.uri,
        name: resolvedName,
        mimeType: asset.mimeType ?? 'application/pdf',
        typeId: 'extra'
      });
      if (!uploadResult) {
        Alert.alert('Upload', 'Não foi possível enviar o documento. Tente novamente.');
        return;
      }
      const timestamp = new Date().toISOString();
      const newId = `extra-${Date.now()}`;
      const resolvedId = uploadResult.recordId ?? newId;
      setExtraDocuments(prev => [
        ...prev,
        {
          id: resolvedId,
          typeId: 'extra',
          title: resolvedName,
          status: 'uploaded',
          updatedAt: timestamp,
          url: uploadResult.publicUrl,
          path: uploadResult.path
        }
      ]);
      Alert.alert('Documento enviado', `${resolvedName} foi enviado com sucesso.`);
    } catch (error) {
      Alert.alert('Upload', 'Não foi possível selecionar ou enviar o documento agora.');
      console.warn('[Documents] upload extra failed', error);
    } finally {
      pickingRef.current = false;
      setIsPickingDocument(false);
    }
  }, [profile]);

  const supplierContent = (
    <>
      <Text style={styles.subtitle}>Envie os principais documentos solicitados pelas siderúrgicas de forma rápida!</Text>
      {renderProgress()}
      {sentCount > 0 ? (
        <Text style={styles.motivation}>
          {sentCount === totalSuggested
            ? `Parabéns! Você já anexou ${sentCount} de ${totalSuggested} documentos.`
            : `Faltam ${totalSuggested - sentCount} documento${totalSuggested - sentCount === 1 ? '' : 's'} para anexar.`}
        </Text>
      ) : null}
      <View style={styles.checklistCard}>
        <View style={[styles.listRow, styles.toggleRow]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.listTitle}>Contrato de arrendamento</Text>
            <Text style={styles.listSubtitle}>Marque se a fazenda for arrendada.</Text>
          </View>
          <Switch
            value={includeLease}
            onValueChange={value => handleToggleLease(value)}
            trackColor={{ false: colors.border, true: colors.primaryMuted }}
            thumbColor={includeLease ? colors.primary : '#fff'}
          />
        </View>
        {visibleMainDocuments.map((doc, index, arr) => (
          <DocumentRow
            key={doc.id}
            item={doc}
            list={doc.typeId === 'extra' ? 'extra' : 'main'}
            isLast={index === arr.length - 1}
          />
        ))}
        {extraDocuments.map((doc, index) => (
          <DocumentRow
            key={doc.id}
            item={doc}
            list="extra"
            isLast={index === extraDocuments.length - 1}
          />
        ))}
      </View>
      {extraDocuments.length === 0 ? (
        <Text style={styles.subtitle}>Envie documentos adicionais que julgar relevantes.</Text>
      ) : null}
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setAddExtraModalVisible(true)}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </>
  );

  const steelContent = (
    <>
      <Text style={styles.kicker}>Documentos recebidos</Text>
      <Text style={styles.subtitle}>
        Aqui ficam os documentos compartilhados pelos fornecedores. Toque em um fornecedor para ver tudo que ele enviou.
      </Text>
      {loadingShared ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Carregando documentos...</Text>
        </View>
      ) : sharedDocs.length === 0 ? (
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
                  primaryLabel="Baixar"
                  onPrimary={() => handleOpenDocument(doc)}
                  onView={() => handleOpenDocument(doc)}
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
      console.log('[Documents] loadSteelOptions starting...');
      setLoadingSteel(true);
      const steels = await fetchProfilesByType('steel');
      console.log('[Documents] Fetched steels:', steels.length, 'profiles');
      const approved = steels.filter(partner => partner.status === 'approved');
      console.log('[Documents] Approved steels:', approved.length, 'profiles');
      setSteelOptions(approved);
    } catch (error) {
      console.error('[Documents] load steel options failed', error);
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

  const handleOpenShareModal = useCallback(async () => {
    console.log('[Documents] handleOpenShareModal called');
    setShareButtonState('loading');
    setShareModalVisible(true);
    try {
      console.log('[Documents] Loading steel options...');
      await loadSteelOptions();
      console.log('[Documents] Steel options loaded successfully');
    } catch (error) {
      console.error('[Documents] Error in handleOpenShareModal:', error);
    } finally {
      setShareButtonState('idle');
    }
  }, [loadSteelOptions]);
  const handleToggleLease = (value?: boolean) => {
    setIncludeLease(prev => (typeof value === 'boolean' ? value : !prev));
  };

  const handleShareAll = useCallback(async () => {
    try {
      if (selectedSteelIds.size === 0) {
        Alert.alert('Compartilhar', 'Selecione ao menos uma siderúrgica para compartilhar.');
        return;
      }
      const targetIds = Array.from(selectedSteelIds);
      const uploadeds = [...documents, ...extraDocuments].filter(
        doc =>
          (doc.status === 'uploaded' || doc.status === 'shared') &&
          (doc.typeId === 'lease' ? includeLease : true)
      );
      const isRecordId = (value?: string) => Boolean(value && value.length > 8 && !value.startsWith('extra-'));
      const needsSync = uploadeds.some(doc => !isRecordId(doc.id));
      let shareableDocs = uploadeds;

      if (needsSync && profile.id) {
        const remoteDocs = await fetchOwnedDocuments(profile.id);
        const mergeWithRemote = (doc: DocumentItem) => {
          if (isRecordId(doc.id)) {
            return doc;
          }
          const match = remoteDocs.find(
            remote =>
              (doc.path && remote.path === doc.path) ||
              (remote.typeId === doc.typeId && remote.title === doc.title)
          );
          return match ? { ...doc, id: match.id, path: match.path ?? doc.path, url: remote.url ?? doc.url } : doc;
        };
        shareableDocs = uploadeds.map(mergeWithRemote);
        setDocuments(prev => prev.map(mergeWithRemote));
        setExtraDocuments(prev => prev.map(mergeWithRemote));
      }

      const pendingWithoutId = shareableDocs.filter(doc => !isRecordId(doc.id));
      if (pendingWithoutId.length > 0) {
        Alert.alert('Compartilhar', 'Alguns documentos precisam ser reenviados antes de compartilhar.');
        return;
      }

      const shareTasks = shareableDocs
        .filter(doc => doc.id)
        .map(doc => shareDocumentWithProfiles(doc.id, targetIds));
      if (shareTasks.length === 0) {
        Alert.alert('Compartilhar', 'Envie os documentos antes de compartilhar.');
        return;
      }
      await Promise.all(shareTasks);
      const names = steelOptions.filter(s => s.id && selectedSteelIds.has(s.id)).map(s => s.company ?? s.email);
      const sharedWith = names.length ? names : ['Siderúrgica selecionada'];
      setDocuments(prev => prev.map(doc => ({ ...doc, status: 'shared', sharedWith })));
      setExtraDocuments(prev => prev.map(doc => ({ ...doc, status: 'shared', sharedWith })));
      setShareModalVisible(false);
      Alert.alert('Compartilhado', 'Documentação enviada para as siderúrgicas selecionadas.');
      setShareButtonState('success');
      setTimeout(() => setShareButtonState('idle'), 2200);
    } catch (error) {
      console.warn('[Documents] share all failed', error);
      Alert.alert('Compartilhar', 'Não foi possível compartilhar agora. Tente novamente.');
    }
  }, [selectedSteelIds, documents, extraDocuments, steelOptions, includeLease, profile.id]);

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
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                Math.max(insets.bottom + spacing.xl, spacing.xxxl) + (isSupplier ? spacing.xxxl * 1.4 : 0)
            }
          ]}
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
        {isSupplier && selectedDoc ? (
          <Modal visible={isSheetVisible} transparent animationType="fade" onRequestClose={closeSheet}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: sheetOpacity }]}>
              <TouchableOpacity style={styles.sheetBackdropTouchable} activeOpacity={1} onPress={closeSheet} />
            </Animated.View>
            <Animated.View
              style={[
                styles.sheetContainer,
                {
                  transform: [
                    {
                      translateY: sheetOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [300, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetDocIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>{selectedDoc.title}</Text>
                  {selectedDoc.description ? <Text style={styles.sheetSubtitle}>{selectedDoc.description}</Text> : null}
                </View>
              </View>
              <View style={styles.sheetDivider} />
              <View style={styles.sheetActions}>
                {selectedDoc.status === 'missing' ? (
                  <PrimaryButton
                    label="Enviar documento"
                    disabled={isPickingDocument}
                    onPress={async () => {
                      const setter = selectedList === 'main' ? setDocuments : setExtraDocuments;
                      await handleUpload(selectedDoc, setter);
                      closeSheet();
                    }}
                  />
                ) : (
                  <>
                    <PrimaryButton
                      label="Substituir documento"
                      disabled={isPickingDocument}
                      onPress={async () => {
                        const setter = selectedList === 'main' ? setDocuments : setExtraDocuments;
                        await handleUpload(selectedDoc, setter);
                        closeSheet();
                      }}
                    />
                    <TouchableOpacity style={styles.sheetLink} onPress={() => handleView(selectedDoc)}>
                      <Ionicons name="eye-outline" size={18} color={colors.primary} />
                      <Text style={styles.sheetLinkText}>Visualizar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sheetLink}
                      onPress={async () => {
                        const setter = selectedList === 'main' ? setDocuments : setExtraDocuments;
                        await handleDelete(selectedDoc, setter);
                        closeSheet();
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.accent} />
                      <Text style={[styles.sheetLinkText, { color: colors.accent }]}>Excluir</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>
          </Modal>
        ) : null}
        {isSupplier ? (
          <Modal
            visible={isAddExtraModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAddExtraModalVisible(false)}
          >
            <View style={styles.addModalBackdrop}>
              <View style={styles.addModalCard}>
                <Text style={styles.modalTitle}>Novo documento</Text>
                <Text style={styles.modalSubtitle}>Digite um nome e escolha o arquivo.</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Nome do documento</Text>
                  <View style={styles.inputWrapperInline}>
                    <TextInput
                      placeholder="Ex: Licença ambiental"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.textInput}
                      value={newExtraName}
                      onChangeText={setNewExtraName}
                    />
                  </View>
                </View>
                <PrimaryButton
                  label="Selecionar arquivo"
                  disabled={isPickingDocument}
                  onPress={async () => {
                    const name = newExtraName.trim() || 'Documento extra';
                    await handleAddExtraDocument(name);
                    setNewExtraName('');
                  }}
                  style={styles.fullWidthButton}
                />
                <TouchableOpacity onPress={() => setAddExtraModalVisible(false)} style={styles.modalCloseRow}>
                  <Text style={styles.modalCloseText}>Cancelar</Text>
                </TouchableOpacity>
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
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm
  },
  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  textActionLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14
  },
  textActionDisabled: {
    color: colors.textSecondary
  },
  motivation: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(148,163,184,0.3)',
    borderRadius: 999
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999
  },
  progressActionRow: {
    marginTop: spacing.md
  },
  shareAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xxl,
    minHeight: 36,
    alignSelf: 'stretch',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }
  },
  checklistCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: spacing.sm
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  listRowSpacing: {
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  toggleRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  checkboxWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5
  },
  checkboxCheckedBg: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxUncheckedBg: {
    borderColor: colors.border,
    backgroundColor: '#fff'
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  listSubtitle: {
    fontSize: 13,
    color: colors.textSecondary
  },
  listMeta: {
    fontSize: 12,
    color: colors.textSecondary
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
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
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  sheetBackdropTouchable: {
    flex: 1
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.16)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border
  },
  sheetActions: {
    gap: spacing.sm
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  sheetDocIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.border
  },
  sheetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  sheetLinkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15
  },
  addModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  addModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  inputRow: {
    gap: spacing.xs
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  inputWrapperInline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2
  },
  textInput: {
    color: colors.textPrimary,
    fontSize: 15
  },
  modalCloseRow: {
    alignItems: 'center',
    marginTop: spacing.xs
  },
  modalCloseText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  fab: {
    position: 'absolute',
    right: spacing.xxl,
    bottom: spacing.xxxl,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6
  }
});
