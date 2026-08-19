import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { useAuth } from '@/lib/auth-context';

export function SpaceHeader() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeSpace, spaces } = useSpace();
  const { profile } = useAuth();

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
            overflow: 'hidden',
          }}
        >
          {activeSpace?.photo_url ? (
            <Image source={{ uri: activeSpace.photo_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name={(activeSpace?.icon as any) ?? 'home'} size={17} color="#fff" />
          )}
        </View>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
          {activeSpace?.name ?? 'Carregando…'}
        </Text>
        {spaces.length > 1 ? (
          <Ionicons name="chevron-down" size={16} color={t.textMuted} />
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => router.push('/perfil' as any)}
        hitSlop={8}
        style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden' }}
      >
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Ionicons name="person-circle-outline" size={28} color={t.textMuted} />
        )}
      </Pressable>
    </View>
  );
}
