import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Switch,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../context/ProfileContext';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme';
import { fetchMessages, sendMessage } from '../services/conversationService';
import { ConversationMessage } from '../types/conversation';
import { ConversationsStackParamList } from '../navigation/ConversationsStack';
import { useConversationRead } from '../context/ConversationReadContext';

const formatTimestamp = (value: string) => {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffMinutes < 1) {
    return 'Agora';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  return timestamp.toLocaleDateString('pt-BR');
};

const formatDateHeading = (value: string) => {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return '';
  }
  return timestamp.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const MessageBubble: React.FC<{ message: ConversationMessage; isOwn: boolean }> = ({ message, isOwn }) => (
  <View
    style={[
      styles.messageBubble,
      isOwn ? styles.messageBubbleOwn : styles.messageBubbleGuest,
      isOwn ? styles.messageBubbleOwnAlign : styles.messageBubbleGuestAlign
    ]}
  >
    <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : null]}>{message.body}</Text>
    <Text style={[styles.messageTimestamp, isOwn ? styles.messageTimestampOwn : null]}>
      {formatTimestamp(message.sentAt)}
    </Text>
  </View>
);

export const ConversationDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<ConversationsStackParamList, 'ConversationDetail'>>();
  const { profile } = useProfile();
  const { conversationId, steelEmail, counterpartName } = route.params;
  const { markConversationRead, setActiveConversation } = useConversationRead();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchMessages(conversationId);
    setMessages(data);
    const latestMessage = data[data.length - 1];
    await markConversationRead(conversationId, latestMessage?.sentAt);
    setIsLoading(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [conversationId, markConversationRead]);

  useEffect(() => {
    void loadMessages();
    setActiveConversation(conversationId);
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId, loadMessages, setActiveConversation]);

  type QuickReplyOption = {
    id: string;
    title: string;
    subtitle: string;
    message: string;
    editable?: boolean;
  };

  type QuickReplyConfig =
    | {
        options: QuickReplyOption[];
        tone: 'steel' | 'supplier';
      }
    | null;

  const quickReplyConfig: QuickReplyConfig = useMemo(() => {
    if (profile.type === 'steel') {
      return {
        options: [
          {
            id: 'offer-accepted',
            title: 'Oferta aceita!',
            subtitle: 'Enviar confirmação ao fornecedor',
            message: 'Oferta aceita!',
            editable: false
          },
          {
            id: 'documentation',
            title: 'Documentação',
            subtitle: 'Solicitar envio de documentos',
            message: `Para envio de documentação para elaboração de contrato e fornecimento de carvão.

Gentileza encaminhar no e-mail:
${profile.email}

Os principais documentos são:
- DCF
- DAE (TAXA FLORESTAL E EXPEDIENTE)
- COMPROVANTE PAGAMENTO DAE
- CAR
- MAPA
- ESCRITURA DO IMÓVEL
- SE ARRENDADO, ENVIAR CONTRATO DE ARRENDAMENTO
- SHAPEFILE.
- PROCURAÇÃO REGISTRADA EM CARTÓRIO PARA RECEBIMENTO EM NOME DE TERCEIROS.`
          }
        ],
        tone: 'steel' as const
      };
    }
    if (profile.type === 'supplier') {
      return {
        options: [
          {
            id: 'offer-sent',
            title: 'Oferta enviada!',
            subtitle: 'Avisar a siderúrgica sobre a oferta',
            message: 'Oferta enviada!',
            editable: false
          }
        ],
        tone: 'supplier' as const
      };
    }
    return null;
  }, [profile.type, profile.email]);

  const storageKey = useMemo(() => {
    if (!profile.email) {
      return null;
    }
    return `quick-reply-templates:${profile.email.toLowerCase()}:${profile.type}`;
  }, [profile.email, profile.type]);

  const [savedTemplates, setSavedTemplates] = useState<Record<string, string>>({});

  const sendMessageBody = useCallback(async (body: string) => {
    if (!profile.email || !body.trim()) {
      return;
    }
    try {
      setIsSending(true);
      await sendMessage({
        body: body.trim(),
        conversationId,
        senderEmail: profile.email,
        senderType: profile.type
      });
      await loadMessages();
    } finally {
      setIsSending(false);
    }
  }, [conversationId, loadMessages, profile.email, profile.type]);

  const handleSendMessage = useCallback(async () => {
    if (!messageDraft.trim()) {
      return;
    }
    await sendMessageBody(messageDraft);
    setMessageDraft('');
  }, [messageDraft, sendMessageBody]);

  const [selectedQuickReply, setSelectedQuickReply] = useState<QuickReplyOption | null>(null);
  const [quickReplyDraft, setQuickReplyDraft] = useState('');
  const [isQuickReplyModalVisible, setQuickReplyModalVisible] = useState(false);
  const [shouldSaveTemplate, setShouldSaveTemplate] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setSavedTemplates({});
      return;
    }
    const loadTemplates = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, string>;
          setSavedTemplates(parsed);
        } else {
          setSavedTemplates({});
        }
      } catch (error) {
        console.warn('[QuickReply] Failed to load templates', error);
        setSavedTemplates({});
      }
    };
    void loadTemplates();
  }, [storageKey]);

  const persistTemplates = useCallback(
    async (templates: Record<string, string>) => {
      if (!storageKey) {
        return;
      }
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(templates));
      } catch (error) {
        console.warn('[QuickReply] Failed to save templates', error);
      }
    },
    [storageKey]
  );

  const openQuickReplyModal = useCallback(
    (option: QuickReplyOption) => {
      setSelectedQuickReply(option);
      setQuickReplyDraft(savedTemplates[option.id] ?? option.message);
      setShouldSaveTemplate(Boolean(savedTemplates[option.id]));
      setQuickReplyModalVisible(true);
    },
    [savedTemplates]
  );

  const handleQuickReplyPress = useCallback(
    async (option: QuickReplyOption) => {
      if (option.editable === false) {
        await sendMessageBody(option.message);
        return;
      }
      openQuickReplyModal(option);
    },
    [openQuickReplyModal, sendMessageBody]
  );

  const closeQuickReplyModal = useCallback(() => {
    setSelectedQuickReply(null);
    setQuickReplyDraft('');
    setQuickReplyModalVisible(false);
  }, []);

  const handleSendQuickReply = useCallback(async () => {
    if (!quickReplyDraft.trim()) {
      return;
    }
    await sendMessageBody(quickReplyDraft);
    if (shouldSaveTemplate && selectedQuickReply) {
      setSavedTemplates(prev => {
        const next = { ...prev, [selectedQuickReply.id]: quickReplyDraft };
        void persistTemplates(next);
        return next;
      });
    }
    closeQuickReplyModal();
  }, [quickReplyDraft, closeQuickReplyModal, sendMessageBody, shouldSaveTemplate, selectedQuickReply, persistTemplates]);

  const timelineItems = useMemo(() => {
    const items: Array<
      | { type: 'date'; id: string; label: string }
      | { type: 'message'; id: string; payload: ConversationMessage }
    > = [];
    let lastDateKey: string | null = null;
    messages.forEach(message => {
      const dateKey = new Date(message.sentAt).toDateString();
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        items.push({
          type: 'date',
          id: `date-${dateKey}-${message.id}`,
          label: formatDateHeading(message.sentAt)
        });
      }
      items.push({ type: 'message', id: message.id, payload: message });
    });
    return items;
  }, [messages]);

  const handleShareDocuments = useCallback(() => {
    if (profile.type !== 'supplier') {
      return;
    }
    const counterpartLabel = counterpartName || steelEmail || 'siderúrgica';
    Alert.alert(
      'Compartilhar documentação',
      `Deseja compartilhar todos os seus documentos com ${counterpartLabel}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Compartilhar',
          style: 'default',
          onPress: () => {
            // TODO: integrar com compartilhamento real (document_shares) quando backend estiver disponível
            Alert.alert('Documentação compartilhada', `Disponibilizamos seus documentos para ${counterpartLabel}.`);
          }
        }
      ]
    );
  }, [counterpartName, profile.type, steelEmail]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior="padding"
          keyboardVerticalOffset={Platform.select({ ios: 80, android: 100 })}
        >
          <View style={styles.container}>
          <View style={styles.messagesWrapper}>
            {isLoading ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {timelineItems.length > 0 ? (
                  timelineItems.map(item =>
                    item.type === 'date' ? (
                      <View key={item.id} style={styles.dateDivider}>
                        <Text style={styles.dateDividerText}>{item.label}</Text>
                      </View>
                    ) : (
                      <MessageBubble
                        key={item.id}
                        message={item.payload}
                        isOwn={item.payload.senderEmail === profile.email}
                      />
                    )
                  )
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Sem mensagens</Text>
                    <Text style={styles.emptyText}>Envie a primeira mensagem para iniciar a conversa.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          {quickReplyConfig ? (
            <View style={styles.quickReplySection}>
              <Text style={styles.quickReplyLabel}>Envio rápido</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickReplyList}
              >
                {profile.type === 'supplier' ? (
                  <QuickActionButton
                    label="Compartilhar documentação"
                    subtitle="Enviar docs para esta siderúrgica"
                    active
                    onPress={handleShareDocuments}
                    disabled={isSending}
                  />
                ) : null}
                {quickReplyConfig.options.map(option => (
                  <QuickActionButton
                    key={option.id}
                    label={option.title}
                    subtitle={option.subtitle}
                    active={quickReplyConfig.tone === 'supplier'}
                    inactive={quickReplyConfig.tone !== 'supplier'}
                    onPress={() => handleQuickReplyPress(option)}
                    disabled={isSending}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.composer}>
            <TextField
              placeholder="Digite uma mensagem"
              value={messageDraft}
              onChangeText={setMessageDraft}
              multiline
              style={styles.composerInput}
              containerStyle={styles.composerInputContainer}
              autoCapitalize="sentences"
              autoCorrect
              trailing={
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleSendMessage}
                  disabled={!messageDraft.trim() || isSending}
                  style={[
                    styles.sendButton,
                    !messageDraft.trim() || isSending ? styles.sendButtonDisabled : styles.sendButtonReady
                  ]}
                >
                    {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={!messageDraft.trim() ? colors.textSecondary : '#FFFFFF'}
                    />
                  )}
                </TouchableOpacity>
              }
            />
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        visible={isQuickReplyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeQuickReplyModal}
      >
        <View style={styles.quickReplyModalBackdrop}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.quickReplyModalAvoider}
          >
            <ScrollView
              contentContainerStyle={styles.quickReplyModalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.quickReplyModalContent}>
                <Text style={styles.quickReplyModalTitle}>{selectedQuickReply?.title ?? 'Mensagem rápida'}</Text>
                <Text style={styles.quickReplyModalSubtitle}>
                  {selectedQuickReply?.subtitle ?? 'Personalize a mensagem antes de enviar.'}
                </Text>
                <TextField
                  multiline
                  style={styles.quickReplyModalInput}
                  value={quickReplyDraft}
                  onChangeText={setQuickReplyDraft}
                />
                <View style={styles.saveTemplateRow}>
                  <Text style={styles.saveTemplateLabel}>Salvar mensagem editada</Text>
                  <Switch
                    value={shouldSaveTemplate}
                    onValueChange={setShouldSaveTemplate}
                    trackColor={{ true: colors.primaryMuted, false: '#CBD5E1' }}
                    thumbColor={shouldSaveTemplate ? colors.primary : '#FFFFFF'}
                  />
                </View>
                <View style={styles.quickReplyModalActions}>
                  <TouchableOpacity onPress={closeQuickReplyModal}>
                    <Text style={styles.quickReplyModalCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <PrimaryButton
                    label="Enviar"
                    onPress={handleSendQuickReply}
                    disabled={!quickReplyDraft.trim() || isSending}
                    loading={isSending}
                  />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  keyboardAvoider: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  messagesWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2
  },
  messagesContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm
  },
  quickReplySection: {
    gap: spacing.xs
  },
  quickReplyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: spacing.xs
  },
  quickReplyList: {
    alignItems: 'center',
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm
  },
  quickActionButton: {
    minWidth: 100,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  quickActionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center'
  },
  quickReplyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  quickReplyModalAvoider: {
    flex: 1
  },
  quickReplyModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  quickReplyModalContent: {
    backgroundColor: colors.surface,
    borderRadius: spacing.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4
  },
  quickReplyModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  quickReplyModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  quickReplyModalInput: {
    minHeight: 160,
    maxHeight: 240,
    textAlignVertical: 'top'
  },
  saveTemplateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  saveTemplateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  quickReplyModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  quickReplyModalCancel: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  shareDocsButton: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 22,
    gap: spacing.xs
  },
  messageBubbleOwn: {
    backgroundColor: '#017BFF',
    borderWidth: 0
  },
  messageBubbleOwnAlign: {
    alignSelf: 'flex-end'
  },
  messageBubbleGuest: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1
  },
  messageBubbleGuestAlign: {
    alignSelf: 'flex-start'
  },
  messageText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22
  },
  messageTextOwn: {
    color: colors.surface
  },
  messageTimestamp: {
    fontSize: 11,
    color: 'rgba(15,23,42,0.45)'
  },
  messageTimestampOwn: {
    color: 'rgba(255,255,255,0.85)'
  },
  dateDivider: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs / 2
  },
  dateDividerText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  composer: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md
  },
  composerInputContainer: {
    borderRadius: spacing.xl,
    borderColor: '#D0D8E8',
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2
  },
  composerInput: {
    minHeight: 48,
    maxHeight: 140,
    textAlignVertical: 'top'
  },
  sendButton: {
    borderRadius: spacing.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonReady: {
    backgroundColor: '#58A6FF'
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.2)'
  }
});
type QuickActionButtonProps = {
  label: string;
  subtitle?: string;
  active?: boolean;
  inactive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  label,
  subtitle,
  active = false,
  inactive = false,
  disabled = false,
  onPress
}) => {
  const isActive = active && !inactive;
  const backgroundColor = isActive ? colors.primary : 'transparent';
  const borderColor = isActive ? colors.primary : '#D1D5DB';
  const textColor = isActive ? '#FFFFFF' : '#6B7280';

  return (
    <TouchableOpacity
      style={[
        styles.quickActionButton,
        {
          backgroundColor,
    borderColor
        },
        disabled && { opacity: 0.6 }
      ]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.quickActionLabel, { color: textColor }]} numberOfLines={2}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={[styles.quickActionSubtitle, { color: textColor }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};
