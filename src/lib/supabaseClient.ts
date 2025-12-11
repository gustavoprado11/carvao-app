import { createClient } from '@supabase/supabase-js';

// Expo/EAS usa EXPO_PUBLIC_* no bundle; mantemos fallback para NEXT_PUBLIC_* em dev.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// AsyncStorage só existe no React Native. No web/SSR usamos o storage padrão do supabase-js.
const resolveReactNativeStorage = () => {
  if (!isReactNative) {
    return undefined;
  }
  try {
    // require dinâmico evita que bundlers web incluam o módulo RN
    const module = require('@react-native-async-storage/async-storage');
    return module?.default ?? module;
  } catch (error) {
    console.warn('[Supabase] AsyncStorage não disponível; sessões não serão persistidas.', error);
    return undefined;
  }
};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Variáveis não configuradas. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_* em dev).'
  );
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
  auth: {
    storage: resolveReactNativeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // No web precisamos processar o hash da URL para login via links; no RN desabilitamos
    detectSessionInUrl: !isReactNative
  }
});
