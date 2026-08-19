import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

// Fecha a aba do navegador do sistema sozinha quando o OAuth termina.
// Precisa ser chamado uma vez, fora de qualquer componente.
WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? error.message : null;
      },
      signUp: async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) return { error: error.message, needsEmailConfirmation: false };
        // Se a confirmação de e-mail estiver ligada no projeto, o Supabase
        // devolve o user mas SEM sessão — só loga depois que a pessoa clicar
        // no link do e-mail. Sem confirmação exigida, a sessão já vem pronta
        // e o RootNavigator redireciona sozinho (ver src/app/_layout.tsx).
        return { error: null, needsEmailConfirmation: !data.session };
      },
      signInWithGoogle: async () => {
        try {
          const redirectTo = Linking.createURL('auth-callback');
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error) return error.message;
          if (!data?.url) return 'Não foi possível iniciar o login com Google.';

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type === 'cancel' || result.type === 'dismiss') return null; // usuário cancelou, sem erro
          if (result.type !== 'success' || !('url' in result)) {
            return 'Login com Google não foi concluído.';
          }

          const code = new URL(result.url).searchParams.get('code');
          if (!code) return 'O Google não devolveu o código esperado.';

          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          return exchangeError ? exchangeError.message : null;
        } catch (e: any) {
          return e.message ?? 'Falha ao entrar com Google.';
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
