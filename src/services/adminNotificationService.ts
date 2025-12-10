import { SUPABASE_ANON_KEY, supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types/profile';
import { fetchProfilesByType } from './profileService';
import { fetchPushTokensByEmail } from './pushTokenService';
import { sendExpoPush } from './pushNotificationService';

export const notifySteelSignup = async (profile: UserProfile) => {
  try {
    const { error } = await supabase.functions.invoke('notify-new-steel', {
      body: {
        company: profile.company ?? null,
        contact: profile.contact ?? null,
        email: profile.email,
        location: profile.location ?? null
      },
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('[Notifications] Failed to notify admin about steel signup', error);
  }
};

export const notifyAdminsAboutProfileSignup = async (profile: UserProfile) => {
  try {
    const admins = await fetchProfilesByType('admin');
    if (!admins || admins.length === 0) {
      return;
    }

    const tokens = (
      await Promise.all(
        admins
          .map(admin => admin.email?.toLowerCase())
          .filter((email): email is string => Boolean(email))
          .map(async email => {
            const adminTokens = await fetchPushTokensByEmail(email);
            return adminTokens;
          })
      )
    )
      .flat()
      .filter(Boolean);

    if (tokens.length === 0) {
      return;
    }

    const title = 'Novo cadastro';
    const body =
      profile.type === 'steel'
        ? `Nova siderúrgica: ${profile.company ?? profile.email}`
        : `Novo fornecedor: ${profile.company ?? profile.email}`;

    await sendExpoPush(tokens, {
      title,
      body,
      data: { email: profile.email, type: profile.type }
    });
  } catch (error) {
    console.warn('[Notifications] Failed to notify admins about signup', error);
  }
};
