import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copie .env.example para .env.',
  );
}

/**
 * A anon key é pública por design — ela só é segura porque o RLS está correto.
 * Nenhuma outra credencial entra no bundle: a senha do banco fica nas migrations
 * e a chave do Groq mora na Edge Function.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE, não 'implicit' (o padrão da lib) — é o fluxo recomendado pra apps
    // mobile e o que o login com Google (auth-context.tsx) espera pra trocar
    // o código de autorização pela sessão via exchangeCodeForSession().
    flowType: 'pkce',
  },
});
