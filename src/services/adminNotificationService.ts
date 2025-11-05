import { SUPABASE_ANON_KEY, supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types/profile';

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
