import React, { useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useNotifications } from '../context/NotificationContext';
import { supabase } from '../lib/supabaseClient';

type PricingTablePayload = {
  id: string;
  owner_email: string;
  company?: string | null;
  updated_at: string;
};

/**
 * Listener para notificações de atualizações em tabelas de preços
 * Notifica fornecedores quando uma siderúrgica atualiza sua tabela
 */
export const TableNotificationListener: React.FC = () => {
  const { profile } = useProfile();
  const { presentNotification, supported } = useNotifications();

  useEffect(() => {
    // Só fornecedores recebem notificações de tabelas
    if (profile.type !== 'supplier' || !supported) {
      return;
    }

    const channel = supabase
      .channel(`pricing_tables:notify:${profile.email}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pricing_tables'
        },
        async payload => {
          const data = payload.new as PricingTablePayload | null;
          if (!data) {
            return;
          }

          // Verificar se a tabela está ativa
          const isActive = (payload.new as Record<string, unknown>).is_active;
          if (isActive === false) {
            return;
          }

          const companyName = data.company || 'Uma siderúrgica';

          await presentNotification({
            title: 'Tabela de preços atualizada',
            body: `${companyName} atualizou sua tabela de preços. Confira as novas condições!`,
            data: {
              type: 'table_update',
              tableId: data.id,
              ownerEmail: data.owner_email
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pricing_tables'
        },
        async payload => {
          const data = payload.new as PricingTablePayload | null;
          if (!data) {
            return;
          }

          const companyName = data.company || 'Uma siderúrgica';

          await presentNotification({
            title: 'Nova tabela de preços disponível',
            body: `${companyName} publicou sua tabela de preços. Confira as condições!`,
            data: {
              type: 'table_new',
              tableId: data.id,
              ownerEmail: data.owner_email
            }
          });
        }
      );

    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[Notifications] Failed to subscribe to pricing_tables');
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.email, profile.type, presentNotification, supported]);

  return null;
};
