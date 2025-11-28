import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';
import { SupplierTablePreview, TableRow, useTable } from '../context/TableContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing } from '../theme';
import type { MainTabParamList } from '../navigation/MainTabs';
import { supabase } from '../lib/supabaseClient';
import { extractPriceTableFromFile } from '../services/priceTableAiService';
import { fetchSteelProfilesByStatus } from '../services/profileService';
import { getUnreadNotificationCount } from '../services/notificationService';
import type { UserProfile } from '../types/profile';

const unitOptions = [
  { label: 'metro', value: 'm3' as const },
  { label: 'tonelada', value: 'tonelada' as const }
];

const schedulingOptions = [
  { label: 'Agendamento', value: 'agendamento' as const },
  { label: 'Fila', value: 'fila' as const }
];

const parseDensityValue = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }
  const sanitized = value.replace(/[^\d,.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
};

const findOverlappingRanges = (rows: TableRow[]) => {
  const parsed = rows.map(row => ({
    id: row.id,
    min: parseDensityValue(row.densityMin),
    max: parseDensityValue(row.densityMax)
  }));

  const sorted = parsed
    .filter(item => item.min !== null && item.max !== null)
    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0));

  const overlapIds = new Set<string>();
  sorted.forEach((current, index) => {
    if (current.max !== null && current.min !== null && current.min > current.max) {
      overlapIds.add(current.id);
    }
    if (index === 0) {
      return;
    }
    const previous = sorted[index - 1];
    if (previous.max !== null && current.min !== null && current.min <= previous.max) {
      overlapIds.add(previous.id);
      overlapIds.add(current.id);
    }
  });

  return overlapIds;
};

