import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SpaceProvider } from '@/lib/space-context';
import { useTheme } from '@/constants/theme';
import { startOfflineSyncWatcher } from '@/lib/offline-queue';

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

  useEffect(() => {
    startOfflineSyncWatcher();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inApp = segments[0] === '(app)';
    if (!session && inApp) router.replace('/login');
    if (session && segments[0] === 'login') router.replace('/(app)');
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="novo"
        options={{ presentation: 'modal', headerShown: true, title: 'Novo lançamento' }}
      />
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
        name="transacao/[id]"
        options={{ presentation: 'modal', headerShown: true, title: 'Lançamento' }}
      />
    </Stack>
  );
}
