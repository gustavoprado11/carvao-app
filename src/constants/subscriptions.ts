import { Platform } from 'react-native';

export type SubscriptionPlan = {
  productId: string;
  title: string;
  description: string;
  billingPeriodLabel: string;
  priceNote?: string;
  ctaLabel: string;
};

const IOS_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    productId: 'carvao_connect_monthly',
    title: 'Plano Mensal',
    description: 'Cobrança recorrente mensal, liberdade para cancelar quando quiser.',
    billingPeriodLabel: 'por mês',
    priceNote: 'Valor debitado mensalmente e renovado automaticamente.',
    ctaLabel: 'Assinar mensal'
  },
  {
    productId: 'carvao_connect_semiannual',
    title: 'Plano Semestral',
    description: 'Economize mantendo o acesso premium por 6 meses completos.',
    billingPeriodLabel: 'a cada 6 meses',
    priceNote: 'Equivalente a R$24,98 por mês. Cobrança de R$149,90 por ciclo.',
    ctaLabel: 'Assinar semestral'
  },
  {
    productId: 'carvao_connect_annual',
    title: 'Plano Anual',
    description: 'A melhor economia para fornecedores ativos o ano inteiro.',
    billingPeriodLabel: 'por ano',
    priceNote: 'Equivalente a R$20,82 por mês. Cobrança de R$249,90 ao ano.',
    ctaLabel: 'Assinar anual'
  }
];

const ANDROID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    productId: 'carvao_connect_monthly',
    title: 'Plano Mensal',
    description: 'Cobrança recorrente mensal, liberdade para cancelar quando quiser.',
    billingPeriodLabel: 'por mês',
    priceNote: 'Valor debitado mensalmente e renovado automaticamente.',
    ctaLabel: 'Assinar mensal'
  },
  {
    productId: 'carvao_connect_semiannual',
    title: 'Plano Semestral',
    description: 'Economize mantendo o acesso premium por 6 meses completos.',
    billingPeriodLabel: 'a cada 6 meses',
    priceNote: 'Equivalente a R$24,98 por mês. Cobrança de R$149,90 por ciclo.',
    ctaLabel: 'Assinar semestral'
  },
  {
    productId: 'carvao_connect_annual',
    title: 'Plano Anual',
    description: 'A melhor economia para fornecedores ativos o ano inteiro.',
    billingPeriodLabel: 'por ano',
    priceNote: 'Equivalente a R$20,82 por mês. Cobrança de R$249,90 ao ano.',
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
