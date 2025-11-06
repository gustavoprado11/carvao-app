import React, { useEffect, useState } from 'react';
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
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';
import { SupplierTablePreview, TableRow, useTable } from '../context/TableContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { useSubscription } from '../context/SubscriptionContext';
import { colors, spacing } from '../theme';
import type { MainTabParamList } from '../navigation/MainTabs';
import { supabase } from '../lib/supabaseClient';

const unitOptions = [
  { label: 'm³', value: 'm3' as const },
  { label: 'tonelada', value: 'tonelada' as const }
];

const schedulingOptions = [
  { label: 'Agendamento', value: 'agendamento' as const },
  { label: 'Fila', value: 'fila' as const }
];

export const TablesScreen: React.FC = () => {
  const { profile } = useProfile();
  const isSteelProfile = profile.type === 'steel';
  const isSupplierProfile = profile.type === 'supplier';
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const {
    table,
    addRow,
    removeRow,
    updateRow,
    updateNotes,
    updatePaymentTerms,
    updateScheduleType,
    toggleActive,
    saveTable,
    isDirty,
    supplierTables,
    loading
  } = useTable();
  const { activeReceipt } = useSubscription();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [isCheckingConfirmation, setCheckingConfirmation] = useState(true);
  const [firstSetupModalVisible, setFirstSetupModalVisible] = useState(false);
  const [shouldAutoShowFirstPrompt, setShouldAutoShowFirstPrompt] = useState(true);
  const isSubscriptionActive = Boolean(activeReceipt);
  const shouldShowSubscriptionGate = isSupplierProfile && !isSubscriptionActive;

  const isFirstPublish = isSteelProfile && !table.id;
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

  const toggleTable = (tableId: string) => {
    setExpanded(prev => ({ ...prev, [tableId]: !prev[tableId] }));
  };

  const handleNavigateToPlans = () => {
    navigation.navigate('Menu');
  };

  const handleSaveTable = async () => {
    try {
      setIsSavingTable(true);
      await saveTable();
      Alert.alert('Tabela salva', 'Suas condições foram atualizadas com sucesso.');
    } catch (error) {
      Alert.alert('Erro ao salvar tabela', 'Não foi possível salvar a tabela. Tente novamente em instantes.');
      console.warn('[Tables] saveTable failed', error);
    } finally {
      setIsSavingTable(false);
    }
  };

  const renderReadOnlyRow = (row: TableRow) => (
    <View key={row.id} style={styles.rowCardReadonly}>
      <Text style={styles.fieldLabel}>Faixa de Densidade (kg/m³)</Text>
      <Text style={styles.readOnlyValue}>
        {row.densityMin || '—'} — {row.densityMax || '—'}
      </Text>
      <View style={styles.fieldGroup}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Preço PF (R$)</Text>
          <Text style={styles.readOnlyValue}>{row.pricePF || '—'}</Text>
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Preço PJ (R$)</Text>
          <Text style={styles.readOnlyValue}>{row.pricePJ || '—'}</Text>
        </View>
      </View>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Unidade de Pagamento</Text>
        <Text style={styles.readOnlyValue}>{unitLabel(row.unit)}</Text>
      </View>
    </View>
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

      <View style={styles.tableContainer}>
        <View style={styles.metaSection}>
          <View style={styles.metaField}>
            <Text style={styles.fieldLabel}>Forma de pagamento</Text>
            <TextInput
              value={table.paymentTerms}
              onChangeText={updatePaymentTerms}
              placeholder="Ex: 1 dia útil"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.metaInput]}
            />
          </View>
          <View style={styles.metaField}>
            <Text style={styles.fieldLabel}>Agendamento ou fila</Text>
            <View style={styles.metaSegmentedWrapper}>
              <SegmentedControl
                value={table.scheduleType}
                onChange={updateScheduleType}
                options={schedulingOptions}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Faixas de preço</Text>
          <TouchableOpacity style={styles.addButton} onPress={addRow}>
            <Ionicons color={colors.primary} name="add" size={18} />
            <Text style={styles.addButtonText}>Adicionar linha</Text>
          </TouchableOpacity>
        </View>

        {table.rows.map(row => (
          <View key={row.id} style={styles.rowCard}>
            <View style={styles.rowHeader}>
              <Text style={styles.fieldLabel}>Faixa de Densidade (kg/m³)</Text>
              <TouchableOpacity accessibilityLabel="Remover linha" hitSlop={10} onPress={() => removeRow(row.id)}>
                <Ionicons color={colors.accent} name="close-circle" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeRow}>
              <TextInput
                value={row.densityMin}
                onChangeText={value => updateRow(row.id, 'densityMin', value)}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.rangeInput]}
              />
              <Text style={styles.rangeSeparator}>—</Text>
              <TextInput
                value={row.densityMax}
                onChangeText={value => updateRow(row.id, 'densityMax', value)}
                placeholder="199,99"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.rangeInput]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Preço PF (R$)</Text>
                <TextInput
                  value={row.pricePF}
                  onChangeText={value => updateRow(row.id, 'pricePF', value)}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Preço PJ (R$)</Text>
                <TextInput
                  value={row.pricePJ}
                  onChangeText={value => updateRow(row.id, 'pricePJ', value)}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Unidade de Pagamento</Text>
              <TouchableOpacity
                accessibilityLabel="Selecionar unidade de pagamento"
                activeOpacity={0.86}
                style={styles.unitButton}
                onPress={() => handleSelectUnit(row.id)}
              >
                <Text style={styles.unitButtonText}>{unitLabel(row.unit)}</Text>
                <Ionicons color={colors.textSecondary} name="chevron-down" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
        disabled={!isDirty || isSavingTable}
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
          return (
            <View key={item.id} style={styles.supplierCard}>
              <TouchableOpacity style={styles.supplierHeader} onPress={() => toggleTable(item.id)} activeOpacity={0.9}>
                <View style={styles.supplierTitleBlock}>
                  <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">{item.company}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">{item.location}</Text>
                  <View style={styles.supplierMeta}>
                    <Text style={styles.updatedText}>{item.updatedAt}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              {isExpanded ? (
                <View style={styles.supplierBody}>
                  <View style={styles.metaInfoBox}>
                    <View style={styles.metaInfoRow}>
                      <Text style={styles.infoLabel}>Forma de pagamento</Text>
                      <Text style={styles.infoValue}>{item.paymentTerms?.trim() || 'Não informado'}</Text>
                    </View>
                    <View style={styles.metaInfoRow}>
                      <Text style={styles.infoLabel}>Agendamento ou fila</Text>
                      <Text style={styles.infoValue}>{formatScheduleLabel(item.scheduleType)}</Text>
                    </View>
                  </View>
                  {item.rows.map(renderReadOnlyRow)}
                  <View style={styles.notesBox}>
                    <Text style={styles.sectionTitle}>Observações</Text>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                  <PrimaryButton
                    label="Conversar com esta siderúrgica"
                    onPress={() => navigation.navigate('Conversas')}
                  />
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isSteelProfile ? renderSteelView() : renderSupplierView()}
        </ScrollView>
      </SafeAreaView>
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
    borderRadius: spacing.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(15,23,42,0.12)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6
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
    shadowColor: 'rgba(15,23,42,0.1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 2
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
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  metaSection: {
    gap: spacing.md
  },
  metaField: {
    gap: spacing.xs
  },
  metaInput: {
    width: '100%'
  },
  metaSegmentedWrapper: {
    alignSelf: 'stretch'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    gap: spacing.xs
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13
  },
  rowCard: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  rangeSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary
  },
  fieldGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  fieldBlock: {
    flex: 1,
    minWidth: 140,
    gap: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    fontSize: 15,
    color: colors.textPrimary
  },
  rangeInput: {
    flex: 1
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  unitButtonText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
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
    shadowColor: 'rgba(15,23,42,0.1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 2
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryMuted
  },
  supplierTitleBlock: {
    flex: 1,
    paddingRight: spacing.md,
    gap: spacing.xs / 2
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
    gap: spacing.xs,
    marginTop: spacing.xs / 2
  },
  updatedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  supplierBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md
  },
  metaInfoBox: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  infoValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  rowCardReadonly: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  notesBox: {
    borderRadius: spacing.md,
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
  }
});
