import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, spacing } from '../theme';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { profileLabels, useProfile } from '../context/ProfileContext';
import { useTable } from '../context/TableContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useNotifications } from '../context/NotificationContext';
import {
  SUBSCRIPTION_MANAGEMENT_LINK,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PRIVACY_LINK,
  SUBSCRIPTION_TERMS_LINK
} from '../constants/subscriptions';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { SupplyAudience } from '../types/profile';
import { deleteCurrentAccount } from '../services/accountService';

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
  const { profile, updateProfile, logout } = useProfile();
  const { table, supplierTables, refreshSupplierTables, loading: tablesLoading } = useTable();
  const {
    products: subscriptionProducts,
    loadingProducts: loadingSubscriptionProducts,
    purchaseInProgress,
    restoreInProgress,
    activeReceipt,
    error: subscriptionError,
    purchaseSubscription,
    restorePurchases,
    clearError,
    supported: subscriptionSupported
  } = useSubscription();
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
  const [locationStatus, setLocationStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [locationLoading, setLocationLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
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

  const subscriptionPlanOptions = useMemo(() => {
    const options: Array<{
      plan: (typeof SUBSCRIPTION_PLANS)[number];
      product: (typeof subscriptionProducts)[number];
    }> = [];
    SUBSCRIPTION_PLANS.forEach(plan => {
      const product = subscriptionProducts.find(item => item.productId === plan.productId);
      if (product) {
        options.push({ plan, product });
      }
    });
    return options;
  }, [subscriptionProducts]);

  const isSubscriptionLoading = loadingSubscriptionProducts;
  const isSubscriptionActive = Boolean(activeReceipt);
  const isPurchaseProcessing = purchaseInProgress;
  const isAnySubscriptionBusy = purchaseInProgress || restoreInProgress;

  useEffect(() => {
    if (subscriptionError) {
      Alert.alert('Assinatura', subscriptionError, [{ text: 'OK', onPress: clearError }]);
    }
  }, [subscriptionError, clearError]);

  const handleSubscribe = (productId: string) => {
    if (!subscriptionSupported) {
      Alert.alert('Assinatura', 'Instale o app em um build de desenvolvimento para concluir a assinatura.');
      return;
    }
    const hasProductAvailable = subscriptionPlanOptions.some(option => option.product.productId === productId);
    if (!hasProductAvailable) {
      Alert.alert('Assinatura', 'Produto não disponível no momento. Tente novamente mais tarde.');
      return;
    }
    void purchaseSubscription(productId);
  };

  const handleRestorePurchases = () => {
    if (!subscriptionSupported) {
      Alert.alert('Assinatura', 'Restaure suas compras em um build de desenvolvimento ou versão publicada.');
      return;
    }
    void restorePurchases();
  };

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

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        .then(granted => setLocationStatus(granted ? 'granted' : 'denied'))
        .catch(() => setLocationStatus('denied'));
    } else {
      setLocationStatus('unknown');
    }
  }, []);

  const handleLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        setLocationLoading(true);
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão de localização',
            message: 'Precisamos da sua localização para personalizar informações no aplicativo.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Agora não'
          }
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          setLocationStatus('granted');
          Alert.alert('Localização habilitada', 'Permissão concedida com sucesso.');
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setLocationStatus('denied');
          Alert.alert(
            'Permissão bloqueada',
            'Ajuste a permissão de localização nas configurações do sistema para ativá-la.'
          );
        } else {
          setLocationStatus('denied');
          Alert.alert('Permissão negada', 'Não foi possível ativar a localização.');
        }
      } catch (error) {
        setLocationStatus('denied');
        Alert.alert('Permissões', 'Não foi possível solicitar a permissão de localização.');
        console.warn('[Permissions] Request location failed', error);
      } finally {
        setLocationLoading(false);
      }
      return;
    }

    Alert.alert(
      'Ativar localização',
      'Abra as configurações do sistema para ajustar a permissão de localização.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abrir configurações',
          onPress: () => {
            void Linking.openSettings();
          }
        }
      ]
    );
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

  const handleOpenHelpCenter = () => {
    openExternalLink('https://carvaoconnect.com.br/ajuda');
  };

  const locationStatusLabel =
    locationStatus === 'granted'
      ? 'Ativada'
      : locationStatus === 'denied'
        ? 'Desativada'
        : 'Configurar no sistema';

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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                <View>
                  <Text style={styles.profileLabel}>Seu perfil</Text>
                  <Text style={styles.profileRole}>{profileLabels[profile.type]}</Text>
                  <Text style={styles.profileCompany}>{profile.company ?? 'Empresa não informada'}</Text>
                </View>
                <TouchableOpacity style={styles.editChip} onPress={() => setIsEditing(true)}>
                  <Ionicons color={colors.primary} name="create-outline" size={18} />
                  <Text style={styles.editChipText}>Editar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.profileDetails}>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>E-mail</Text>
                  <Text style={styles.detailValue}>{profile.email}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Responsável</Text>
                  <Text style={styles.detailValue}>{profile.contact ?? 'Não informado'}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Localização</Text>
                  <Text style={styles.detailValue}>{profile.location ?? 'Não informada'}</Text>
                </View>
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
            {isSupplierProfile ? (
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Text style={styles.subscriptionTitle}>Carvão Connect Pro</Text>
                  {isSubscriptionActive ? (
                    <View style={styles.subscriptionBadge}>
                      <Text style={styles.subscriptionBadgeText}>Ativa</Text>
                    </View>
                  ) : null}
                </View>
                {subscriptionSupported ? (
                  <>
                    <Text style={styles.subscriptionDescription}>
                      Escolha o plano ideal para fornecedores e desbloqueie alertas antecipados, relatórios exclusivos e
                      suporte dedicado.
                    </Text>
                    {isSubscriptionLoading ? (
                      <Text style={styles.subscriptionLoadingText}>Carregando planos...</Text>
                    ) : subscriptionPlanOptions.length > 0 ? (
                      subscriptionPlanOptions.map(({ plan, product }) => (
                        <View key={plan.productId} style={styles.subscriptionOption}>
                          <Text style={styles.subscriptionOptionTitle}>{plan.title}</Text>
                          <Text style={styles.subscriptionPrice}>{product.priceString ?? product.price}</Text>
                          <Text style={styles.subscriptionEquivalent}>{plan.equivalentPrice}</Text>
                          <Text style={styles.subscriptionOptionDescription}>{plan.description}</Text>
                          <PrimaryButton
                            label={plan.ctaLabel}
                            onPress={() => handleSubscribe(product.productId)}
                            disabled={isAnySubscriptionBusy || isSubscriptionActive}
                            loading={isPurchaseProcessing}
                          />
                        </View>
                      ))
                    ) : (
                      <Text style={styles.subscriptionUnavailable}>
                        Nenhum plano disponível. Confirme se as assinaturas já foram enviadas para revisão na App Store.
                      </Text>
                    )}
                    <View style={styles.subscriptionActions}>
                      <TouchableOpacity onPress={handleRestorePurchases} disabled={restoreInProgress}>
                        <Text style={[styles.subscriptionLink, restoreInProgress && styles.subscriptionLinkDisabled]}>
                          {restoreInProgress ? 'Restaurando...' : 'Restaurar compras'}
                        </Text>
                      </TouchableOpacity>
                      {isSubscriptionActive ? (
                        <TouchableOpacity onPress={() => openExternalLink(SUBSCRIPTION_MANAGEMENT_LINK)}>
                          <Text style={styles.subscriptionLink}>Gerenciar na loja</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.subscriptionLegal}>
                      Ao continuar você aceita os{' '}
                      <Text style={styles.subscriptionLink} onPress={() => openExternalLink(SUBSCRIPTION_TERMS_LINK)}>
                        Termos de serviço
                      </Text>{' '}
                      e a{' '}
                      <Text style={styles.subscriptionLink} onPress={() => openExternalLink(SUBSCRIPTION_PRIVACY_LINK)}>
                        Política de privacidade
                      </Text>
                      . A cobrança é renovada automaticamente ao final de cada período e você pode cancelar quando quiser nas
                      configurações da loja.
                    </Text>
                  </>
                ) : (
                  <Text style={styles.subscriptionDescription}>
                    Instale o app em um build de desenvolvimento ou publicação para visualizar e contratar planos.
                  </Text>
                )}
              </View>
            ) : null}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Atualizações das siderúrgicas</Text>
              <TouchableOpacity onPress={refreshSupplierTables} disabled={tablesLoading}>
                <Text style={[styles.refreshText, tablesLoading && styles.refreshTextDisabled]}>
                  {tablesLoading ? 'Atualizando...' : 'Atualizar'}
                </Text>
              </TouchableOpacity>
            </View>
            {tablesLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : supplierNotifications.length > 0 ? (
              supplierNotifications.map(notification => (
                <View key={notification.id} style={styles.notificationCard}>
                  <Text numberOfLines={2} style={styles.notificationMessage}>
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
                onPress={handleLocationPermission}
                disabled={locationLoading}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={18} color={colors.textPrimary} />
                <View style={styles.settingsOptionContent}>
                  <Text style={styles.settingsOptionText}>Localização</Text>
                  <Text style={styles.settingsOptionHint}>{locationStatusLabel}</Text>
                </View>
                {locationLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </TouchableOpacity>
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
    </View>
  );
};

const glassCard = {
  backgroundColor: colors.surface,
  borderRadius: spacing.xxl,
  padding: spacing.xl,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: 'rgba(15,23,42,0.1)',
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 1,
  shadowRadius: 32,
  elevation: 4
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
  subscriptionCard: {
    ...glassCard,
    gap: spacing.sm
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subscriptionBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2
  },
  subscriptionBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  subscriptionPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subscriptionEquivalent: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs
  },
  subscriptionDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  subscriptionLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic'
  },
  subscriptionOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.sm
  },
  subscriptionOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subscriptionOptionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  subscriptionUnavailable: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm
  },
  subscriptionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subscriptionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  },
  subscriptionLinkDisabled: {
    color: colors.textSecondary
  },
  subscriptionLegal: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18
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
    shadowColor: 'rgba(15,23,42,0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
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
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.md,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary
  },
  editChipText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13
  },
  profileDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  detailBlock: {
    flex: 1,
    minWidth: 160,
    gap: spacing.xs / 2
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  detailValue: {
    fontSize: 16,
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
    gap: spacing.sm
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
    shadowColor: 'rgba(15,23,42,0.15)',
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
