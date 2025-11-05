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
  Switch
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

const MessageBubble: React.FC<{ message: ConversationMessage; isOwn: boolean }> = ({ message, isOwn }) => (
  <View
    style={[
      styles.messageBubble,
      isOwn ? styles.messageBubbleOwn : styles.messageBubbleGuest,
      isOwn ? styles.messageBubbleOwnAlign : styles.messageBubbleGuestAlign
    ]}
  >
    <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : null]}>{message.body}</Text>
    <Text style={styles.messageTimestamp}>{formatTimestamp(message.sentAt)}</Text>
  </View>
);

export const ConversationDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<ConversationsStackParamList, 'ConversationDetail'>>();
  const { profile } = useProfile();
  const { conversationId } = route.params;
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
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
                {messages.length > 0 ? (
                  messages.map(message => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderEmail === profile.email}
                    />
                  ))
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
                {quickReplyConfig.options.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.quickReplyOption,
                      quickReplyConfig.tone === 'supplier' ? styles.quickReplyOptionSupplier : styles.quickReplyOptionSteel,
                      isSending ? styles.quickReplyOptionDisabled : null
                    ]}
                    disabled={isSending}
                    onPress={() => handleQuickReplyPress(option)}
                  >
                    <Text style={styles.quickReplyOptionTitle}>{option.title}</Text>
                    <Text style={styles.quickReplyOptionSubtitle} numberOfLines={1}>
                      {option.subtitle}
                    </Text>
                  </TouchableOpacity>
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
              autoCapitalize="sentences"
              autoCorrect
              trailing={
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={handleSendMessage}
                  disabled={!messageDraft.trim() || isSending}
                  style={[styles.sendButton, (!messageDraft.trim() || isSending) && styles.sendButtonDisabled]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={!messageDraft.trim() ? colors.textSecondary : colors.surface}
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  messagesWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: spacing.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)'
  },
  messagesContent: {
    gap: spacing.sm
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
    alignItems: 'stretch',
    paddingRight: spacing.md,
    paddingVertical: spacing.xs
  },
  quickReplyOption: {
    minWidth: 140,
    maxWidth: 220,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
    borderColor: 'rgba(148,163,184,0.4)'
  },
  quickReplyOptionSteel: {
    backgroundColor: 'rgba(59,130,246,0.08)'
  },
  quickReplyOptionSupplier: {
    backgroundColor: 'rgba(16,185,129,0.12)'
  },
  quickReplyOptionDisabled: {
    opacity: 0.6
  },
  quickReplyOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  quickReplyOptionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
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
    shadowColor: 'rgba(15,23,42,0.12)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6
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
    padding: spacing.md,
    borderRadius: spacing.xl,
    gap: spacing.xs
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)'
  },
  messageBubbleOwnAlign: {
    alignSelf: 'flex-end'
  },
  messageBubbleGuest: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  messageBubbleGuestAlign: {
    alignSelf: 'flex-start'
  },
  messageText: {
    fontSize: 15,
    color: colors.textPrimary
  },
  messageTextOwn: {
    color: colors.surface
  },
  messageTimestamp: {
    fontSize: 12,
    color: colors.textPrimary
  },
  composer: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md
  },
  composerInput: {
    minHeight: 48,
    maxHeight: 140,
    textAlignVertical: 'top'
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.6)'
  }
});
