import { supabase } from '@mobile/lib/supabaseClient';
import type { ProfileType } from '@mobile/types/profile';
import type {
  ConversationMessage,
  ConversationPreview,
  ConversationStatus,
  SendMessagePayload,
  StartConversationPayload
} from '@mobile/types/conversation';

type ConversationRecord = {
  id: string;
  supplier_email: string;
  steel_email: string;
  status: ConversationStatus;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

type MessageRecord = {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_type: ProfileType;
  body: string;
  created_at: string;
};

const CONVERSATIONS_TABLE = 'conversations';
const MESSAGES_TABLE = 'conversation_messages';

const mapConversation = (record: ConversationRecord): ConversationPreview => ({
  id: record.id,
  supplierEmail: record.supplier_email,
  steelEmail: record.steel_email,
  status: record.status ?? 'open',
  lastMessage: record.last_message ?? 'Sem mensagens ainda.',
  lastMessageAt: record.last_message_at ?? record.created_at
});

const mapMessage = (record: MessageRecord): ConversationMessage => ({
  id: record.id,
  conversationId: record.conversation_id,
  senderEmail: record.sender_email,
  senderType: record.sender_type,
  body: record.body,
  sentAt: record.created_at
});

export const fetchConversationsByProfile = async (
  email: string,
  profileType: ProfileType
): Promise<ConversationPreview[]> => {
  const normalizedEmail = email.toLowerCase();
  const filterColumn = profileType === 'supplier' ? 'supplier_email' : 'steel_email';

  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select('id, supplier_email, steel_email, status, last_message, last_message_at, created_at')
    .eq(filterColumn, normalizedEmail)
    .order('last_message_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('[Supabase] fetchConversationsByProfile failed', error);
    return [];
  }

  return (data as ConversationRecord[]).map(mapConversation);
};

const findConversation = async (
  supplierEmail: string,
  steelEmail: string
): Promise<ConversationRecord | null> => {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select('id, supplier_email, steel_email, status, last_message, last_message_at, created_at')
    .eq('supplier_email', supplierEmail)
    .eq('steel_email', steelEmail)
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] findConversation failed', error);
    return null;
  }

  return (data ?? null) as ConversationRecord | null;
};

const ensureConversation = async (
  supplierEmail: string,
  steelEmail: string
): Promise<ConversationRecord | null> => {
  const existing = await findConversation(supplierEmail, steelEmail);
  if (existing) {
    if (existing.status !== 'open') {
      await supabase.from(CONVERSATIONS_TABLE).update({ status: 'open' }).eq('id', existing.id);
    }
    return existing;
  }

  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .insert({
      supplier_email: supplierEmail,
      steel_email: steelEmail,
      status: 'open',
      last_message: null,
      last_message_at: null
    })
    .select('id, supplier_email, steel_email, status, last_message, last_message_at, created_at')
    .single();

  if (error || !data) {
    console.warn('[Supabase] ensureConversation insert failed', error);
    return null;
  }

  return data as ConversationRecord;
};

const updateConversationMetadata = async (conversationId: string, messageBody: string, messageCreatedAt: string) => {
  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({
      last_message: messageBody,
      last_message_at: messageCreatedAt,
      status: 'open'
    })
    .eq('id', conversationId);

  if (error) {
    console.warn('[Supabase] updateConversationMetadata failed', error);
  }
};

export const startConversation = async (payload: StartConversationPayload): Promise<ConversationPreview | null> => {
  const supplierEmail = payload.supplierEmail.toLowerCase();
  const steelEmail = payload.steelEmail.toLowerCase();
  const conversation = await ensureConversation(supplierEmail, steelEmail);

  if (!conversation) {
    return null;
  }

  await sendMessage({
    conversationId: conversation.id,
    senderEmail: supplierEmail,
    senderType: 'supplier',
    body: payload.initialMessage
  });

  return mapConversation({
    ...conversation,
    last_message: payload.initialMessage,
    last_message_at: new Date().toISOString()
  });
};

export const sendMessage = async (payload: SendMessagePayload): Promise<ConversationMessage | null> => {
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .insert({
      conversation_id: payload.conversationId,
      sender_email: payload.senderEmail.toLowerCase(),
      sender_type: payload.senderType,
      body: payload.body
    })
    .select('id, conversation_id, sender_email, sender_type, body, created_at')
    .single();

  if (error || !data) {
    console.warn('[Supabase] sendMessage failed', error);
    return null;
  }

  const message = mapMessage(data as MessageRecord);
  await updateConversationMetadata(payload.conversationId, payload.body, message.sentAt);
  return message;
};

export const fetchMessages = async (conversationId: string): Promise<ConversationMessage[]> => {
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('id, conversation_id, sender_email, sender_type, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.warn('[Supabase] fetchMessages failed', error);
    return [];
  }

  return (data as MessageRecord[]).map(mapMessage);
};

export const fetchConversationById = async (conversationId: string): Promise<ConversationPreview | null> => {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select('id, supplier_email, steel_email, status, last_message, last_message_at, created_at')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] fetchConversationById failed', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapConversation(data as ConversationRecord);
};
