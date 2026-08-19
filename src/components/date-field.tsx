import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { Button, Label, TextField } from '@/components/ui';
import { todayISO } from '@/lib/period';

export type DateMode = 'today' | 'yesterday' | 'custom';

function shiftDay(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPt(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Campo compacto de data — fechado por padrão, mostra só "Hoje" / "Ontem" / dd/mm/aaaa. */
export function DateField({
  mode,
  customDate,
  onChange,
  label = 'Data',
}: {
  mode: DateMode;
  customDate: string;
  onChange: (mode: DateMode, customDate: string) => void;
  label?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(customDate);

  const display = mode === 'today' ? 'Hoje' : mode === 'yesterday' ? 'Ontem' : formatPt(customDate);

  return (
    <View>
      <Label style={{ marginBottom: spacing.xs }}>{label}</Label>
      <Pressable
        onPress={() => {
          setDraftDate(customDate);
          setOpen(true);
        }}
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
        <Ionicons name="calendar-outline" size={16} color={t.textMuted} />
        <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{display}</Text>
        <Ionicons name="chevron-down" size={18} color={t.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: t.border,
                alignSelf: 'center',
                marginBottom: spacing.sm,
              }}
            />
            <Option label="Hoje" active={mode === 'today'} onPress={() => { onChange('today', customDate); setOpen(false); }} />
            <Option label="Ontem" active={mode === 'yesterday'} onPress={() => { onChange('yesterday', customDate); setOpen(false); }} />
            <Option label="Outra data" active={mode === 'custom'} onPress={() => {}} noClose>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' }}>
                <TextField value={draftDate} onChangeText={setDraftDate} placeholder="aaaa-mm-dd" style={{ flex: 1 }} />
                <Button
                  title="OK"
                  variant="secondary"
                  onPress={() => {
                    onChange('custom', draftDate || todayISO());
                    setOpen(false);
                  }}
                />
              </View>
            </Option>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Option({
  label,
  active,
  onPress,
  noClose,
  children,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  noClose?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View>
      <Pressable
        onPress={noClose ? undefined : onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xs,
        }}
      >
        <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{label}</Text>
        {active ? <Ionicons name="checkmark" size={18} color={t.primary} /> : null}
      </Pressable>
      {children}
    </View>
  );
}
