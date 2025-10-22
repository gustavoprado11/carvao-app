import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { profileLabels, useProfile } from '../context/ProfileContext';

type ProfileFormState = {
  email: string;
  company: string;
  contact: string;
};

const supplierActions = [
  { id: 'overview', title: 'Visão geral', description: 'Acompanhe pedidos ativos, alertas e oportunidades de cotação.' },
  { id: 'catalog', title: 'Catálogo de produtos', description: 'Atualize especificações, certificações e documentos técnicos.' },
  { id: 'analytics', title: 'Insights comerciais', description: 'Explore tendências de preço e volume para decisões rápidas.' }
];

const steelActions = [
  { id: 'pricing', title: 'Criar tabela de preços', description: 'Defina faixas de densidade, valores PF/PJ e descontos por lote.' },
  { id: 'suppliers', title: 'Gestão de fornecedores', description: 'Acompanhe avaliações, documentos e disponibilidade em tempo real.' },
  { id: 'performance', title: 'Indicadores de desempenho', description: 'Compare custos, lead time e SLA das rotas logísticas.' }
];

export const MenuScreen: React.FC = () => {
  const { profile, updateProfile, logout } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>({
    email: profile.email,
    company: profile.company ?? '',
    contact: profile.contact ?? ''
  });

  useEffect(() => {
    if (isEditing) {
      setForm({
        email: profile.email,
        company: profile.company ?? '',
        contact: profile.contact ?? ''
      });
    }
  }, [isEditing, profile]);

  const suggestions = useMemo(() => (profile.type === 'steel' ? steelActions : supplierActions), [profile.type]);

  const handleChange = (key: keyof ProfileFormState) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      Alert.alert('Atualização de perfil', 'Informe um e-mail corporativo válido.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        email: trimmedEmail,
        company: form.company.trim() || undefined,
        contact: form.contact.trim() || undefined
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Painel</Text>
          <Text style={styles.subtitle}>Gerencie seu perfil e acesse os atalhos mais usados.</Text>
        </View>

        <View style={styles.profileCard}>
          {isEditing ? (
            <>
              <Text style={styles.profileLabel}>Editar perfil</Text>
              <View style={styles.form}>
                <TextField
                  placeholder="E-mail corporativo"
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
              </View>
            </>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
            <Ionicons color={colors.accent} name="log-out-outline" size={18} />
            <Text style={styles.logoutText}>Sair do app</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardGroup}>
          {suggestions.map(item => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg
  },
  header: {
    gap: spacing.xs
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
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
  form: {
    gap: spacing.sm
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF1F2'
  },
  logoutText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 15
  },
  cardGroup: {
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
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
