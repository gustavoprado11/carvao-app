'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, UserPlus } from 'lucide-react';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/providers/AuthProvider';
import {
  fetchConversationsByProfile,
  fetchMessages,
  sendMessage,
  startConversation
} from '../../../src/services/conversationService';
import { fetchProfileByEmail, fetchSteelProfilesByStatus } from '@mobile/services/profileService';
import type { ConversationMessage, ConversationPreview } from '@mobile/types/conversation';
import type { UserProfile } from '@mobile/types/profile';

export default function ConversationsPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [newConversationPartner, setNewConversationPartner] = useState<string>('');
  const [initialMessage, setInitialMessage] = useState('');
  const [starting, setStarting] = useState(false);
  const [counterparts, setCounterparts] = useState<Record<string, UserProfile>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find(conv => conv.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    const load = async () => {
      if (!profile?.email) {
        setLoading(false);
        return;
      }
      const data = await fetchConversationsByProfile(profile.email, profile.type);
      setConversations(data);
      setSelectedId(data[0]?.id ?? null);
      setLoading(false);
    };
    void load();
  }, [profile]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      const items = await fetchMessages(selectedId);
      setMessages(items);
    };
    void loadMessages();
  }, [selectedId]);

  useEffect(() => {
    // Scroll to the latest message (or last preview) whenever messages update
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [messages, selectedConversation?.lastMessageAt]);

  useEffect(() => {
    if (profile?.type === 'supplier') {
      fetchSteelProfilesByStatus('approved').then(setPartners);
    }
  }, [profile?.type]);

  useEffect(() => {
    const loadCounterparts = async () => {
      if (!profile) {
        setCounterparts({});
        return;
      }
      const emails = Array.from(
        new Set(
          conversations
            .map(conv => (profile.type === 'supplier' ? conv.steelEmail : conv.supplierEmail))
            .filter(Boolean) as string[]
        )
      );
      if (!emails.length) {
        setCounterparts({});
        return;
      }
      const entries = await Promise.all(
        emails.map(async email => {
          const profileData = await fetchProfileByEmail(email);
          return { email, profile: profileData };
        })
      );
      const map: Record<string, UserProfile> = {};
      entries.forEach(entry => {
        if (entry.profile) {
          map[entry.email.toLowerCase()] = entry.profile;
        }
      });
      setCounterparts(map);
    };
    void loadCounterparts();
  }, [conversations, profile]);

  const counterpart = useMemo(() => {
    if (!profile || !selectedConversation) return '';
    const email =
      profile.type === 'supplier'
        ? selectedConversation.steelEmail
        : selectedConversation.supplierEmail;
    const profileData = email ? counterparts[email.toLowerCase()] : undefined;
    return profileData?.company || profileData?.contact || email || '';
  }, [counterparts, profile, selectedConversation]);

  const handleSend = async () => {
    if (!profile || !selectedConversation || !newMessage.trim()) return;
    setSending(true);
    try {
      const message = await sendMessage({
        conversationId: selectedConversation.id,
        senderEmail: profile.email,
        senderType: profile.type,
        body: newMessage.trim()
      });
      if (message) {
        setMessages(prev => [...prev, message]);
        setNewMessage('');
      }
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!profile || !newConversationPartner || !initialMessage.trim()) return;
    setStarting(true);
    try {
      const created = await startConversation({
        supplierEmail: profile.email,
        steelEmail: newConversationPartner,
        initialMessage: initialMessage.trim()
      });
      if (created) {
        setConversations(prev => [created, ...prev]);
        setSelectedId(created.id);
        setInitialMessage('');
      }
    } finally {
      setStarting(false);
    }
  };

  if (!profile) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card title="Conversas">
        {profile.type === 'supplier' ? (
          <div className="mb-4 space-y-2 rounded-2xl bg-brand-50 p-3 text-sm text-brand-800">
            <div className="flex items-center gap-2 font-semibold">
              <UserPlus className="h-4 w-4" />
              Nova conversa com siderúrgica
            </div>
            <select
              value={newConversationPartner}
              onChange={e => setNewConversationPartner(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione uma siderúrgica aprovada</option>
              {partners.map(partner => (
                <option key={partner.email} value={partner.email}>
                  {partner.company ?? partner.email}
                </option>
              ))}
            </select>
            <textarea
              value={initialMessage}
              onChange={e => setInitialMessage(e.target.value)}
              placeholder="Mensagem inicial"
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm"
            />
            <Button variant="outline" loading={starting} onClick={handleStartConversation}>
              Iniciar conversa
            </Button>
          </div>
        ) : null}

        {conversations.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhuma conversa encontrada.</p>
        ) : (
          <div className="space-y-2">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedId === conv.id ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white/70'
                }`}
              >
                <p className="font-semibold">
                  {(() => {
                    const email = profile.type === 'supplier' ? conv.steelEmail : conv.supplierEmail;
                    const profileData = email ? counterparts[email.toLowerCase()] : undefined;
                    return profileData?.company || profileData?.contact || email;
                  })()}
                </p>
                <p className="text-xs text-ink-500" title={conv.lastMessage}>
                  {conv.lastMessage}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title={counterpart || 'Mensagens'}>
        {selectedConversation ? (
          <div className="flex h-[520px] flex-col gap-3">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {messages.length === 0 ? (
                selectedConversation?.lastMessage ? (
                  <div className="max-w-[80%] rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                    <p>{selectedConversation.lastMessage}</p>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {new Date(selectedConversation.lastMessageAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">Envie uma mensagem para começar.</p>
                )
              ) : (
                messages.map(message => {
                  const isMine = message.senderEmail?.toLowerCase() === profile.email?.toLowerCase();
                  return (
                    <div
                      key={message.id}
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm ${
                        isMine ? 'ml-auto bg-brand-600 text-white' : 'mr-auto bg-white'
                      }`}
                    >
                      <p>{message.body}</p>
                      <p className="mt-1 text-[10px] opacity-80">
                        {new Date(message.sentAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="h-20 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Escreva sua mensagem"
              />
              <Button onClick={handleSend} loading={sending} className="h-10 px-3">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">Selecione uma conversa para visualizar.</p>
        )}
      </Card>
    </div>
  );
}
