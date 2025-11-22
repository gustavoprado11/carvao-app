import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { profileLabels, useProfile } from '../context/ProfileContext';
import { useTable } from '../context/TableContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useNotifications } from '../context/NotificationContext';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { SupplyAudience } from '../types/profile';
import { deleteCurrentAccount } from '../services/accountService';
import { SupplierSubscriptionPlans } from '../components/SupplierSubscriptionPlans';

type ProfileFormState = {
  email: string;
  company: string;
  contact: string;
  location: string;
  supplyAudience: SupplyAudience | null;
  averageDensityKg: string;
  averageMonthlyVolumeM3: string;
};

export const MenuScreen: React.FC = () => {
  const { profile, updateProfile, logout, refreshProfile } = useProfile();
  const { table, supplierTables, refreshSupplierTables, refreshTableData, loading: tablesLoading } = useTable();
  const { products: subscriptionProducts } = useSubscription();
  const {
    status: notificationStatus,
    supported: notificationsSupported,
    requestPermission: requestNotificationPermission
  } = useNotifications();
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [helpCenterVisible, setHelpCenterVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const appName = Constants?.expoConfig?.name ?? 'Carvão Connect';
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ProfileFormState>({
    email: profile.email,
    company: profile.company ?? '',
    contact: profile.contact ?? '',
    location: profile.location ?? '',
    supplyAudience: profile.supplyAudience ?? null,
    averageDensityKg: profile.averageDensityKg ?? '',
    averageMonthlyVolumeM3: profile.averageMonthlyVolumeM3 ?? ''
  });

  useEffect(() => {
    if (isEditing) {
      setForm({
        email: profile.email,
        company: profile.company ?? '',
        contact: profile.contact ?? '',
        location: profile.location ?? '',
        supplyAudience: profile.supplyAudience ?? null,
        averageDensityKg: profile.averageDensityKg ?? '',
        averageMonthlyVolumeM3: profile.averageMonthlyVolumeM3 ?? ''
      });
    }
  }, [isEditing, profile]);

  const isSteelProfile = profile.type === 'steel';
  const isSupplierProfile = profile.type === 'supplier';
  const supplyAudienceLabel = useMemo(() => {
    if (!profile.supplyAudience) {
      return undefined;
    }
    switch (profile.supplyAudience) {
      case 'pf':
        return 'Fornece como PF';
      case 'pj':
        return 'Fornece como PJ';
      case 'both':
        return 'Fornece como PF e PJ';
      default:
        return undefined;
    }
  }, [profile.supplyAudience]);

  const steelShortcuts = useMemo(() => {
    const hasTable = Boolean(table.id);
    return [
      {
        id: 'pricing',
        title: hasTable ? 'Editar tabela de preços' : 'Criar tabela de preços',
        description: hasTable
          ? 'Tabela disponível para todos os fornecedores'
          : 'Defina faixas de densidade, valores PF/PJ e Observações'
      }
    ];
  }, [table.id]);

  const supplierNotifications = useMemo(() => {
    if (!isSupplierProfile) {
      return [];
    }
    return supplierTables.map(item => {
      const company = item.company ?? 'Siderúrgica parceira';
      return {
        id: item.id,
        message: `${company} atualizou a tabela de preços - ${item.updatedAt ?? 'Atualizado recentemente'}`
      };
    });
  }, [isSupplierProfile, supplierTables]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refreshTableData()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, refreshTableData]);


  const profileDetailItems = useMemo(
    () => [
      {
        id: 'email',
        label: 'E-mail',
        value: profile.email
      },
      {
        id: 'contact',
        label: 'Responsável',
        value: profile.contact ?? 'Não informado'
      },
      {
        id: 'location',
        label: 'Localização',
        value: profile.location ?? 'Não informada'
      }
    ],
    [profile.email, profile.contact, profile.location]
  );

  const openExternalLink = (url: string) => {
    void Linking.openURL(url);
  };

  const handleChange = (key: keyof ProfileFormState) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };
  const handleSupplyAudienceChange = (value: SupplyAudience) => {
    setForm(prev => ({ ...prev, supplyAudience: value }));
  };

  const handleSave = async () => {
    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      Alert.alert('Atualização de perfil', 'Informe um e-mail corporativo válido.');
      return;
    }

    if (!form.location.trim()) {
      Alert.alert('Atualização de perfil', 'Informe a cidade e o estado da empresa.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        email: trimmedEmail,
        company: form.company.trim() || undefined,
        contact: form.contact.trim() || undefined,
        location: form.location.trim() || undefined,
        supplyAudience: form.supplyAudience ?? undefined,
        averageDensityKg: form.averageDensityKg.trim() || undefined,
        averageMonthlyVolumeM3: form.averageMonthlyVolumeM3.trim() || undefined
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Atualização de perfil', 'Não foi possível salvar os dados. Tente novamente em instantes.');
      console.warn('[Profile] update failed', error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Sair do app', 'Tem certeza que deseja sair do Carvão Connect?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout }
    ]);
  };

  const openSettings = () => {
    setSettingsVisible(true);
  };

  const closeSettings = () => {
    setSettingsVisible(false);
  };

  const handleNotificationPermission = async () => {
    if (!notificationsSupported) {
      Alert.alert('Notificações', 'Seu dispositivo não suporta notificações push.');
      return;
    }
    try {
      setNotificationLoading(true);
      const status = await requestNotificationPermission();
      if (status === 'granted') {
        Alert.alert('Notificações habilitadas', 'Você receberá alertas importantes do Carvão Connect.');
      } else {
        Alert.alert(
          'Permissão negada',
          'Não foi possível liberar as notificações. Ajuste nas configurações do sistema se desejar habilitar.'
        );
      }
    } catch (error) {
      Alert.alert('Notificações', 'Não foi possível atualizar as permissões.');
      console.warn('[Permissions] Request notifications failed', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const executeDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await deleteCurrentAccount();
      Alert.alert('Conta excluída', 'Sua conta foi removida com sucesso.');
      logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir sua conta agora.';
      Alert.alert('Excluir conta', message);
      console.warn('[Account] delete failed', error);
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Essa ação é irreversível. Deseja realmente excluir sua conta e remover seus dados?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void executeDeleteAccount() }
      ]
    );
  };

  const openHelpCenter = () => setHelpCenterVisible(true);
  const closeHelpCenter = () => setHelpCenterVisible(false);

  const handleOpenHelpCenter = () => {
    setSettingsVisible(false);
    InteractionManager.runAfterInteractions(() => {
      openHelpCenter();
    });
  };

  const refundLink =
    Platform.OS === 'ios'
      ? 'https://reportaproblem.apple.com/'
      : 'https://support.google.com/googleplay/answer/2479637';

  const billingHelpLink =
    Platform.OS === 'ios'
      ? 'https://support.apple.com/pt-br/HT204084'
      : 'https://support.google.com/googleplay/answer/2850369';

  const handleRequestRefund = () => {
    closeHelpCenter();
    openExternalLink(refundLink);
  };

  const handleContactSupport = () => {
    openExternalLink('mailto:suporte@carvaoconnect.com.br?subject=Ajuda%20com%20assinaturas');
  };
  const helpTopics = [
    {
      id: 'missing',
      title: 'Compra não encontrada',
      description:
        'Confirme se você está logado com a mesma conta utilizada para assinar. Se ainda assim não localizar, toque aqui para abrir as instruções oficiais da loja.',
      action: () => openExternalLink(billingHelpLink)
    },
    {
      id: 'faq',
      title: 'Perguntas frequentes',
      description: 'Entenda como funcionam cobrança, renovação automática e cancelamentos.',
      action: () => openExternalLink('https://carvaoconnect.com.br/faq')
    },
    {
      id: 'feedback',
      title: 'Enviar feedback',
      description: 'Identificou algum erro ou precisa de ajustes na sua assinatura? Conte para nós.',
      action: handleContactSupport
    }
  ];

  const notificationStatusLabel =
    notificationStatus === 'granted'
      ? 'Ativadas'
      : notificationStatus === 'denied'
        ? 'Desativadas'
        : 'Aguardando';

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
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.title}>Painel</Text>
            <Text style={styles.subtitle}>Gerencie seu perfil e acesse os atalhos mais usados.</Text>
          </View>
          <TouchableOpacity onPress={openSettings} style={styles.settingsButton} accessibilityRole="button">
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          {isEditing ? (
            <>
              <Text style={styles.profileLabel}>Editar perfil</Text>
              <View style={styles.form}>
                <TextField
                  placeholder="E-mail"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.email}
                  onChangeText={handleChange('email')}
                />
                <TextField
                  placeholder="Nome da empresa"
                  autoCapitalize="words"
                  value={form.company}
                  onChangeText={handleChange('company')}
                />
                <TextField
                  placeholder="Responsável"
                  autoCapitalize="words"
                  value={form.contact}
                  onChangeText={handleChange('contact')}
                />
                <TextField
                  placeholder="Cidade / Estado"
                  autoCapitalize="words"
                  value={form.location}
                  onChangeText={handleChange('location')}
                />
                {profile.type === 'supplier' ? (
                  <View style={styles.supplierFormSection}>
                    <Text style={styles.sectionHeading}>Detalhes de fornecimento</Text>
                    <SegmentedControl
                      value={form.supplyAudience ?? 'both'}
                      onChange={value => handleSupplyAudienceChange(value as SupplyAudience)}
                      options={[
                        { label: 'PF', value: 'pf' },
                        { label: 'PJ', value: 'pj' },
                        { label: 'PF + PJ', value: 'both' }
                      ]}
                    />
                    <TextField
                      placeholder="Densidade média (kg/m³)"
                      keyboardType="numeric"
                      value={form.averageDensityKg}
                      onChangeText={handleChange('averageDensityKg')}
                    />
                    <TextField
                      placeholder="Volume médio mensal (m³)"
                      keyboardType="numeric"
                      value={form.averageMonthlyVolumeM3}
                      onChangeText={handleChange('averageMonthlyVolumeM3')}
                    />
                  </View>
                ) : null}
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <View style={styles.saveButtonWrapper}>
                  <PrimaryButton
                    label="Salvar alterações"
                    onPress={handleSave}
                    disabled={isSaving}
                    loading={isSaving}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.profileHeader}>
                <View style={styles.profileSummary}>
                  <Text style={styles.profileRole}>{profileLabels[profile.type]}</Text>
                  <Text style={styles.profileCompany}>{profile.company ?? 'Empresa não informada'}</Text>
                  <Text style={styles.profileLabel}>Seu perfil</Text>
                </View>
                <TouchableOpacity style={styles.editChip} onPress={() => setIsEditing(true)}>
                  <Ionicons color={colors.primary} name="create-outline" size={16} />
                  <Text style={styles.editChipText}>Editar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profileGrid}>
                {profileDetailItems.map(item => (
                  <View key={item.id} style={styles.detailCard}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>
                ))}
              </View>

              {isSupplierProfile ? (
                <View style={styles.supplierSummary}>
                  <Text style={styles.sectionHeading}>Disponibilidade de carvão</Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Fornecimento</Text>
                    <Text style={styles.summaryValue}>{supplyAudienceLabel ?? 'Não informado'}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Densidade média</Text>
                    <Text style={styles.summaryValue}>
                      {profile.averageDensityKg ? `${profile.averageDensityKg} kg/m³` : 'Não informado'}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Volume mensal</Text>
                    <Text style={styles.summaryValue}>
                      {profile.averageMonthlyVolumeM3 ? `${profile.averageMonthlyVolumeM3} m³` : 'Não informado'}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {isSteelProfile ? (
          <View style={styles.cardGroup}>
            {steelShortcuts.map(item => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.86}
                style={[styles.card, styles.cardInteractive]}
                onPress={() => navigation.navigate('Tabelas')}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.notificationSection}>
            <View style={styles.notificationWrapper}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Atualizações das siderúrgicas</Text>
              </View>
              {tablesLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : supplierNotifications.length > 0 ? (
                supplierNotifications.map(notification => (
                  <View key={notification.id} style={styles.notificationEntry}>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyNotifications}>
                  <Text style={styles.emptyTitle}>Sem novidades por enquanto</Text>
                  <Text style={styles.emptyText}>
                    As siderúrgicas que você acompanha aparecerão aqui quando houver ajuste de preços ou observações.
                  </Text>
                </View>
              )}
            </View>
            {isSupplierProfile ? <SupplierSubscriptionPlans appName={appName} /> : null}
          </View>
        )}
      </ScrollView>
      </SafeAreaView>
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={closeSettings}
      >
        <View style={styles.settingsBackdrop}>
          <View
            style={[
              styles.settingsCard,
              { paddingBottom: spacing.lg + Math.max(insets.bottom, spacing.md) }
            ]}
          >
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Configurações</Text>
              <TouchableOpacity onPress={closeSettings}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>Permissão</Text>
              <TouchableOpacity
                style={styles.settingsOption}
                onPress={handleNotificationPermission}
                disabled={notificationLoading}
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
                <View style={styles.settingsOptionContent}>
                  <Text style={styles.settingsOptionText}>Notificações</Text>
                  <Text style={styles.settingsOptionHint}>{notificationStatusLabel}</Text>
                </View>
                {notificationLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>Privacidade</Text>
              <TouchableOpacity
                style={styles.settingsOption}
                onPress={confirmDeleteAccount}
                disabled={deletingAccount}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.settingsOptionText}>
                  {deletingAccount ? 'Excluindo conta...' : 'Excluir conta'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>Ajuda</Text>
            <TouchableOpacity style={styles.settingsOption} onPress={handleOpenHelpCenter} accessibilityRole="link">
              <Ionicons name="help-circle-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.settingsOptionText}>Central de ajuda</Text>
            </TouchableOpacity>
              <TouchableOpacity style={[styles.settingsOption, styles.settingsOptionLast]} onPress={confirmLogout}>
                <Ionicons name="log-out-outline" size={18} color={colors.accent} />
                <Text style={[styles.settingsOptionText, styles.settingsLogoutText]}>Sair do app</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={helpCenterVisible}
        animationType="slide"
        onRequestClose={closeHelpCenter}
        presentationStyle="pageSheet"
      >
        <SafeAreaView
          edges={['left', 'right']}
          style={[
            styles.helpCenterContainer,
            { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.lg) }
          ]}
        >
          <View style={styles.helpCenterHeader}>
            <TouchableOpacity onPress={closeHelpCenter} style={styles.helpBackButton}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              <Text style={styles.helpBackLabel}>Configurações</Text>
            </TouchableOpacity>
            <Text style={styles.helpCenterTitle}>Central de ajuda</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView
            contentContainerStyle={styles.helpCenterContent}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="always"
          >
            <View style={styles.helpInfoCard}>
              <Text style={styles.helpSectionTitle}>Como podemos ajudar?</Text>
              {helpTopics.map(topic => (
                <TouchableOpacity key={topic.id} style={styles.helpTopic} onPress={topic.action}>
                  <View style={styles.helpTopicTextWrapper}>
                    <Text style={styles.helpTopicTitle}>{topic.title}</Text>
                    <Text style={styles.helpTopicDescription}>{topic.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.helpInfoCard}>
              <Text style={styles.helpSectionTitle}>Compras recentes</Text>
              {subscriptionProducts.length ? (
                subscriptionProducts.slice(0, 3).map((product, index) => (
                  <View key={`${product.productId}-${index}`} style={styles.purchaseItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.purchaseTitle}>{product.title}</Text>
                      <Text style={styles.purchaseDescription}>{product.description}</Text>
                      <Text style={styles.purchaseMeta}>
                        {product.priceString ?? product.price} — {product.productId}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.helpTopicDescription}>
                  Nenhuma compra registrada neste dispositivo ainda. Assim que você assinar, ela aparecerá aqui.
                </Text>
              )}
            </View>

            <View style={styles.helpInfoCard}>
              <Text style={styles.helpSectionTitle}>Precisa de reembolso?</Text>
              <Text style={styles.helpTopicDescription}>
                A Apple analisa sua solicitação. Descreva o que aconteceu e, se preferir, fale conosco antes de enviar.
              </Text>
              <PrimaryButton label="Solicitar reembolso" onPress={handleRequestRefund} />
              <TouchableOpacity style={styles.helpSecondaryButton} onPress={handleContactSupport}>
                <Text style={styles.helpSecondaryButtonText}>Falar com o suporte</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const glassCard = {
  backgroundColor: colors.surface,
  borderRadius: spacing.lg,
  padding: spacing.xl,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: 'rgba(0,0,0,0.04)',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 3
} as const;

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
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
    gap: spacing.xl
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  header: {
    gap: spacing.xs,
    flex: 1
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: spacing.lg
  },
  notificationSection: {
    gap: spacing.md
  },
  notificationWrapper: {
    ...glassCard,
    gap: spacing.sm
  },
  notificationEntry: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  helpCenterContainer: {
    flex: 1,
    backgroundColor: colors.background
  },
  helpCenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  helpBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  helpBackLabel: {
    fontSize: 14,
    color: colors.textSecondary
  },
  helpCenterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  helpCenterContent: {
    padding: spacing.lg,
    gap: spacing.lg
  },
  helpInfoCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  helpTopic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  helpTopicTextWrapper: {
    flex: 1,
    gap: spacing.xs / 2
  },
  helpTopicTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  helpTopicDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  purchaseItem: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.glassSurface
  },
  purchaseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  purchaseDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2
  },
  purchaseMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  helpSecondaryButton: {
    marginTop: spacing.sm,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  helpSecondaryButtonText: {
    color: colors.primary,
    fontWeight: '600'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  },
  refreshTextDisabled: {
    color: colors.textSecondary
  },
  settingsButton: {
    padding: spacing.sm,
    borderRadius: spacing.lg,
    backgroundColor: colors.surface,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2
  },
  loadingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg
  },
  profileCard: {
    ...glassCard,
    gap: spacing.md
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  profileSummary: {
    flex: 1,
    gap: spacing.xs / 2
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  profileRole: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs / 2
  },
  profileCompany: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary
  },
  editChipText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs
  },
  detailCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glassSurface,
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
    marginTop: spacing.xs,
    gap: spacing.xs / 2
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  detailValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  supplierSummary: {
    marginTop: spacing.lg,
    gap: spacing.sm
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary
  },
  summaryValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right'
  },
  form: {
    gap: spacing.sm
  },
  supplierFormSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500'
  },
  saveButtonWrapper: {
    flex: 1,
    marginLeft: spacing.md
  },
  cardGroup: {
    gap: spacing.md
  },
  notificationCard: {
    ...glassCard,
    gap: spacing.md
  },
  notificationMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  emptyNotifications: {
    ...glassCard,
    gap: spacing.sm,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end'
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  settingsSection: {
    gap: spacing.sm
  },
  settingsSectionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  settingsOptionContent: {
    flex: 1,
    gap: spacing.xs / 2
  },
  settingsOptionHint: {
    fontSize: 12,
    color: colors.textSecondary
  },
  settingsOptionLast: {
    borderBottomWidth: 0
  },
  settingsOptionText: {
    fontSize: 15,
    color: colors.textPrimary
  },
  settingsLogoutText: {
    color: colors.accent,
    fontWeight: '700'
  },
  card: {
    ...glassCard,
    gap: spacing.xs
  },
  cardInteractive: {
    borderWidth: 1,
    borderColor: colors.primaryGradientEnd,
    shadowOpacity: 0.12
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  cardDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  }
});
