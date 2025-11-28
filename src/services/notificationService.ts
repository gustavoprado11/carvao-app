import { supabase } from '../lib/supabaseClient';

export type Notification = {
  id: string;
  recipientEmail: string;
  type: 'table_modified_by_admin' | 'other';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

type NotificationRecord = {
  id: string;
  recipient_email: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

const mapNotificationRecord = (record: NotificationRecord): Notification => ({
  id: record.id,
  recipientEmail: record.recipient_email,
  type: record.type as Notification['type'],
  title: record.title,
  message: record.message,
  data: record.data ?? undefined,
  read: record.read,
  createdAt: record.created_at
});

/**
 * Busca notificações do usuário
 */
export const fetchUserNotifications = async (email: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_email', email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[Supabase] fetchUserNotifications failed', error);
    return [];
  }

  return (data as NotificationRecord[]).map(mapNotificationRecord);
};

/**
 * Marca notificação como lida
 */
export const markNotificationAsRead = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) {
    console.warn('[Supabase] markNotificationAsRead failed', error);
    return false;
  }

  return true;
};

/**
 * Conta notificações não lidas
 */
export const getUnreadNotificationCount = async (email: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_email', email.toLowerCase())
    .eq('read', false);

  if (error) {
    console.warn('[Supabase] getUnreadNotificationCount failed', error);
    return 0;
  }

  return count ?? 0;
};

/**
 * Marca todas notificações como lidas
 */
export const markAllNotificationsAsRead = async (email: string): Promise<boolean> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_email', email.toLowerCase())
    .eq('read', false);

  if (error) {
    console.warn('[Supabase] markAllNotificationsAsRead failed', error);
    return false;
  }

  return true;
};