const getInitials = (value?: string | null) => {
  if (!value) {
    return 'SC';
  }
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

export const TablesScreen: React.FC = () => {
  const { profile } = useProfile();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 380;
  const isSteelProfile = profile.type === 'steel';
  const isAdminProfile = profile.type === 'admin';
  const isSupplierProfile = profile.type === 'supplier';
  const navigation = useNavigation<NavigationProp<any>>();
  const {
    table,
    addRow,
    removeRow,
    duplicateRow,
    updateRow,
    updateNotes,
    updatePaymentTerms,
    updateScheduleType,
    applyImportedData,
    toggleActive,
    saveTable,
    supplierTables,
    refreshTableData,
    loadTableForOwner,
    saveTableForOwner,
    loading
  } = useTable();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [isCheckingConfirmation, setCheckingConfirmation] = useState(true);
  const [firstSetupModalVisible, setFirstSetupModalVisible] = useState(false);
  const [shouldAutoShowFirstPrompt, setShouldAutoShowFirstPrompt] = useState(true);
  const [activeChatTable, setActiveChatTable] = useState<SupplierTablePreview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [compactActions, setCompactActions] = useState<Record<string, boolean>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importSheetVisible, setImportSheetVisible] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string | null>(null);
  const headerMeasurementsRef = useRef<Record<string, { header?: number; heading?: number; actions?: number }>>({});

  // Subscription é apenas para suppliers - admin e steel não precisam
  const shouldShowSubscriptionGate = false;
  const overlappingRowIds = useMemo(() => findOverlappingRanges(table.rows), [table.rows]);
  const hasRangeOverlap = overlappingRowIds.size > 0;
  const [approvedSteels, setApprovedSteels] = useState<UserProfile[]>([]);
  const [adminSelectedSteel, setAdminSelectedSteel] = useState<UserProfile | null>(null);
  const [isLoadingSteels, setLoadingSteels] = useState(false);
  const [isLoadingSteelTable, setLoadingSteelTable] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const getFieldError = (value?: string | null) => (!value?.trim() ? 'Campo obrigatório' : null);
  const updateHeaderMeasurement = useCallback((rowId: string, part: 'header' | 'heading' | 'actions', width: number) => {
    const prevRow = headerMeasurementsRef.current[rowId] ?? {};
    const updatedRow = { ...prevRow, [part]: width };
    headerMeasurementsRef.current[rowId] = updatedRow;
    if (updatedRow.header && updatedRow.heading && updatedRow.actions) {
      const shouldCompact = updatedRow.heading + updatedRow.actions + spacing.sm > updatedRow.header;
      setCompactActions(prevCompact => {
        if (prevCompact[rowId] === shouldCompact) {
          return prevCompact;
        }
        return { ...prevCompact, [rowId]: shouldCompact };
      });
    }
  }, []);

  const isFirstPublish = (isSteelProfile || (isAdminProfile && adminSelectedSteel)) && !table.id;
  const firstSetupSteps = [
    'Defina todas as faixas de densidade e unidades aceitas.',
    'Informe os preços para PF e PJ em cada faixa.',
    'Descreva forma de pagamento e escolha se trabalha por agendamento ou fila.',
    'Inclua observações importantes para os fornecedores.',
    'Toque em “Salvar tabela” para publicar a tabela e liberá-la na aba Tabelas dos fornecedores.'
  ];

  useEffect(() => {
    if (supplierTables.length === 0) {
      return;
    }
    setExpanded(prev => {
      if (Object.keys(prev).length > 0) {
        return prev;
      }
      return {};
    });
  }, [supplierTables]);

  useEffect(() => {
    if (activeChatTable && !supplierTables.some(item => item.id === activeChatTable.id)) {
      setActiveChatTable(null);
    }
  }, [supplierTables, activeChatTable]);

  useEffect(() => {
    setCompactActions(prev => {
      const next: Record<string, boolean> = {};
      table.rows.forEach(row => {
        if (prev[row.id] !== undefined) {
          next[row.id] = prev[row.id];
        }
      });
      return next;
    });
    const nextMeasurements: Record<string, { header?: number; heading?: number; actions?: number }> = {};
    table.rows.forEach(row => {
      if (headerMeasurementsRef.current[row.id]) {
        nextMeasurements[row.id] = headerMeasurementsRef.current[row.id];
      }
    });
    headerMeasurementsRef.current = nextMeasurements;
  }, [table.rows]);

  useEffect(() => {
    const fetchConfirmationStatus = async () => {
      try {
        setCheckingConfirmation(true);
        const {
          data: { user },
          error
        } = await supabase.auth.getUser();
        if (error) {
          console.warn('[Tables] getUser failed', error);
        }
        setEmailConfirmed(Boolean(user?.email_confirmed_at));
      } catch (error) {
        console.warn('[Tables] failed to load confirmation status', error);
        setEmailConfirmed(true);
      } finally {
        setCheckingConfirmation(false);
      }
    };
    fetchConfirmationStatus();
  }, []);

  useEffect(() => {
    if (!isAdminProfile) {
      return;
    }
    const loadSteels = async () => {
      setLoadingSteels(true);
      try {
        const profiles = await fetchSteelProfilesByStatus('approved');
        setApprovedSteels(profiles);
      } finally {
        setLoadingSteels(false);
      }
    };
    void loadSteels();
  }, [isAdminProfile]);

  useEffect(() => {
    if (isSteelProfile && profile.email) {
      const loadUnreadCount = async () => {
        const count = await getUnreadNotificationCount(profile.email!);
        setUnreadCount(count);
      };
      loadUnreadCount();

      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isSteelProfile, profile.email]);

  useEffect(() => {
    if (isFirstPublish && shouldAutoShowFirstPrompt) {
      setFirstSetupModalVisible(true);
    }
    if (!isFirstPublish) {
      setFirstSetupModalVisible(false);
      setShouldAutoShowFirstPrompt(true);
    }
  }, [isFirstPublish, shouldAutoShowFirstPrompt]);

  const handleDismissFirstPrompt = () => {
    setFirstSetupModalVisible(false);
    if (shouldAutoShowFirstPrompt) {
      setShouldAutoShowFirstPrompt(false);
    }
  };

  const formatAuditDate = (isoDate?: string) => {
    if (!isoDate) return 'Data não disponível';
    const date = new Date(isoDate);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTableData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshTableData]);

  const handleSelectUnit = (rowId: string) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...unitOptions.map(option => option.label), 'Cancelar'],
          cancelButtonIndex: unitOptions.length,
          title: 'Unidade de Pagamento'
        },
        index => {
          if (index !== undefined && index < unitOptions.length) {
            updateRow(rowId, 'unit', unitOptions[index].value);
          }
        }
      );
    } else {
      Alert.alert('Unidade de Pagamento', 'Selecione a unidade', [
        ...unitOptions.map(option => ({
          text: option.label,
          onPress: () => updateRow(rowId, 'unit', option.value)
        })),
        { text: 'Cancelar', style: 'cancel' }
      ]);
    }
  };

  const unitLabel = (value: typeof unitOptions[number]['value']) =>
    unitOptions.find(option => option.value === value)?.label ?? value;

  const formatScheduleLabel = (value?: SupplierTablePreview['scheduleType']) => {
    if (value === 'fila') {
      return 'Fila';
    }
    if (value === 'agendamento') {
      return 'Agendamento';
    }
    return 'Não informado';
  };

  const toggleTable = (table: SupplierTablePreview) => {
    setExpanded(prev => {
      const isCurrentlyExpanded = !!prev[table.id];
      const nextState = { ...prev, [table.id]: !isCurrentlyExpanded };
      setActiveChatTable(prevChat => {
        if (!isCurrentlyExpanded) {
          return table;
        }
        return prevChat?.id === table.id ? null : prevChat;
      });
      return nextState;
    });
  };

  const handleNavigateToPlans = () => {
    navigation.navigate('Menu');
  };

  const handleProcessImportedFile = useCallback(
    async (file: { uri: string; name: string; type: string }) => {
      try {
        setImportSheetVisible(false);
        setImportStatus('Lendo tabela com ajuda da IA...');
        setImportingFileName(file.name);
        setIsImporting(true);
        const aiData = await extractPriceTableFromFile(file);
        applyImportedData(aiData);
        Alert.alert(
          'Tabela importada',
          'Revisamos a tabela pra você. Confira as informações antes de salvar.'
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Não conseguimos ler sua tabela. Tente tirar uma foto mais nítida ou enviar o arquivo diretamente.';
        Alert.alert('Erro na leitura', message);
        console.warn('[Tables] import failed', error);
      } finally {
        setIsImporting(false);
        setImportStatus(null);
        setImportingFileName(null);
      }
    },
    [applyImportedData]
  );

  const handlePickFromCamera = useCallback(async () => {
    setImportSheetVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para tirar a foto da tabela.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.uri) {
      void handleProcessImportedFile({
        uri: asset.uri,
        name: asset.fileName ?? 'tabela-precos.jpg',
        type: asset.mimeType ?? 'image/jpeg'
      });
    }
  }, [handleProcessImportedFile]);

  const handlePickFromGallery = useCallback(async () => {
    setImportSheetVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para escolher sua tabela.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.uri) {
      void handleProcessImportedFile({
        uri: asset.uri,
        name: asset.fileName ?? 'tabela-precos.jpg',
        type: asset.mimeType ?? 'image/jpeg'
      });
    }
  }, [handleProcessImportedFile]);

  const handlePickDocument = useCallback(async () => {
    setImportSheetVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });
      if (result.canceled) {
        return;
      }
      const asset = result.assets?.[0];
      if (asset?.uri) {
        void handleProcessImportedFile({
          uri: asset.uri,
          name: asset.name ?? 'tabela-precos.pdf',
          type: asset.mimeType ?? 'application/pdf'
        });
      }
    } catch (error) {
      Alert.alert(
        'Importar tabela',
        'Não foi possível selecionar o arquivo agora. Tente novamente em instantes.'
      );
      console.warn('[Tables] pick document failed', error);
    }
  }, [handleProcessImportedFile]);

  const openImportSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Tirar foto', 'Escolher da galeria', 'Anexar arquivo (PDF ou imagem)', 'Cancelar'],
          cancelButtonIndex: 3,
          title: 'Importar tabela automaticamente'
        },
        index => {
          if (index === 0) {
            void handlePickFromCamera();
          } else if (index === 1) {
            void handlePickFromGallery();
          } else if (index === 2) {
            void handlePickDocument();
          }
        }
      );
      return;
    }
    setImportSheetVisible(true);
  };

  const handleOpenConversation = () => {
    navigation.navigate('Conversas');
  };

  const handleSelectSteelProfile = useCallback(
    async (item: UserProfile) => {
      if (!item.email) {
        return;
      }
      setAdminSelectedSteel(item);
      setIsLoadingSteelTable(true);
      try {
        await loadTableForOwner(item.email, {
          company: item.company ?? null,
          location: item.location ?? null
        });
      } finally {
        setIsLoadingSteelTable(false);
      }
    },
    [loadTableForOwner]
  );

  const handleSaveTable = async () => {
    try {
      setIsSavingTable(true);
      if (isAdminProfile) {
        if (!adminSelectedSteel?.email) {
          Alert.alert('Selecione uma siderúrgica', 'Escolha qual siderúrgica deseja atualizar antes de salvar.');
          return;
        }
        await saveTableForOwner(adminSelectedSteel.email, {
          company: adminSelectedSteel.company ?? null,
          location: adminSelectedSteel.location ?? null
        });
      } else {
        await saveTable();
      }
      Alert.alert('Tabela salva', 'Suas condições foram atualizadas com sucesso.');
    } catch (error) {
      Alert.alert('Erro ao salvar tabela', 'Não foi possível salvar a tabela. Tente novamente em instantes.');
      console.warn('[Tables] saveTable failed', error);
    } finally {
      setIsSavingTable(false);
    }
  };

  const renderReadOnlyRow = (row: TableRow, index: number) => (
    <View key={row.id} style={[styles.rowCardReadonly, index > 0 && styles.rowCardSpacing]}>
      <View style={styles.densityRowHeader}>
        <View style={styles.densityTitleWrapper}>
          <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
          <View>
            <Text style={styles.rowLabel}>Faixa de densidade</Text>
            <Text style={styles.rowValue}>
              {row.densityMin || '—'} — {row.densityMax || '—'}
            </Text>
          </View>
        </View>
        <Text style={styles.densityUnit}>kg/m³</Text>
      </View>
      <View style={styles.priceRow}>
        <View style={styles.priceColumn}>
          <Text style={styles.rowLabel}>Preço PF</Text>
          <Text style={styles.priceValue}>{row.pricePF || '—'}</Text>
          <Text style={styles.priceNote}>R$</Text>
        </View>
        <View style={styles.priceColumn}>
          <Text style={styles.rowLabel}>Preço PJ</Text>
          <Text style={styles.priceValue}>{row.pricePJ || '—'}</Text>
          <Text style={styles.priceNote}>R$</Text>
        </View>
      </View>
      <View style={styles.unitRow}>
        <View style={styles.unitLabelWrapper}>
          <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.unitRowLabel}>Unidade de pagamento</Text>
        </View>
        <Text style={styles.unitRowValue}>{unitLabel(row.unit)}</Text>
      </View>
    </View>
  );

  const renderAdminView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Publicar tabelas das siderúrgicas</Text>
        <Text style={styles.subtitle}>
          Escolha uma siderúrgica aprovada para abrir e publicar a tabela de preços em nome dela.
        </Text>
      </View>

      <View style={styles.adminPickerCard}>
        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Siderúrgicas aprovadas</Text>
          {isLoadingSteels ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        {approvedSteels.length === 0 && !isLoadingSteels ? (
          <Text style={styles.adminEmptyText}>Nenhuma siderúrgica aprovada encontrada.</Text>
        ) : null}
        {approvedSteels.map(item => {
          const isSelected = adminSelectedSteel?.email === item.email;
          return (
            <TouchableOpacity
              key={item.id ?? item.email}
              style={[styles.adminSteelCard, isSelected && styles.adminSteelCardSelected]}
              onPress={() => void handleSelectSteelProfile(item)}
              activeOpacity={0.9}
            >
              <View style={styles.adminSteelInfo}>
                <Text style={styles.adminSteelName}>{item.company ?? item.email}</Text>
                <Text style={styles.adminSteelLocation}>{item.location ?? 'Localização não informada'}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
                size={18}
                color={isSelected ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {adminSelectedSteel ? (
        <View style={styles.adminSelectedBanner}>
          <View>
            <Text style={styles.adminSelectedLabel}>Editando como administrador</Text>
            <Text style={styles.adminSelectedValue}>{adminSelectedSteel.company ?? adminSelectedSteel.email}</Text>
          </View>
          <Text style={styles.adminSelectedLocation}>{adminSelectedSteel.location ?? 'Localização não informada'}</Text>
        </View>
      ) : null}

      {adminSelectedSteel ? (
        isLoadingSteelTable ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Carregando tabela...</Text>
          </View>
        ) : (
          renderSteelView()
        )
      ) : null}
    </>
  );

  const renderSteelView = () => (
    <>
      {isFirstPublish ? (
        <View style={styles.firstPublishCard}>
          <Text style={styles.firstPublishTitle}>Publique sua tabela para fornecedores</Text>
          <Text style={styles.firstPublishText}>
            Complete todos os campos abaixo e toque em “Salvar tabela” para que os fornecedores visualizem automaticamente
            suas condições.
          </Text>
          <TouchableOpacity style={styles.firstPublishHint} onPress={() => setFirstSetupModalVisible(true)}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.firstPublishHintText}>Ver passo a passo</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{table.title}</Text>
        <Text style={styles.subtitle}>{table.description}</Text>
      </View>

      <View style={styles.activationCard}>
        <View style={styles.activationRow}>
          <Text style={styles.activationLabel}>Tabela ativa para fornecedores</Text>
          <Switch
            value={table.isActive}
            onValueChange={toggleActive}
            trackColor={{ true: colors.primaryMuted, false: '#CBD5E1' }}
            thumbColor={table.isActive ? colors.primary : '#FFFFFF'}
          />
        </View>
        <Text style={styles.activationHint}>
          Ao desativar, sua tabela deixa de aparecer para fornecedores na aba Tabelas.
        </Text>
      </View>

      {table.lastModifiedByType === 'admin' && (
        <View style={styles.adminEditBanner}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.adminEditTitle}>Editada por administrador</Text>
            <Text style={styles.adminEditSubtitle}>
              Última modificação: {formatAuditDate(table.lastModifiedAt)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.tableContainer}>
        <View style={[styles.blockCard, isCompactLayout && styles.blockCardCompact]}>
          <Text style={styles.blockTitle}>Forma de pagamento</Text>
          <Text style={styles.blockSubtitle}>Explique como o pagamento acontece após a entrega.</Text>
          <View style={[styles.inputWrapper, isCompactLayout && styles.inputWrapperCompact]}>
            <Ionicons name="card-outline" size={18} color="rgba(15,23,42,0.35)" />
            <TextInput
              value={table.paymentTerms}
              onChangeText={updatePaymentTerms}
              placeholder="Ex: pagamento em 1 dia útil com depósito bancário"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.inputWithIcon]}
            />
          </View>
        </View>

        <View style={[styles.blockCard, isCompactLayout && styles.blockCardCompact]}>
          <Text style={styles.blockTitle}>Agendamento ou fila</Text>
          <Text style={styles.blockSubtitle}>Informe como as cargas são distribuídas no pátio.</Text>
          <View style={styles.metaSegmentedWrapper}>
            <SegmentedControl value={table.scheduleType} onChange={updateScheduleType} options={schedulingOptions} />
          </View>
        </View>

        <View style={[styles.blockCard, styles.importCard, isCompactLayout && styles.blockCardCompact]}>
          <View style={styles.blockHeader}>
            <View style={{ flex: 1, gap: spacing.xs / 2 }}>
              <Text style={styles.blockTitle}>Importar tabela automaticamente</Text>
              <Text style={styles.blockSubtitle}>
                Tire uma foto ou envie o arquivo da sua tabela. Nós preenchemos os campos pra você revisar.
              </Text>
            </View>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          </View>
          <PrimaryButton
            label="Importar tabela"
            onPress={openImportSheet}
            disabled={isImporting}
            style={styles.importButton}
          />
        </View>

        <View style={[styles.blockCard, isCompactLayout && styles.blockCardCompact]}>
          <View style={[styles.blockHeader, isCompactLayout && styles.blockHeaderCompact]}>
            <Text style={styles.blockTitle}>Faixas de preço</Text>
            <View style={[styles.rangeBadge, isCompactLayout && styles.rangeBadgeCompact]}>
              <Ionicons color={colors.primary} name="layers-outline" size={16} />
              <Text style={styles.rangeBadgeText}>
                {table.rows.length} {table.rows.length === 1 ? 'faixa cadastrada' : 'faixas cadastradas'}
              </Text>
            </View>
          </View>
          <Text style={styles.blockSubtitle}>
            Configure as densidades e valores para classificar automaticamente as ofertas.
          </Text>

        {table.rows.map((row, index) => {
          const minError = getFieldError(row.densityMin);
          const maxError = getFieldError(row.densityMax);
          const pfError = getFieldError(row.pricePF);
          const pjError = getFieldError(row.pricePJ);
          const isOverlapping = overlappingRowIds.has(row.id);

          return (
            <View
              key={row.id}
              style={[
                styles.rangeCard,
                isOverlapping ? styles.rangeCardError : null,
                isCompactLayout && styles.rangeCardCompact
              ]}
            >
              <View
                style={styles.rangeCardHeader}
                onLayout={event => updateHeaderMeasurement(row.id, 'header', event.nativeEvent.layout.width)}
              >
                <View
                  style={styles.rangeCardHeading}
                  onLayout={event => updateHeaderMeasurement(row.id, 'heading', event.nativeEvent.layout.width)}
                >
                  <Text style={styles.rangeCardTitle} numberOfLines={1} ellipsizeMode="tail">
                    Faixa {index + 1}
                  </Text>
                </View>
                <View
                  style={styles.rowActions}
                  onLayout={event => updateHeaderMeasurement(row.id, 'actions', event.nativeEvent.layout.width)}
                >
                  {(() => {
                    const shouldUseCompactAction = isCompactLayout || compactActions[row.id];
                    return (
                      <>
                        <TouchableOpacity
                          accessibilityLabel="Duplicar faixa"
                          hitSlop={10}
                          onPress={() => duplicateRow(row.id)}
                          style={[
                            styles.rowActionButton,
                            shouldUseCompactAction && styles.rowActionButtonCompact
                          ]}
                        >
                          <Ionicons color="rgba(15,23,42,0.7)" name="copy-outline" size={16} />
                          {!shouldUseCompactAction ? (
                            <Text style={styles.rowActionText}>Duplicar</Text>
                          ) : null}
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel="Remover faixa"
                          hitSlop={10}
                          onPress={() => removeRow(row.id)}
                          style={styles.rowDeleteButton}
                        >
                          <Ionicons color="rgba(15,23,42,0.7)" name="close" size={14} />
                        </TouchableOpacity>
                      </>
                    );
                  })()}
                </View>
              </View>
              <Text style={styles.rangeCardSubtitle}>
                {row.densityMin || '0'} a {row.densityMax || '—'} kg/m³
              </Text>

              {isOverlapping ? <Text style={styles.errorText}>❗ Faixa sobreposta com outra densidade.</Text> : null}

              <View style={styles.rangeVerticalInputs}>
                <View style={styles.rangeField}>
                  <Text style={styles.rangeFieldLabel}>Faixa inicial (kg/m³)</Text>
                  <View style={[styles.inputWrapper, isCompactLayout && styles.inputWrapperCompact]}>
                    <Ionicons name="speedometer-outline" size={16} color="rgba(15,23,42,0.35)" />
                    <TextInput
                      value={row.densityMin}
                      onChangeText={value => updateRow(row.id, 'densityMin', value)}
                      placeholder="Ex: 0"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.inputWithIcon]}
                    />
                  </View>
                  {minError ? <Text style={styles.errorText}>{minError}</Text> : null}
                </View>

                <View style={styles.rangeField}>
                  <Text style={styles.rangeFieldLabel}>Faixa final (kg/m³)</Text>
                  <View style={[styles.inputWrapper, isCompactLayout && styles.inputWrapperCompact]}>
                    <Ionicons name="speedometer-outline" size={16} color="rgba(15,23,42,0.35)" />
                    <TextInput
                      value={row.densityMax}
                      onChangeText={value => updateRow(row.id, 'densityMax', value)}
                      placeholder="Ex: até 199"
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.inputWithIcon]}
                    />
                  </View>
                  {maxError ? <Text style={styles.errorText}>{maxError}</Text> : null}
                </View>

                <View style={styles.rangeField}>
                  <Text style={styles.rangeFieldLabel}>Preço PF (R$)</Text>
                  <View style={[styles.inputWrapper, isCompactLayout && styles.inputWrapperCompact]}>
                    <Ionicons name="cash-outline" size={16} color="rgba(15,23,42,0.35)" />
                    <TextInput
                      value={row.pricePF}
                      onChangeText={value => updateRow(row.id, 'pricePF', value)}
                      placeholder="Informe o valor PF"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.inputWithIcon]}
                    />
                  </View>
                  {pfError ? <Text style={styles.errorText}>{pfError}</Text> : null}
                </View>

                <View style={styles.rangeField}>
                  <Text style={styles.rangeFieldLabel}>Preço PJ (R$)</Text>
                  <View style={[styles.inputWrapper, isCompactLayout && styles.inputWrapperCompact]}>
                    <Ionicons name="briefcase-outline" size={16} color="rgba(15,23,42,0.35)" />
                    <TextInput
                      value={row.pricePJ}
                      onChangeText={value => updateRow(row.id, 'pricePJ', value)}
                      placeholder="Informe o valor PJ"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.inputWithIcon]}
                    />
                  </View>
                  {pjError ? <Text style={styles.errorText}>{pjError}</Text> : null}
                </View>

                <View style={styles.rangeField}>
                  <Text style={styles.rangeFieldLabel}>Unidade de pagamento</Text>
                  <TouchableOpacity
                    accessibilityLabel="Selecionar unidade de pagamento"
                    activeOpacity={0.86}
                    style={[styles.unitButton, isCompactLayout && styles.unitButtonCompact]}
                    onPress={() => handleSelectUnit(row.id)}
                  >
                    <View style={styles.unitLabelWrapper}>
                      <Ionicons name="cube-outline" size={14} color="rgba(15,23,42,0.45)" />
                      <Text style={styles.unitButtonText}>{unitLabel(row.unit)}</Text>
                    </View>
                    <Ionicons color={colors.textSecondary} name="chevron-down" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {hasRangeOverlap ? (
          <Text style={[styles.rangeHelperText, styles.rangeHelperTextError]}>
            ❗ Existem faixas com intervalos sobrepostos. Ajuste os valores antes de salvar.
          </Text>
        ) : null}

          <TouchableOpacity activeOpacity={0.9} onPress={addRow} style={styles.addRangeButtonWrapper}>
            <LinearGradient
              colors={['#4F8EF7', '#2A6DE3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.addRangeButton, isCompactLayout && styles.addRangeButtonCompact]}
            >
              <Ionicons color="#FFFFFF" name="add" size={18} />
              <Text style={styles.addRangeButtonText}>Adicionar nova faixa de preço</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.notesCard}>
        <Text style={styles.sectionTitle}>Observações da Tabela</Text>
        <TextInput
          multiline
          placeholder="Inclua regras adicionais ou descontos aplicáveis."
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
          value={table.notes}
          onChangeText={updateNotes}
        />
      </View>

      <PrimaryButton
        label="Salvar tabela"
        onPress={handleSaveTable}
        disabled={isSavingTable || isImporting}
        loading={isSavingTable}
      />
    </>
  );

  const renderSupplierView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Tabelas das siderúrgicas</Text>
        <Text style={styles.subtitle}>
          Explore condições atualizadas e compare preços antes de enviar suas propostas.
        </Text>
      </View>

      {!isCheckingConfirmation && !emailConfirmed ? (
        <View style={styles.confirmationCard}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
          <View style={styles.confirmationContent}>
            <Text style={styles.confirmationTitle}>Confirme seu e-mail</Text>
            <Text style={styles.confirmationText}>
              Enviamos uma mensagem para {profile.email}. Acesse sua caixa de entrada e confirme o endereço para
              liberar o acesso às tabelas de preço.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.cardGroup}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Carregando tabelas...</Text>
          </View>
        ) : null}

        {supplierTables.map((item: SupplierTablePreview) => {
          const isExpanded = !!expanded[item.id];
          const initials = getInitials(item.company);
          return (
            <View key={item.id} style={styles.supplierCard}>
              <TouchableOpacity style={styles.supplierHeader} onPress={() => toggleTable(item)} activeOpacity={0.9}>
                <View style={styles.supplierTitleBlock}>
                  <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.company}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.location}
                  </Text>
                  <View style={styles.supplierMeta}>
                    <View style={styles.updatedBadge}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.updatedText}>{item.updatedAt}</Text>
                    </View>
                    <Ionicons name="analytics-outline" size={16} color={colors.textSecondary} />
                  </View>
                </View>
                <View style={styles.expandIndicator}>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {isExpanded ? (
                <View style={styles.supplierBody}>
                  <View style={styles.metaInfoGrid}>
                    <View style={styles.metaInfoCard}>
                      <Text style={styles.infoLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        Forma de pagamento
                      </Text>
                      <Text style={styles.infoValue}>{item.paymentTerms?.trim() || 'Não informado'}</Text>
                    </View>
                    <View style={styles.metaInfoCard}>
                      <Text style={styles.infoLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        Agendamento ou fila
                      </Text>
                      <Text
                        style={styles.infoValue}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        adjustsFontSizeToFit
                        minimumFontScale={0.9}
                      >
                        {formatScheduleLabel(item.scheduleType)}
                      </Text>
                    </View>
                  </View>
                  {item.rows.map((row, index) => renderReadOnlyRow(row, index))}
                  <View style={styles.notesBox}>
                    <Text style={styles.sectionTitle}>Observações</Text>
                    <Text style={styles.notesText}>{item.notes?.trim() || 'Nenhuma observação adicional.'}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </>
  );

  if (shouldShowSubscriptionGate) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.subscriptionGate}>
            <View style={styles.subscriptionGateCard}>
              <View style={styles.subscriptionGateIcon}>
                <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.subscriptionGateTitle}>Assine para desbloquear as tabelas</Text>
              <Text style={styles.subscriptionGateText}>
                Contrate o Carvão Connect Pro e tenha acesso imediato às tabelas das siderúrgicas parceiras e às
                conversas diretas com cada equipe comercial.
              </Text>
              <PrimaryButton label="Ver planos" onPress={handleNavigateToPlans} />
              <TouchableOpacity onPress={handleNavigateToPlans} activeOpacity={0.7}>
                <Text style={styles.subscriptionGateLink}>Ir para o Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          alwaysBounceVertical
        >
          {isAdminProfile ? renderAdminView() : isSteelProfile ? renderSteelView() : renderSupplierView()}
          {!isSteelProfile && !isAdminProfile && activeChatTable ? <View style={styles.stickySpacer} /> : null}
        </ScrollView>
      </SafeAreaView>
      {!isSteelProfile && !isAdminProfile && activeChatTable ? (
        <View style={styles.stickyChatBar}>
          <View style={styles.stickyChatInfo}>
            <Text style={styles.stickyChatLabel}>Conversar com</Text>
            <Text style={styles.stickyChatTitle} numberOfLines={1}>
              {activeChatTable.company}
            </Text>
          </View>
          <PrimaryButton label="Abrir conversa" onPress={handleOpenConversation} style={styles.stickyChatButton} />
        </View>
      ) : null}
      <Modal
        visible={importSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImportSheetVisible(false)}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setImportSheetVisible(false)} />
        <View style={styles.sheetContainer}>
          <Text style={styles.sheetTitle}>Importar tabela automaticamente</Text>
          <Text style={styles.sheetSubtitle}>
            Tire uma foto ou envie o arquivo da sua tabela. Nós preenchemos os campos pra você revisar.
          </Text>
          <TouchableOpacity style={styles.sheetOption} onPress={() => void handlePickFromCamera()}>
            <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.sheetOptionText}>Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetOption} onPress={() => void handlePickFromGallery()}>
            <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.sheetOptionText}>Escolher da galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetOption} onPress={() => void handlePickDocument()}>
            <Ionicons name="document-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.sheetOptionText}>Anexar arquivo (PDF ou imagem)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setImportSheetVisible(false)}>
            <Text style={styles.sheetCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={isImporting} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.importOverlay}>
          <View style={styles.importOverlayCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.importOverlayTitle}>{importStatus ?? 'Lendo tabela com ajuda da IA...'}</Text>
            {importingFileName ? (
              <Text style={styles.importOverlaySubtitle}>{importingFileName}</Text>
            ) : null}
            <Text style={styles.importOverlaySubtitle}>Isso pode levar alguns segundos.</Text>
          </View>
        </View>
      </Modal>
      <Modal
        visible={firstSetupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDismissFirstPrompt}
      >
        <View style={styles.firstModalBackdrop}>
          <View style={styles.firstModalCard}>
            <Text style={styles.firstModalTitle}>Como publicar sua tabela</Text>
            <Text style={styles.firstModalSubtitle}>
              Complete todos os campos e salve para liberar sua tabela automaticamente na visão dos fornecedores.
            </Text>
            {firstSetupSteps.map((step, index) => (
              <View key={step} style={styles.firstModalStep}>
                <View style={styles.firstModalBullet}>
                  <Text style={styles.firstModalBulletText}>{index + 1}</Text>
                </View>
                <Text style={styles.firstModalStepText}>{step}</Text>
              </View>
            ))}
            <PrimaryButton label="Vou preencher agora" onPress={handleDismissFirstPrompt} />
            <TouchableOpacity style={styles.firstModalClose} onPress={handleDismissFirstPrompt}>
              <Text style={styles.firstModalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
    padding: spacing.xxl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  subscriptionGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl
  },
  subscriptionGateCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  subscriptionGateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  subscriptionGateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subscriptionGateText: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary
  },
  subscriptionGateLink: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center'
  },
  adminPickerCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  adminEmptyText: {
    color: colors.textSecondary,
    fontSize: 14
  },
  adminSteelCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  adminSteelCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted
  },
  adminSteelInfo: {
    flex: 1,
    gap: spacing.xs / 2
  },
  adminSteelName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  adminSteelLocation: {
    fontSize: 13,
    color: colors.textSecondary
  },
  adminSelectedBanner: {
    backgroundColor: colors.primaryMuted,
    borderRadius: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md
  },
  adminSelectedLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  adminSelectedValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  adminSelectedLocation: {
    color: colors.textSecondary,
    fontSize: 13
  },
  header: {
    gap: spacing.xs
  },
  firstPublishCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  firstPublishTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  firstPublishText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  firstPublishHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  firstPublishHintText: {
    color: colors.primary,
    fontWeight: '600'
  },
  confirmationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderRadius: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary
  },
  confirmationContent: {
    flex: 1,
    gap: spacing.xs / 2
  },
  confirmationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary
  },
  confirmationText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  activationCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border
  },
  activationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  activationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  activationHint: {
    fontSize: 13,
    color: colors.textSecondary
  },
  tableContainer: {
    gap: spacing.lg
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(15,23,42,0.08)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)'
  },
  blockCardCompact: {
    padding: spacing.md
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  blockHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  blockSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  importCard: {
    borderStyle: 'solid',
    borderColor: colors.border
  },
  importButton: {
    marginTop: spacing.sm
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: '#D5DEEE',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    gap: spacing.sm
  },
  inputWrapperCompact: {
    width: '100%',
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs + 2
  },
  inputWithIcon: {
    flex: 1,
    paddingHorizontal: 0
  },
  metaSegmentedWrapper: {
    alignSelf: 'stretch',
    marginTop: spacing.xs
  },
  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderRadius: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs
  },
  rangeBadgeCompact: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center'
  },
  rangeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  rangeCard: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    padding: spacing.md,
    backgroundColor: '#F8FAFF',
    gap: spacing.md
  },
  rangeCardCompact: {
    padding: spacing.sm
  },
  rangeCardError: {
    borderColor: '#F87171',
    backgroundColor: '#FFF5F5'
  },
  rangeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  rangeCardHeading: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0
  },
  rangeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  rangeCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
    width: '100%'
  },
  rangeVerticalInputs: {
    gap: spacing.md
  },
  rangeField: {
    width: '100%',
    gap: spacing.xs
  },
  rangeFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  rangeInputBlock: {
    width: '100%'
  },
  removeRangeButton: {
    padding: spacing.xs,
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderRadius: spacing.sm
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  rangeInput: {
    flex: 1
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.xl,
    borderWidth: 1,
    borderColor: '#D5DEEE',
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs
  },
  unitButtonCompact: {
    width: '100%'
  },
  unitLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  unitButtonText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  rangeHelperText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  rangeHelperTextError: {
    color: '#DC2626',
    fontWeight: '600'
  },
  addRangeButtonWrapper: {
    marginTop: spacing.md
  },
  addRangeButton: {
    borderRadius: spacing.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  addRangeButtonCompact: {
    width: '100%'
  },
  addRangeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: spacing.xs / 2
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  rowActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: 'rgba(15,23,42,0.08)',
    borderRadius: spacing.xxl,
    minHeight: 34
  },
  rowActionButtonCompact: {
    paddingHorizontal: spacing.sm
  },
  rowActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  rowDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top'
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary
  },
  firstModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  firstModalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  firstModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  firstModalSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21
  },
  firstModalStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  firstModalBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center'
  },
  firstModalBulletText: {
    fontWeight: '700',
    color: colors.primary
  },
  firstModalStepText: {
    flex: 1,
    color: colors.textPrimary,
    lineHeight: 20
  },
  firstModalClose: {
    alignItems: 'center'
  },
  firstModalCloseText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  cardGroup: {
    gap: spacing.md
  },
  supplierCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryMuted,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg
  },
  supplierTitleBlock: {
    flex: 1,
    gap: spacing.xs / 2,
    paddingRight: spacing.md
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary
  },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs / 2
  },
  updatedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: 'rgba(148,163,184,0.25)',
    borderRadius: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2
  },
  expandIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  supplierBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  metaInfoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  metaInfoCard: {
    flex: 1,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
    gap: spacing.xs / 2
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  infoValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  rowCardReadonly: {
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2
  },
  rowCardSpacing: {
    marginTop: spacing.sm
  },
  densityRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  densityTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  rowValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  densityUnit: {
    fontSize: 12,
    color: colors.textSecondary
  },
  fieldGroupCompact: {
    flexDirection: 'row',
    gap: spacing.md
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  priceColumn: {
    flex: 1,
    gap: spacing.xs / 2
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  priceNote: {
    fontSize: 12,
    color: colors.textSecondary
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  unitRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  unitRowValue: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  notesBox: {
    borderRadius: spacing.sm,
    backgroundColor: colors.primaryMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  loadingState: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center'
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  stickyChatBar: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    bottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4
  },
  stickyChatInfo: {
    flex: 1,
    gap: spacing.xs / 2
  },
  stickyChatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  stickyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  stickyChatButton: {
    flex: 1
  },
  stickySpacer: {
    height: spacing.xxxl * 1.2
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)'
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
    gap: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.16)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 6
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: colors.border
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  sheetCancelText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  importOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  importOverlayCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  importOverlayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  importOverlaySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  adminEditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    padding: spacing.lg,
    borderRadius: spacing.md,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary
  },
  adminEditTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs / 2
  },
  adminEditSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  notificationBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
