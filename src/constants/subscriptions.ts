import { Platform } from 'react-native';

export type SubscriptionPlan = {
  productId: string;
  title: string;
  description: string;
  equivalentPrice: string;
  ctaLabel: string;
};

const IOS_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    productId: 'carvao_connect_monthly',
    title: 'Plano Mensal',
    description: 'Cobrança recorrente mensal, liberdade para cancelar quando quiser.',
    equivalentPrice: 'R$29,90 por mês',
    ctaLabel: 'Assinar mensal'
  },
  {
    productId: 'carvao_connect_semiannual',
    title: 'Plano Semestral',
    description: 'Economize mantendo o acesso premium por 6 meses completos.',
    equivalentPrice: 'Equivalente a R$24,98 por mês (cobrança de R$149,90 a cada 6 meses)',
    ctaLabel: 'Assinar semestral'
  },
  {
    productId: 'carvao_connect_annual',
    title: 'Plano Anual',
    description: 'A melhor economia para fornecedores ativos o ano inteiro.',
    equivalentPrice: 'Equivalente a R$20,82 por mês (cobrança de R$249,90 ao ano)',
    ctaLabel: 'Assinar anual'
  }
];

const ANDROID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    productId: 'carvao_connect_monthly',
    title: 'Plano Mensal',
    description: 'Cobrança recorrente mensal, liberdade para cancelar quando quiser.',
    equivalentPrice: 'R$29,90 por mês',
    ctaLabel: 'Assinar mensal'
  },
  {
    productId: 'carvao_connect_semiannual',
    title: 'Plano Semestral',
    description: 'Economize mantendo o acesso premium por 6 meses completos.',
    equivalentPrice: 'Equivalente a R$24,98 por mês (cobrança de R$149,90 a cada 6 meses)',
    ctaLabel: 'Assinar semestral'
  },
  {
    productId: 'carvao_connect_annual',
    title: 'Plano Anual',
    description: 'A melhor economia para fornecedores ativos o ano inteiro.',
    equivalentPrice: 'Equivalente a R$20,82 por mês (cobrança de R$249,90 ao ano)',
    ctaLabel: 'Assinar anual'
  }
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] =
  Platform.select({
    ios: IOS_SUBSCRIPTION_PLANS,
    android: ANDROID_SUBSCRIPTION_PLANS,
    default: []
  }) ?? [];

export const SUBSCRIPTION_PRODUCT_IDS = SUBSCRIPTION_PLANS.map(plan => plan.productId);

export const SUBSCRIPTION_TERMS_LINK = 'https://carvaoconnect.com.br/termos';
export const SUBSCRIPTION_PRIVACY_LINK = 'https://carvaoconnect.com.br/privacidade';

export const SUBSCRIPTION_MANAGEMENT_LINK = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: 'https://support.apple.com/billing'
}) as string;
