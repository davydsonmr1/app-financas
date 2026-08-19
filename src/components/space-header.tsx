import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';

export function SpaceHeader() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeSpace, spaces } = useSpace();

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Pressable
        onPress={() => router.push('/espacos')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: activeSpace?.color ?? t.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={(activeSpace?.icon as any) ?? 'home'} size={17} color="#fff" />
        </View>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
          {activeSpace?.name ?? 'Carregando…'}
        </Text>
        {spaces.length > 1 ? (
          <Ionicons name="chevron-down" size={16} color={t.textMuted} />
        ) : null}
      </Pressable>

      <Pressable onPress={() => router.push('/perfil' as any)} hitSlop={8}>
        <Ionicons name="person-circle-outline" size={26} color={t.textMuted} />
      </Pressable>
    </View>
  );
}
