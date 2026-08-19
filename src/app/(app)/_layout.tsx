import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';
import { SpaceHeader } from '@/components/space-header';
import { Fab } from '@/components/fab';

export default function AppLayout() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Tabs
        screenOptions={{
          header: () => <SpaceHeader />,
          tabBarActiveTintColor: t.primary,
          tabBarInactiveTintColor: t.textMuted,
          tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="lancamentos"
          options={{
            title: 'Lançamentos',
            tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ia"
          options={{
            title: 'IA',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="sparkles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>

      <Fab
        onPress={() => router.push('/novo')}
        style={{ position: 'absolute', right: 20, bottom: 78 + insets.bottom * 0.4 }}
      />
    </View>
  );
}
