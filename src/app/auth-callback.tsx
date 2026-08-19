import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, spacing } from '@/constants/theme';
import { Button, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/**
 * Onde o login com Google aterrissa de volta no app.
 *
 * Não dá pra confiar só em `WebBrowser.openAuthSessionAsync` interceptar o
 * retorno (auth-context.tsx) — no Expo Go o app não tem o esquema próprio
 * `appfinancas://`, o redirect usa um endereço `exp://` dinâmico do servidor
 * de desenvolvimento, e nesse caso o retorno pode acabar caindo na navegação
 * normal do expo-router em vez de ser capturado pela sessão do navegador
 * (foi exatamente o que aconteceu — a URL chegou como "Unmatched Route").
 *
 * Esta tela é o caminho confiável: existe de verdade como rota, então
 * qualquer jeito do retorno chegar (interceptado ou como navegação comum)
 * termina aqui, lê o `code` e troca pela sessão.
 */
export default function AuthCallbackScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (params.error_description) {
        setError(decodeURIComponent(params.error_description));
        return;
      }
      if (!params.code) {
        setError('Retorno do Google incompleto — falta o código.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
      if (exchangeError) {
        // Se outra parte do app já trocou esse código (corrida com
        // WebBrowser.openAuthSessionAsync numa build nativa), a sessão já
        // existe — não é erro de verdade, ignora.
        const { data } = await supabase.auth.getSession();
        if (!data.session) setError(exchangeError.message);
      }
      // Sucesso: o RootNavigator (src/app/_layout.tsx) detecta a sessão e
      // redireciona pro app sozinho — não precisa navegar daqui.
    })();
  }, [params.code, params.error_description]);

  if (error) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ color: t.negative, fontSize: 15, textAlign: 'center' }}>{error}</Text>
          <Button title="Voltar para o login" onPress={() => router.replace('/login')} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={{ color: t.textMuted, fontSize: 13 }}>Finalizando login com Google…</Text>
      </View>
    </Screen>
  );
}
