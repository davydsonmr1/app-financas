import { Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/theme';

export function Fab({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: t.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="add" size={30} color={t.onPrimary} />
    </Pressable>
  );
}
