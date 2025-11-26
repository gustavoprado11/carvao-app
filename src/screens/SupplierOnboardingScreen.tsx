import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { TextField } from '../components/TextField';
import { SegmentedControl } from '../components/SegmentedControl';
import { PrimaryButton } from '../components/PrimaryButton';
import { useProfile } from '../context/ProfileContext';
import type { SupplyAudience } from '../types/profile';
import { uploadSupplierDocument, type SupplierDocumentAsset } from '../services/documentService';

export type SupplierOnboardingStep = 'company' | 'production' | 'document';

type FormState = {
  company: string;
  contact: string;
  city: string;
  state: string;
  supplyAudience: SupplyAudience;
  averageDensityKg: string;
  averageMonthlyVolumeM3: string;
};

type Props = {
  onCompleted?: () => void;
  onCancel?: () => void;
  initialStep?: SupplierOnboardingStep;
};

const steps: SupplierOnboardingStep[] = ['company', 'production', 'document'];

const supplyOptions = [
  { label: 'PF', value: 'pf' as SupplyAudience },
  { label: 'PJ', value: 'pj' as SupplyAudience },
  { label: 'PF + PJ', value: 'both' as SupplyAudience }
];

export const SupplierOnboardingScreen: React.FC<Props> = ({ onCompleted, onCancel, initialStep }) => {
  const { profile, updateProfile, refreshProfile, logout } = useProfile();
  const [step, setStep] = useState<SupplierOnboardingStep>(initialStep ?? 'company');
  const [documentAsset, setDocumentAsset] = useState<SupplierDocumentAsset | null>(null);
  const [acceptedDeclaration, setAcceptedDeclaration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormState>(() => {
    const [city = '', state = ''] = (profile.location ?? '').split('/').map(part => part.trim());
    return {
      company: profile.company ?? '',
      contact: profile.contact ?? '',
      city,
      state,
      supplyAudience: profile.supplyAudience ?? 'both',
      averageDensityKg: profile.averageDensityKg ?? '',
      averageMonthlyVolumeM3: profile.averageMonthlyVolumeM3 ?? ''
    };
  });

useEffect(() => {
  const [city = '', state = ''] = (profile.location ?? '').split('/').map(part => part.trim());
  setForm(prev => ({
    ...prev,
    company: profile.company ?? '',
    contact: profile.contact ?? '',
    city,
    state,
    supplyAudience: profile.supplyAudience ?? 'both',
    averageDensityKg: profile.averageDensityKg ?? '',
    averageMonthlyVolumeM3: profile.averageMonthlyVolumeM3 ?? ''
  }));
}, [
  profile.company,
  profile.contact,
  profile.location,
  profile.supplyAudience,
  profile.averageDensityKg,
  profile.averageMonthlyVolumeM3
]);

useEffect(() => {
  if (initialStep) {
    setStep(initialStep);
  }
}, [initialStep]);

  const currentStepIndex = useMemo(() => steps.indexOf(step), [step]);

  const goToNextStep = () => {
    const currentIdx = steps.indexOf(step);
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIdx = steps.indexOf(step);
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    }
  };

  const handleFieldChange = (key: keyof FormState) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectAudience = (value: SupplyAudience) => {
    setForm(prev => ({ ...prev, supplyAudience: value }));
  };

  const pickDocument = useCallback(async () => {
    try {
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

      // Validação básica de tamanho (10MB) para evitar falhas no upload.
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (info.size && info.size > 10 * 1024 * 1024) {
        Alert.alert('Documento', 'O arquivo deve ter no máximo 10MB. Escolha um arquivo menor.');
        return;
      }

      setDocumentAsset({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf'
      });
    } catch (error) {
      Alert.alert('Documento', 'Não foi possível selecionar o arquivo agora. Tente novamente.');
      console.warn('[SupplierOnboarding] pickDocument failed', error);
    }
  }, []);

  const openLocalDocument = useCallback(
    (uri?: string) => {
      if (!uri) {
        return;
      }
      void Linking.openURL(uri);
    },
    []
  );

  const isCompanyStepValid = useMemo(() => {
    return Boolean(
      form.company.trim() &&
        form.contact.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.supplyAudience
    );
  }, [form]);

  const isProductionStepValid = useMemo(() => {
    return Boolean(form.averageDensityKg.trim() && form.averageMonthlyVolumeM3.trim());
  }, [form.averageDensityKg, form.averageMonthlyVolumeM3]);

const isDocumentStepValid = useMemo(() => {
  return Boolean(documentAsset && acceptedDeclaration);
}, [acceptedDeclaration, documentAsset]);

const persistSupplierDetails = useCallback(async () => {
  try {
    setIsPersisting(true);
    await updateProfile({
      company: form.company.trim(),
      contact: form.contact.trim(),
      location: `${form.city.trim()} / ${form.state.trim()}`,
      supplyAudience: form.supplyAudience,
      averageDensityKg: form.averageDensityKg.trim(),
      averageMonthlyVolumeM3: form.averageMonthlyVolumeM3.trim(),
      documentStatus: profile.documentStatus ?? 'missing'
    });
    return true;
  } catch (error) {
    Alert.alert('Cadastro', 'Não foi possível salvar seus dados agora. Tente novamente.');
    console.warn('[SupplierOnboarding] persistSupplierDetails failed', error);
    return false;
  } finally {
    setIsPersisting(false);
  }
}, [
  form.averageDensityKg,
  form.averageMonthlyVolumeM3,
  form.city,
  form.company,
  form.contact,
  form.state,
  form.supplyAudience,
  profile.documentStatus,
  updateProfile
]);

  const handleSubmit = async () => {
    if (isSubmitting || !documentAsset) {
      return;
    }
    try {
      setIsSubmitting(true);
      const uploadResult = await uploadSupplierDocument(profile, { ...documentAsset, typeId: 'dcf' });
      if (!uploadResult) {
        Alert.alert('Documento', 'Não foi possível enviar sua DCF. Verifique sua conexão e tente novamente.');
        return;
      }
      const now = new Date().toISOString();
      await updateProfile({
        company: form.company.trim(),
        contact: form.contact.trim(),
        location: `${form.city.trim()} / ${form.state.trim()}`,
        supplyAudience: form.supplyAudience,
        averageDensityKg: form.averageDensityKg.trim(),
        averageMonthlyVolumeM3: form.averageMonthlyVolumeM3.trim(),
        documentStatus: 'pending',
        documentUrl: uploadResult.publicUrl,
        documentStoragePath: uploadResult.path,
        documentUploadedAt: now,
        documentReviewNotes: undefined,
        documentReviewedAt: undefined,
        documentReviewedBy: undefined
      });
      await refreshProfile();
      Alert.alert(
        'Documento enviado',
        'Recebemos sua DCF e iniciaremos a verificação em instantes. Você será avisado assim que concluirmos.'
      );
      setDocumentAsset(null);
      setAcceptedDeclaration(false);
      onCompleted?.();
    } catch (error) {
      Alert.alert('Cadastro', 'Não foi possível enviar seus dados agora. Tente novamente em instantes.');
      console.warn('[SupplierOnboarding] submit failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

const handlePrimaryAction = async () => {
  if (step === 'company') {
    if (!isCompanyStepValid) {
      Alert.alert('Cadastro', 'Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }
    goToNextStep();
    return;
  }
  if (step === 'production') {
    if (!isProductionStepValid) {
      Alert.alert('Cadastro', 'Informe a densidade e o volume médio mensal.');
      return;
    }
    const saved = await persistSupplierDetails();
    if (saved) {
      goToNextStep();
    }
    return;
  }
  if (!isDocumentStepValid) {
    Alert.alert('Documento', 'Selecione o arquivo da DCF e confirme a declaração de veracidade.');
    return;
  }
  void handleSubmit();
};

  const renderCompanyStep = () => (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>Dados da empresa</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nome da empresa</Text>
        <TextField
          value={form.company}
          onChangeText={handleFieldChange('company')}
          placeholder="Ex: Carbono Verde Ltda."
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nome do responsável</Text>
        <TextField
          value={form.contact}
          onChangeText={handleFieldChange('contact')}
          placeholder="Quem responde pelo fornecimento"
        />
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Cidade</Text>
            <TextField
              value={form.city}
              onChangeText={handleFieldChange('city')}
              placeholder="Ex: Curvelo"
            />
          </View>
        </View>
        <View style={styles.stateField}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Estado</Text>
            <TextField
              value={form.state}
              onChangeText={handleFieldChange('state')}
              placeholder="MG"
              maxLength={2}
            />
          </View>
        </View>
      </View>
      <View style={styles.segmentWrapper}>
        <Text style={styles.segmentLabel}>Detalhes do fornecimento</Text>
        <SegmentedControl value={form.supplyAudience} onChange={handleSelectAudience} options={supplyOptions} />
      </View>
    </View>
  );

  const renderProductionStep = () => (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>Capacidade produtiva</Text>
      <Text style={styles.bodyText}>
        Informe os números que você já entrega regularmente. Isso ajuda as siderúrgicas a entenderem o seu potencial.
      </Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Densidade média do carvão (kg/m³)</Text>
        <TextField
          value={form.averageDensityKg}
          onChangeText={handleFieldChange('averageDensityKg')}
          keyboardType="numeric"
          placeholder="Ex: 220"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Volume médio mensal (m³)</Text>
        <TextField
          value={form.averageMonthlyVolumeM3}
          onChangeText={handleFieldChange('averageMonthlyVolumeM3')}
          keyboardType="numeric"
          placeholder="Ex: 950"
        />
      </View>
      <Text style={styles.helperText}>
        Use estimativas conservadoras. Caso seus números variem, considere a média dos últimos 3 meses.
      </Text>
    </View>
  );

  const renderDocumentStep = () => (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>Envie a DCF</Text>
      <Text style={styles.bodyText}>
        Aceitamos arquivos em PDF, JPG ou PNG com até 10MB. Certifique-se de que todas as páginas estejam legíveis.
      </Text>
      <TouchableOpacity style={styles.documentPicker} onPress={pickDocument}>
        <Ionicons name="document-attach-outline" size={22} color={colors.primary} />
        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle}>
            {documentAsset?.name ?? 'Selecionar DCF'}
          </Text>
          <Text style={styles.documentHint}>
            {documentAsset ? 'Arquivo carregado' : 'Toque para escolher o documento'}
          </Text>
        </View>
      </TouchableOpacity>
      {documentAsset ? (
        <TouchableOpacity style={styles.removeDocButton} onPress={() => setDocumentAsset(null)}>
          <Ionicons name="trash-outline" size={16} color={colors.accent} />
          <Text style={styles.removeDocText}>Remover arquivo</Text>
        </TouchableOpacity>
      ) : null}
      {documentAsset ? (
        <TouchableOpacity style={styles.previewButton} onPress={() => openLocalDocument(documentAsset.uri)}>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text style={styles.previewText}>Ver arquivo selecionado</Text>
        </TouchableOpacity>
      ) : profile.documentUrl ? (
        <TouchableOpacity style={styles.previewButton} onPress={() => openLocalDocument(profile.documentUrl)}>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text style={styles.previewText}>Ver último documento enviado</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.declarationRow}
        onPress={() => setAcceptedDeclaration(prev => !prev)}
      >
        <View style={[styles.checkbox, acceptedDeclaration && styles.checkboxChecked]}>
          {acceptedDeclaration ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <Text style={styles.declarationText}>
          Confirmo que a Declaração de Colheita de Florestas Plantadas enviada é verdadeira e está atualizada.
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'company':
        return renderCompanyStep();
      case 'production':
        return renderProductionStep();
      case 'document':
      default:
        return renderDocumentStep();
    }
  };

  const renderRejectedNote = () => {
    if (profile.documentStatus !== 'rejected' || !profile.documentReviewNotes) {
      return null;
    }
    return (
      <View style={styles.alertCard}>
        <Text style={styles.alertTitle}>O que precisa ser ajustado</Text>
        <Text style={styles.alertMessage}>{profile.documentReviewNotes}</Text>
      </View>
    );
  };

const actionLabel =
  step === 'document' ? (isSubmitting ? 'Enviando...' : 'Enviar para análise') : 'Continuar';
const isPrimaryActionLoading = step === 'document' ? isSubmitting : isPersisting;

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
          <Text style={styles.kicker}>Validação do fornecedor</Text>
          <Text style={styles.title}>Compartilhe suas informações</Text>
          <Text style={styles.subtitle}>
            Precisamos confirmar sua operação antes de liberar os planos e o acesso às siderúrgicas.
          </Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepIndicatorText}>
              Passo {currentStepIndex + 1} de {steps.length}
            </Text>
          </View>
          {renderRejectedNote()}
          {renderStepContent()}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.footerActions}>
            {step !== 'company' ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={goToPreviousStep}>
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Voltar</Text>
              </TouchableOpacity>
            ) : null}
            {onCancel ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
                <Text style={styles.secondaryButtonText}>Cancelar reenvio</Text>
              </TouchableOpacity>
            ) : null}
          </View>
  <PrimaryButton
    label={actionLabel}
    onPress={handlePrimaryAction}
    loading={isPrimaryActionLoading}
    disabled={isPrimaryActionLoading}
  />
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Sair do app</Text>
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
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  title: {
    ...typography.title,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  stepIndicator: {
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start'
  },
  stepIndicatorText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  bodyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  flex: {
    flex: 1
  },
  stateField: {
    width: 90
  },
  inputGroup: {
    gap: spacing.xs
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600'
  },
  segmentWrapper: {
    gap: spacing.xs
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  documentPicker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  previewText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600'
  },
  documentInfo: {
    flex: 1,
    gap: spacing.xs / 2
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  documentHint: {
    fontSize: 13,
    color: colors.textSecondary
  },
  removeDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  removeDocText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600'
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm
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
  declarationText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
    backgroundColor: 'transparent'
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary
  },
  logoutButton: {
    alignSelf: 'center'
  },
  logoutText: {
    fontSize: 15,
    color: colors.textSecondary
  },
  alertCard: {
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: '#F8CACA',
    backgroundColor: 'rgba(255, 109, 104, 0.1)',
    padding: spacing.md,
    gap: spacing.xs
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent
  },
  alertMessage: {
    fontSize: 13,
    color: colors.accent,
    lineHeight: 18
  }
});
