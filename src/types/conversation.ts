import type { ProfileType } from './profile';

export type ConversationStatus = 'open' | 'closed';

export type ConversationPreview = {
  id: string;
  supplierEmail: string;
  steelEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderEmail: string;
  senderType: ProfileType;
  body: string;
  sentAt: string;
};

export type StartConversationPayload = {
  supplierEmail: string;
  steelEmail: string;
  initialMessage: string;
};

export type SendMessagePayload = {
  conversationId: string;
  senderEmail: string;
  senderType: ProfileType;
  body: string;
};
