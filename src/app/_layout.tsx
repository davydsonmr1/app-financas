import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SpaceProvider } from '@/lib/space-context';
import { useTheme } from '@/constants/theme';
import { startOfflineSyncWatcher } from '@/lib/offline-queue';
import { isBiometricEnabled } from '@/lib/biometric';
import { BiometricGate } from '@/components/biometric-gate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SpaceProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </SpaceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();

  const [locked, setLocked] = useState(false);

  useEffect(() => {
    startOfflineSyncWatcher();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inApp = segments[0] === '(app)';
    if (!session && inApp) router.replace('/login');
    if (session && (segments[0] === 'login' || (segments[0] as string) === 'signup')) router.replace('/(app)');
  }, [session, loading, segments, router]);

  const checkLock = useCallback(async () => {
    if (!session) return;
    const enabled = await isBiometricEnabled();
    if (enabled) setLocked(true);
  }, [session]);

  // Tranca ao entrar com sessão válida e sempre que o app volta do segundo
  // plano — não só uma vez no cold start. É o mesmo padrão de app de banco:
  // sair e voltar pede a digital de novo, não fica destravado pra sempre.
  useEffect(() => {
    checkLock();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkLock();
    });
    return () => sub.remove();
  }, [checkLock]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (session && locked) {
    return <BiometricGate onUnlock={() => setLocked(false)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen
        name="espacos"
        options={{ presentation: 'modal', headerShown: true, title: 'Meus espaços' }}
      />
      <Stack.Screen
        name="renda"
        options={{ presentation: 'modal', headerShown: true, title: 'Renda' }}
      />
      <Stack.Screen
        name="categorias"
        options={{ presentation: 'modal', headerShown: true, title: 'Categorias' }}
      />
      <Stack.Screen
        name="recorrentes"
        options={{ presentation: 'modal', headerShown: true, title: 'Fixos e assinaturas' }}
      />
      <Stack.Screen
        name="orcamentos"
        options={{ presentation: 'modal', headerShown: true, title: 'Orçamentos' }}
      />
      <Stack.Screen
        name="comparacao"
        options={{ presentation: 'modal', headerShown: true, title: 'Comparar meses' }}
      />
      <Stack.Screen
        name="transacao/[id]"
        options={{ presentation: 'modal', headerShown: true, title: 'Lançamento' }}
      />
    </Stack>
  );
}
