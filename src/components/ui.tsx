import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme, spacing, radius } from '@/constants/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.border,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: any }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 20, fontWeight: '700' }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: any }) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.textMuted, fontSize: 13, fontWeight: '500' }, style]}>{children}</Text>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: any }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 15 }, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg = {
    primary: t.primary,
    secondary: t.surfaceAlt,
    ghost: 'transparent',
    danger: t.negative,
  }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? t.onPrimary : t.text;
  const border = variant === 'ghost' ? t.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  style,
  ...props
}: TextInputProps & { label?: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={style}>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <TextInput
        placeholderTextColor={t.textMuted}
        style={[
          styles.input,
          { backgroundColor: t.surfaceAlt, color: t.text, borderColor: t.border },
        ]}
        {...props}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: selected ? (color ?? t.primary) : t.surfaceAlt,
        borderWidth: 1,
        borderColor: selected ? (color ?? t.primary) : t.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ color: selected ? '#fff' : t.text, fontWeight: '600', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.border }} />;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.xs }}>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 15, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: t.textMuted, fontSize: 13, textAlign: 'center' }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
});
