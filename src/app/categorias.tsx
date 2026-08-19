import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Label, Screen, TextField } from '@/components/ui';
import { archiveCategory, createCategory, getCategories } from '@/lib/queries';
import type { Category, TransactionKind } from '@/lib/types';

const KIND_TABS: { key: TransactionKind; label: string }[] = [
  { key: 'expense', label: 'Despesas' },
  { key: 'income', label: 'Receitas' },
  { key: 'investment', label: 'Investimentos' },
];

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export default function CategoriasScreen() {
  const t = useTheme();
  const { activeSpace } = useSpace();
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeSpace) return;
    setCategories(await getCategories(activeSpace.id));
  };

  useEffect(() => {
    load();
  }, [activeSpace]);

  const filtered = categories.filter((c) => c.kind === kind);

  const handleAdd = async () => {
    if (!activeSpace || !newName.trim()) return;
    setSaving(true);
    try {
      await createCategory({
        space_id: activeSpace.id,
        name: newName.trim(),
        icon: 'pricetag',
        color: newColor,
        kind,
      });
      setNewName('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    await archiveCategory(id);
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {KIND_TABS.map((k) => (
            <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          {filtered.map((c) => (
            <View
              key={c.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }} />
              <Text style={{ color: t.text, flex: 1, fontSize: 14 }}>{c.name}</Text>
              <Ionicons name="archive-outline" size={18} color={t.textMuted} onPress={() => handleArchive(c.id)} />
            </View>
          ))}
        </View>

        <Card>
          <Label>Nova categoria</Label>
          <TextField
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome"
            style={{ marginTop: spacing.sm }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            {PALETTE.map((color) => (
              <View
                key={color}
                onTouchEnd={() => setNewColor(color)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: color,
                  borderWidth: newColor === color ? 3 : 0,
                  borderColor: t.text,
                }}
              />
            ))}
          </View>
          <Button title="Adicionar" onPress={handleAdd} loading={saving} style={{ marginTop: spacing.md }} />
        </Card>

        <Body style={{ fontSize: 12, color: t.textMuted }}>
          Categorias são específicas deste Espaço — criar ou arquivar aqui não afeta seus outros
          Espaços.
        </Body>
      </ScrollView>
    </Screen>
  );
}
