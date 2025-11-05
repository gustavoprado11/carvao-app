import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://grndssjckedvtiskcefo.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdybmRzc2pja2VkdnRpc2tjZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDI1ODksImV4cCI6MjA3NjcxODU4OX0.L6_v2V_7K0H3z57CEtlxJIMcvUhQrviW8NmjFc8a9UI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
