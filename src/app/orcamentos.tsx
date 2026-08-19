import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Label, Screen, TextField } from '@/components/ui';
import { getBudgets, getCategories, getTransactions, upsertBudget, type Budget } from '@/lib/queries';
import { formatBRL } from '@/lib/dashboard-calc';
import { monthRange, todayISO } from '@/lib/period';
import type { Category } from '@/lib/types';

export default function OrcamentosScreen() {
  const t = useTheme();
  const { activeSpace } = useSpace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentByCategory, setSpentByCategory] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeSpace) return;
    const range = monthRange(todayISO());
    const [cats, b, txs] = await Promise.all([
      getCategories(activeSpace.id),
      getBudgets(activeSpace.id),
      getTransactions({ spaceId: activeSpace.id, from: range.from, to: range.to, kind: 'expense' }),
    ]);
    setCategories(cats.filter((c) => c.kind === 'expense'));
    setBudgets(b);
    const spent = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.category_id) continue;
      spent.set(tx.category_id, (spent.get(tx.category_id) ?? 0) + tx.effective_amount);
    }
    setSpentByCategory(spent);
  };

  useEffect(() => {
    load();
  }, [activeSpace]);

  const budgetByCategory = useMemo(() => new Map(budgets.map((b) => [b.category_id, b])), [budgets]);

  const handleSave = async (categoryId: string) => {
    if (!activeSpace) return;
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalized);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await upsertBudget({ space_id: activeSpace.id, category_id: categoryId, scope: 'space', attributed_to: null, amount });
      setEditing(null);
      setAmountStr('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
        <Body style={{ fontSize: 12, color: t.textMuted, marginBottom: spacing.xs }}>
          Defina um teto mensal por categoria. A barra muda de cor perto do limite.
        </Body>

        {categories.map((c) => {
          const budget = budgetByCategory.get(c.id);
          const spent = spentByCategory.get(c.id) ?? 0;
          const pct = budget ? Math.min(1, spent / budget.amount) : 0;
          const barColor = pct >= 1 ? t.negative : pct >= 0.8 ? t.warn : t.positive;

          return (
            <Card key={c.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                  <Text style={{ color: t.text, fontWeight: '600' }}>{c.name}</Text>
                </View>
                {budget ? (
                  <Text style={{ color: t.textMuted, fontSize: 13 }}>
                    {formatBRL(spent)} / {formatBRL(budget.amount)}
                  </Text>
                ) : null}
              </View>

              {budget ? (
                <View style={{ height: 8, backgroundColor: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: barColor, borderRadius: 4 }} />
                </View>
              ) : null}

              {editing === c.id ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <TextField value={amountStr} onChangeText={setAmountStr} keyboardType="decimal-pad" placeholder="0,00" style={{ flex: 1 }} autoFocus />
                  <Button title="OK" onPress={() => handleSave(c.id)} loading={saving} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row' }}>
                  <Chip
                    label={budget ? 'Alterar teto' : 'Definir teto'}
                    selected={false}
                    onPress={() => {
                      setEditing(c.id);
                      setAmountStr(budget ? String(budget.amount).replace('.', ',') : '');
                    }}
                  />
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
