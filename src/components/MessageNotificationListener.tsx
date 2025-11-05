import React, { useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useNotifications } from '../context/NotificationContext';
import { supabase } from '../lib/supabaseClient';
import { fetchConversationById } from '../services/conversationService';
import { fetchProfileByEmail } from '../services/profileService';
import { useConversationRead } from '../context/ConversationReadContext';

type MessagePayload = {
  id: string;
  conversation_id: string;
  sender_email: string;
  body: string;
  created_at: string;
};

export const MessageNotificationListener: React.FC = () => {
  const { profile } = useProfile();
  const { presentNotification, supported } = useNotifications();
  const { registerConversationUpdate } = useConversationRead();

  useEffect(() => {
    if (!profile.email || !supported) {
      return;
    }

    const channel = supabase
      .channel(`messages:notify:${profile.email}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages'
        },
        async payload => {
          const data = payload.new as MessagePayload | null;
          if (!data) {
            return;
          }

          const senderEmail = data.sender_email?.toLowerCase();
          const currentEmail = profile.email?.toLowerCase();

          if (senderEmail && currentEmail && senderEmail === currentEmail) {
            return;
          }

          const conversation = await fetchConversationById(data.conversation_id);
          if (!conversation) {
            return;
          }

          const isParticipant =
            conversation.supplierEmail === profile.email || conversation.steelEmail === profile.email;

          if (!isParticipant) {
            return;
          }

          const counterpartEmail =
            conversation.supplierEmail === profile.email ? conversation.steelEmail : conversation.supplierEmail;

          const counterpartProfile = await fetchProfileByEmail(counterpartEmail);
          registerConversationUpdate(conversation.id, data.created_at);
          const title =
            counterpartProfile?.company ??
            counterpartProfile?.contact ??
            counterpartEmail ??
            'Nova mensagem';

          const snippet = data.body.trim().slice(0, 140);

          await presentNotification({
            title,
            body: snippet.length > 0 ? snippet : 'Você recebeu uma nova mensagem.',
            data: {
              conversationId: conversation.id
            }
          });
        }
      );

    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[Notifications] Failed to subscribe to conversation messages');
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.email, presentNotification, registerConversationUpdate, supported]);

  return null;
};
