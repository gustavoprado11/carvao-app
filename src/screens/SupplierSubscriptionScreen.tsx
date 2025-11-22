import React from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { SupplierSubscriptionPlans } from '../components/SupplierSubscriptionPlans';
import { useProfile } from '../context/ProfileContext';

export const SupplierSubscriptionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { logout } = useProfile();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <Text style={styles.kicker}>Documento aprovado</Text>
          <Text style={styles.title}>Escolha seu plano</Text>
          <Text style={styles.subtitle}>
            Agora é só contratar um plano Carvão Connect Pro para desbloquear as tabelas das siderúrgicas e iniciar novas
            conversas.
          </Text>
          <SupplierSubscriptionPlans containerStyle={styles.planCard} />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
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
    flex: 1,
    backgroundColor: 'transparent'
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  planCard: {
    marginTop: spacing.md
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    alignItems: 'center'
  },
  logoutText: {
    fontSize: 15,
    color: colors.textSecondary
  }
});
