import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProfile } from '../context/ProfileContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { colors, spacing } from '../theme';
import { fetchProfilesByType, fetchSupplierProfilesByEmails } from '../services/profileService';
import { fetchConversationsByProfile, startConversation } from '../services/conversationService';
import type { ConversationPreview } from '../types/conversation';
import type { UserProfile } from '../types/profile';
import type { ConversationsStackParamList } from '../navigation/ConversationsStack';
import { useConversationRead } from '../context/ConversationReadContext';
import { useSubscription } from '../context/SubscriptionContext';
import type { MainTabParamList } from '../navigation/MainTabs';

const formatTimestamp = (value: string) => {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return '';
  }

  const now = new Date();
  const isToday =
    timestamp.getDate() === now.getDate() &&
    timestamp.getMonth() === now.getMonth() &&
    timestamp.getFullYear() === now.getFullYear();

  if (isToday) {
    return timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) {
    return 'Ontem';
  }

  return timestamp.toLocaleDateString('pt-BR');
};

const ConversationCard: React.FC<{
  item: ConversationPreview;
  counterpartName: string;
  onPress: () => void;
  unread: boolean;
  supplyAudienceLabel?: string;
  supplyDensity?: string;
  supplyVolume?: string;
}> = ({ item, counterpartName, onPress, unread, supplyAudienceLabel, supplyDensity, supplyVolume }) => {
  const initials = useMemo(() => {
    const parts = counterpartName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length === 0) {
      return 'CC';
    }
    return parts.map(part => part[0]?.toUpperCase() ?? '').join('');
  }, [counterpartName]);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {counterpartName}
          </Text>
          <View style={styles.metaColumn}>
            <Text style={styles.time}>{formatTimestamp(item.lastMessageAt)}</Text>
            {unread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>1</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text numberOfLines={2} style={styles.lastMessage}>
          {item.lastMessage}
        </Text>
        {supplyAudienceLabel || supplyDensity || supplyVolume ? (
          <View style={styles.supplyInfoContainer}>
            <View style={styles.supplyInfoMeta}>
              {supplyAudienceLabel ? (
                <Text style={styles.supplyInfoBadge}>{supplyAudienceLabel}</Text>
              ) : null}
              {supplyDensity ? (
                <Text style={styles.supplyInfoBadge}>{supplyDensity}</Text>
              ) : null}
              {supplyVolume ? (
                <Text style={styles.supplyInfoBadge}>{supplyVolume}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

export const ConversationsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ConversationsStackParamList>>();
  const { profile } = useProfile();
  const { isConversationUnread, recordConversationsSnapshot } = useConversationRead();
  const { activeReceipt } = useSubscription();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [steelPartners, setSteelPartners] = useState<UserProfile[]>([]);
  const [supplierPartners, setSupplierPartners] = useState<UserProfile[]>([]);
  const [isNewConversationVisible, setIsNewConversationVisible] = useState(false);
  const [selectedSteelEmail, setSelectedSteelEmail] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [isStartingConversation, setIsStartingConversation] = useState(false);

  const isSupplier = profile.type === 'supplier';
  const isSubscriptionActive = Boolean(activeReceipt);
  const shouldShowSubscriptionGate = isSupplier && !isSubscriptionActive;

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!profile.email) {
      setConversations([]);
      if (!silent) {
        setIsLoadingList(false);
      }
      return;
    }
    if (!silent) {
      setIsLoadingList(true);
    }
    try {
      const data = await fetchConversationsByProfile(profile.email, profile.type);
      setConversations(data);
      recordConversationsSnapshot(data);
    } finally {
      if (!silent) {
        setIsLoadingList(false);
      }
    }
  }, [profile.email, profile.type, recordConversationsSnapshot]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadConversations({ silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  React.useEffect(() => {
    const loadSteelPartners = async () => {
      if (profile.type !== 'supplier') {
        setSteelPartners([]);
        return;
      }
      const partners = await fetchProfilesByType('steel');
      const sorted = partners.slice().sort((a, b) => {
        const nameA = (a.company ?? a.contact ?? a.email).toLowerCase();
        const nameB = (b.company ?? b.contact ?? b.email).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setSteelPartners(sorted);
    };
    loadSteelPartners();
  }, [profile.type]);

  React.useEffect(() => {
    const loadSupplierPartners = async () => {
      if (profile.type !== 'steel') {
        setSupplierPartners([]);
        return;
      }
      const supplierEmails = Array.from(
        new Set(
          conversations
            .map(conversation => conversation.supplierEmail?.toLowerCase())
            .filter((value): value is string => Boolean(value))
        )
      );

      if (supplierEmails.length === 0) {
        setSupplierPartners([]);
        return;
      }

      const partners = await fetchSupplierProfilesByEmails(supplierEmails);
      const sorted = partners.slice().sort((a, b) => {
        const nameA = (a.company ?? a.contact ?? a.email).toLowerCase();
        const nameB = (b.company ?? b.contact ?? b.email).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setSupplierPartners(sorted);
    };

    loadSupplierPartners();
  }, [profile.type, conversations]);

  const findPartnerByEmail = useCallback((partners: UserProfile[], email: string) => {
    const normalizedEmail = email?.toLowerCase() ?? '';
    return partners.find(item => item.email?.toLowerCase() === normalizedEmail);
  }, []);

  const resolveCounterpartName = useCallback(
    (conversation: ConversationPreview): string => {
      const counterpartEmail =
        profile.type === 'supplier' ? conversation.steelEmail : conversation.supplierEmail;

      const formatFromProfile = (partner?: UserProfile) => {
        if (!partner) {
          return undefined;
        }
        const contact = (partner.contact ?? '').trim();
        const company = (partner.company ?? '').trim();
        if (contact && company) {
          return `${contact} | ${company}`;
        }
        if (contact) {
          return contact;
        }
        if (company) {
          return company;
        }
        return undefined;
      };

      if (profile.type === 'supplier') {
        const partner = findPartnerByEmail(steelPartners, counterpartEmail);
        const label = formatFromProfile(partner);
        if (label) {
          return label;
        }
      } else if (profile.type === 'steel') {
        const partner = findPartnerByEmail(supplierPartners, counterpartEmail);
        const label = formatFromProfile(partner);
        if (label) {
          return label;
        }
      }

      if (profile.type === 'steel') {
        return 'Fornecedor sem nome';
      }
      return counterpartEmail;
    },
    [profile.type, steelPartners, supplierPartners, findPartnerByEmail]
  );

  const resolveSupplyInfo = useCallback(
    (email: string) => {
      if (profile.type !== 'steel') {
        return { audienceLabel: undefined, density: undefined, volume: undefined };
      }
      const partner = findPartnerByEmail(supplierPartners, email);
      if (!partner) {
        return { audienceLabel: undefined, density: undefined, volume: undefined };
      }
      let audienceLabel: string | undefined;
      switch (partner.supplyAudience) {
        case 'pf':
          audienceLabel = 'Carvão PF';
          break;
        case 'pj':
          audienceLabel = 'Carvão PJ';
          break;
        case 'both':
          audienceLabel = 'Carvão PF e PJ';
          break;
        default:
          audienceLabel = undefined;
      }
      const density = partner.averageDensityKg ? `${partner.averageDensityKg} kg/m³` : undefined;
      const volume = partner.averageMonthlyVolumeM3 ? `${partner.averageMonthlyVolumeM3} m³/mês` : undefined;
      return { audienceLabel, density, volume };
    },
    [profile.type, supplierPartners, findPartnerByEmail]
  );

  const handleSelectConversation = (conversation: ConversationPreview) => {
    const counterpartName = resolveCounterpartName(conversation);
    navigation.navigate('ConversationDetail', {
      conversationId: conversation.id,
      supplierEmail: conversation.supplierEmail,
      steelEmail: conversation.steelEmail,
      counterpartName
    });
  };

  const buildIntroMessage = useCallback((partner: UserProfile) => {
    const contactName = partner.contact?.trim();
    if (contactName) {
      return `Olá, ${contactName}! Tenho interesse em fornecer carvão.`;
    }
    const companyName = partner.company?.trim();
    if (companyName) {
      return `Olá, equipe da ${companyName}! Tenho interesse em fornecer carvão.`;
    }
    return 'Olá! Tenho interesse em fornecer carvão.';
  }, []);

  const handleOpenNewConversation = () => {
    setSelectedSteelEmail(null);
    setInitialMessage('');
    setIsNewConversationVisible(true);
  };

  const handleStartConversation = async () => {
    if (!profile.email || !selectedSteelEmail || !initialMessage.trim()) {
      return;
    }
    try {
      setIsStartingConversation(true);
      const conversation = await startConversation({
        supplierEmail: profile.email,
        steelEmail: selectedSteelEmail,
        initialMessage: initialMessage.trim()
      });
      if (conversation) {
        const counterpartName = resolveCounterpartName(conversation);
        setIsNewConversationVisible(false);
        setInitialMessage('');
        setSelectedSteelEmail(null);
        await loadConversations();
        navigation.navigate('ConversationDetail', {
          conversationId: conversation.id,
          supplierEmail: conversation.supplierEmail,
          steelEmail: conversation.steelEmail,
          counterpartName
        });
      }
    } finally {
      setIsStartingConversation(false);
    }
  };

  const counterpartOptions = useMemo(() => {
    if (!isSupplier) {
      return [] as UserProfile[];
    }
    return steelPartners;
  }, [isSupplier, steelPartners]);

  const handleNavigateToPlans = () => {
    const parentNavigator = navigation.getParent<NavigationProp<MainTabParamList>>();
    parentNavigator?.navigate('Menu');
  };

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
                <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.subscriptionGateTitle}>Assine para conversar com as siderúrgicas</Text>
              <Text style={styles.subscriptionGateText}>
                Contrate o Carvão Connect Pro para liberar o envio de mensagens e receber atualizações das siderúrgicas
                em tempo real.
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
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.surface} />}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Conversas</Text>
            <Text style={styles.subtitle}>Mantenha o relacionamento ativo com mensagens objetivas.</Text>
            {isSupplier ? (
              <View style={styles.actionsRow}>
                <PrimaryButton label="Nova conversa" onPress={handleOpenNewConversation} />
              </View>
            ) : null}
          </View>

          <View style={styles.cardGroup}>
            {isLoadingList ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color={colors.surface} />
              </View>
            ) : conversations.length > 0 ? (
              conversations.map(conversation => {
                const counterpartName = resolveCounterpartName(conversation);
                const unread = isConversationUnread(conversation.id, conversation.lastMessageAt);
                const supplyInfo =
                  profile.type === 'steel'
                    ? resolveSupplyInfo(conversation.supplierEmail)
                    : { audienceLabel: undefined, density: undefined, volume: undefined };
                return (
                  <ConversationCard
                    key={conversation.id}
                    item={conversation}
                    counterpartName={counterpartName}
                    unread={unread}
                    supplyAudienceLabel={supplyInfo.audienceLabel}
                    supplyDensity={supplyInfo.density}
                    supplyVolume={supplyInfo.volume}
                    onPress={() => handleSelectConversation(conversation)}
                  />
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nenhuma conversa encontrada</Text>
                <Text style={styles.emptyText}>
                  {isSupplier
                    ? 'Inicie uma nova conversa com uma siderúrgica para aparecer aqui.'
                    : 'Aguarde o contato de um fornecedor para começar a conversa.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isNewConversationVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsNewConversationVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova conversa</Text>
            <Text style={styles.modalSubtitle}>Selecione uma siderúrgica e envie a primeira mensagem.</Text>
            <ScrollView style={styles.modalList}>
              {counterpartOptions.map(partner => {
                const isSelected = partner.email === selectedSteelEmail;
                return (
                  <TouchableOpacity
                    key={partner.email}
                    onPress={() => {
                      setSelectedSteelEmail(partner.email);
                      setInitialMessage(buildIntroMessage(partner));
                    }}
                    style={[styles.partnerRow, isSelected ? styles.partnerRowSelected : null]}
                  >
                    <Text style={styles.partnerName}>{partner.company ?? 'Siderúrgica parceira'}</Text>
                  </TouchableOpacity>
                );
              })}
              {counterpartOptions.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma siderúrgica disponível no momento.</Text>
              ) : null}
            </ScrollView>
            <TextField
              placeholder="Mensagem inicial"
              value={initialMessage}
              onChangeText={setInitialMessage}
              multiline
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsNewConversationVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <PrimaryButton
                label="Enviar mensagem"
                onPress={handleStartConversation}
                disabled={!selectedSteelEmail || !initialMessage.trim() || isStartingConversation}
                loading={isStartingConversation}
              />
            </View>
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
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
    gap: spacing.lg
  },
  subscriptionGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl
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
    gap: spacing.sm
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary
  },
  actionsRow: {
    marginTop: spacing.md,
    width: '100%'
  },
  cardGroup: {
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: 'rgba(15,23,42,0.08)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary
  },
  cardContent: {
    flex: 1,
    gap: spacing.xs
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  metaColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
    marginLeft: spacing.sm
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1
  },
  time: {
    fontSize: 13,
    color: colors.textSecondary
  },
  lastMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22
  },
  supplyInfoContainer: {
    gap: spacing.xs / 2
  },
  supplyInfoMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  supplyInfoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.lg,
    backgroundColor: colors.primaryMuted,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  unreadBadge: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
    height: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unreadBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600'
  },
  loadingWrapper: {
    paddingVertical: spacing.lg,
    alignItems: 'center'
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(15,23,42,0.1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary
  },
  modalSubtitle: {
    fontSize: 15,
    color: colors.textSecondary
  },
  modalList: {
    maxHeight: 200
  },
  modalInput: {
    minHeight: 80,
    maxHeight: 180,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cancelText: {
    fontSize: 16,
    color: colors.textSecondary
  },
  partnerRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  partnerRowSelected: {
    borderBottomColor: colors.primary
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  }
});
