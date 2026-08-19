import { ReactNode, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { Label } from '@/components/ui';

export type SelectOption = { key: string; label: string; color?: string };

/**
 * Campo tipo "dropbox": fechado por padrão, mostra só o valor escolhido.
 * Substitui grade de chips sempre expandida (13+ categorias ocupando a tela
 * inteira) — abre um modal com a lista só quando o usuário toca.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecionar…',
}: {
  label?: string;
  value?: string;
  options: SelectOption[];
  onChange: (key: string) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);

  return (
    <View>
      {label ? <Label style={{ marginBottom: spacing.xs }}>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          height: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.surfaceAlt,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {selected?.color ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: selected.color }} />
        ) : null}
        <Text
          style={{ color: selected ? t.text : t.textMuted, fontSize: 15, flex: 1 }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>

      <SelectModal
        visible={open}
        onClose={() => setOpen(false)}
        options={options}
        selectedKey={value}
        onSelect={(k) => {
          onChange(k);
          setOpen(false);
        }}
      />
    </View>
  );
}

export function SelectModal({
  visible,
  onClose,
  options,
  selectedKey,
  onSelect,
  title,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  options: SelectOption[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  title?: string;
  footer?: ReactNode;
}) {
  const t = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '70%',
            paddingBottom: spacing.lg,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.border,
              alignSelf: 'center',
              marginTop: spacing.sm,
              marginBottom: spacing.xs,
            }}
          />
          {title ? (
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, padding: spacing.lg, paddingBottom: spacing.sm }}>
              {title}
            </Text>
          ) : null}
          <FlatList
            data={options}
            keyExtractor={(o) => o.key}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: item.key === selectedKey ? t.surfaceAlt : 'transparent',
                }}
              >
                {item.color ? (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                ) : null}
                <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{item.label}</Text>
                {item.key === selectedKey ? <Ionicons name="checkmark" size={18} color={t.primary} /> : null}
              </Pressable>
            )}
          />
          {footer}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
