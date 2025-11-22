import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import {
  SUBSCRIPTION_MANAGEMENT_LINK,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PRIVACY_LINK,
  SUBSCRIPTION_TERMS_LINK
} from '../constants/subscriptions';
import { useSubscription } from '../context/SubscriptionContext';
import { presentCodeRedemptionSheetIOS } from 'react-native-iap';

type Props = {
  appName?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

const formatBillingDate = (value?: number | null) => {
  if (!value) {
    return 'Disponível na loja';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Disponível na loja';
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export const SupplierSubscriptionPlans: React.FC<Props> = ({ appName, containerStyle }) => {
  const {
    products,
    supported,
    loadingProducts,
    purchaseInProgress,
    restoreInProgress,
    activeReceipt,
    activeSubscription,
    error,
    purchaseSubscription,
    restorePurchases,
    clearError
  } = useSubscription();
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [redeemInProgress, setRedeemInProgress] = useState(false);
  const resolvedAppName = appName ?? Constants?.expoConfig?.name ?? 'Carvão Connect';

  useEffect(() => {
    if (error) {
      Alert.alert('Assinatura', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const subscriptionPlanOptions = useMemo(() => {
    const options: Array<{
      plan: (typeof SUBSCRIPTION_PLANS)[number];
      product: (typeof products)[number];
    }> = [];
    SUBSCRIPTION_PLANS.forEach(plan => {
      const product = products.find(item => item.productId === plan.productId);
      if (product) {
        options.push({ plan, product });
      }
    });
    return options;
  }, [products]);

  const activeSubscriptionSummary = useMemo(() => {
    if (!activeSubscription) {
      return null;
    }
    const match = subscriptionPlanOptions.find(option => option.product.productId === activeSubscription.productId);
    if (!match) {
      return {
        productId: activeSubscription.productId,
        renewalDate: activeSubscription.renewalDate,
        product: undefined,
        plan: undefined
      };
    }
    return {
      productId: activeSubscription.productId,
      renewalDate: activeSubscription.renewalDate,
      product: match.product,
      plan: match.plan
    };
  }, [activeSubscription, subscriptionPlanOptions]);

  const isSubscriptionActive = Boolean(activeReceipt);
  const isSubscriptionLoading = loadingProducts;
  const isAnySubscriptionBusy = purchaseInProgress || restoreInProgress;

  const handleSubscribe = useCallback(
    (productId: string) => {
      if (!supported) {
        Alert.alert('Assinatura', 'Instale o app em um build de desenvolvimento para concluir a assinatura.');
        return;
      }
      const hasProductAvailable = subscriptionPlanOptions.some(option => option.product.productId === productId);
      if (!hasProductAvailable) {
        Alert.alert('Assinatura', 'Produto não disponível no momento. Tente novamente mais tarde.');
        return;
      }
      void purchaseSubscription(productId);
    },
    [purchaseSubscription, subscriptionPlanOptions, supported]
  );

  const handleRestorePurchases = useCallback(() => {
    if (!supported) {
      Alert.alert('Assinatura', 'Restaure suas compras em um build de desenvolvimento ou versão publicada.');
      return;
    }
    void restorePurchases();
  }, [restorePurchases, supported]);

  const handleRedeemCode = useCallback(async () => {
    if (Platform.OS === 'ios') {
      try {
        setRedeemInProgress(true);
        await presentCodeRedemptionSheetIOS();
      } catch (error) {
        Alert.alert('Resgatar código', 'Não foi possível abrir a tela de resgate agora.');
        console.warn('[Subscription] redeem code failed', error);
      } finally {
        setRedeemInProgress(false);
      }
      return;
    }
    void Linking.openURL('https://play.google.com/redeem');
  }, []);

  const openExternalLink = useCallback((url: string) => {
    void Linking.openURL(url);
  }, []);

  return (
    <View style={[styles.subscriptionCard, containerStyle]}>
      <View style={styles.subscriptionHeader}>
        <Text style={styles.subscriptionTitle}>Carvão Connect Pro</Text>
        {isSubscriptionActive ? (
          <View style={styles.subscriptionBadge}>
            <Text style={styles.subscriptionBadgeText}>Ativa</Text>
          </View>
        ) : null}
      </View>
      {supported ? (
        <>
          <Text style={styles.subscriptionDescription}>
            Escolha o plano ideal para fornecedores e desbloqueie alertas antecipados, relatórios exclusivos e suporte
            dedicado.
          </Text>
          {activeSubscriptionSummary ? (
            <View style={styles.subscriptionSummaryCard}>
              <Text style={styles.subscriptionSummaryLabel}>Sua assinatura</Text>
              <Text style={styles.subscriptionSummaryApp}>{resolvedAppName}</Text>
              <Text style={styles.subscriptionSummaryPlan}>
                {activeSubscriptionSummary.plan?.title ?? 'Plano ativo'}
              </Text>
              <Text style={styles.subscriptionSummaryPrice}>
                {activeSubscriptionSummary.product?.priceString ?? 'Valor disponível na loja'}{' '}
                {activeSubscriptionSummary.plan?.billingPeriodLabel ? (
                  <Text style={styles.subscriptionPricePeriod}>
                    {activeSubscriptionSummary.plan?.billingPeriodLabel}
                  </Text>
                ) : null}
              </Text>
              <Text style={styles.subscriptionSummaryNextBilling}>
                Próxima cobrança: {formatBillingDate(activeSubscriptionSummary.renewalDate)}
              </Text>
            </View>
          ) : null}
          {isSubscriptionLoading ? (
            <Text style={styles.subscriptionLoadingText}>Carregando planos...</Text>
          ) : subscriptionPlanOptions.length > 0 ? (
            <>
              {subscriptionPlanOptions
                .slice(0, activeSubscriptionSummary && !showAllPlans ? 1 : subscriptionPlanOptions.length)
                .map(({ plan, product }) => (
                  <View
                    key={plan.productId}
                    style={[
                      styles.subscriptionOption,
                      activeSubscriptionSummary?.productId === plan.productId && styles.subscriptionOptionActive
                    ]}
                  >
                    <Text style={styles.subscriptionOptionTitle}>{plan.title}</Text>
                    <Text style={styles.subscriptionPrice}>
                      {product.priceString ?? product.price}{' '}
                      <Text style={styles.subscriptionPricePeriod}>{plan.billingPeriodLabel}</Text>
                    </Text>
                    {plan.priceNote ? <Text style={styles.subscriptionEquivalent}>{plan.priceNote}</Text> : null}
                    <Text style={styles.subscriptionOptionDescription}>{plan.description}</Text>
                    <PrimaryButton
                      label={plan.ctaLabel}
                      onPress={() => handleSubscribe(product.productId)}
                      disabled={
                        isAnySubscriptionBusy ||
                        (isSubscriptionActive && plan.productId === activeSubscriptionSummary?.productId)
                      }
                      loading={purchaseInProgress}
                      style={styles.subscriptionButton}
                    />
                  </View>
                ))}
              {activeSubscriptionSummary && subscriptionPlanOptions.length > 1 ? (
                <TouchableOpacity
                  style={styles.togglePlansButton}
                  onPress={() => setShowAllPlans(prev => !prev)}
                >
                  <Text style={styles.togglePlansText}>
                    {showAllPlans ? 'Ocultar outros planos' : 'Ver todos os planos'}
                  </Text>
                  <Ionicons name={showAllPlans ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={styles.subscriptionUnavailable}>
              Nenhum plano disponível. Confirme se as assinaturas já foram enviadas para revisão na App Store.
            </Text>
          )}
          <View style={styles.subscriptionManagement}>
            <View style={styles.subscriptionManagementCard}>
              <TouchableOpacity
                style={styles.managementButton}
                onPress={() => openExternalLink(SUBSCRIPTION_MANAGEMENT_LINK)}
              >
                <Ionicons name='settings-outline' size={16} color={colors.primary} />
                <Text style={styles.managementButtonText}>Gerenciar assinatura</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.managementButton, Platform.OS !== 'ios' && styles.managementButtonLast]}
                onPress={handleRestorePurchases}
                disabled={restoreInProgress}
              >
                <Ionicons name='refresh-outline' size={16} color={colors.primary} />
                <Text
                  style={[styles.managementButtonText, restoreInProgress && styles.subscriptionLinkDisabled]}
                >
                  {restoreInProgress ? 'Restaurando...' : 'Restaurar compras'}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={[styles.managementButton, styles.managementButtonLast]}
                  onPress={handleRedeemCode}
                  disabled={redeemInProgress}
                >
                  <Ionicons name='gift-outline' size={16} color={colors.primary} />
                  <Text
                    style={[styles.managementButtonText, redeemInProgress && styles.subscriptionLinkDisabled]}
                  >
                    {redeemInProgress ? 'Abrindo...' : 'Resgatar código'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
  );
};

const styles = StyleSheet.create({
  subscriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subscriptionBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  subscriptionBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  subscriptionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  subscriptionSummaryCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E1E8FF',
    gap: spacing.xs
  },
  subscriptionSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  subscriptionSummaryApp: {
    fontSize: 13,
    color: colors.textSecondary
  },
  subscriptionSummaryPlan: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subscriptionSummaryPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary
  },
  subscriptionSummaryNextBilling: {
    fontSize: 13,
    color: colors.textSecondary
  },
  subscriptionLoadingText: {
    fontSize: 14,
    color: colors.textSecondary
  },
  subscriptionOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm
  },
  subscriptionOptionActive: {
    borderColor: colors.primary
  },
  subscriptionOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subscriptionPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subscriptionPricePeriod: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary
  },
  subscriptionEquivalent: {
    fontSize: 13,
    color: colors.textSecondary
  },
  subscriptionOptionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18
  },
  subscriptionButton: {
    marginTop: spacing.xs
  },
  subscriptionUnavailable: {
    fontSize: 13,
    color: colors.textSecondary
  },
  subscriptionManagement: {
    marginTop: spacing.sm
  },
  subscriptionManagementCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    overflow: 'hidden'
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  managementButtonLast: {
    borderBottomWidth: 0
  },
  managementButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  subscriptionLink: {
    color: colors.primary,
    fontWeight: '600'
  },
  subscriptionLinkDisabled: {
    color: colors.textSecondary
  },
  subscriptionLegal: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18
  },
  togglePlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  togglePlansText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
