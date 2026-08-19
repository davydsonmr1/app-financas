import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Label, Screen, TextField } from '@/components/ui';
import { createRecurrence, deactivateRecurrence, getCategories, getIncomesForUsers, getRecurrences, type Recurrence } from '@/lib/queries';
import { formatBRL, formatPct, incomeForRange } from '@/lib/dashboard-calc';
import { monthRange, todayISO } from '@/lib/period';
import type { Category } from '@/lib/types';

export default function RecorrentesScreen() {
  const t = useTheme();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();

  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [day, setDay] = useState('5');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [attributedTo, setAttributedTo] = useState<string | null>(session?.user.id ?? null);
  const [saving, setSaving] = useState(false);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const load = async () => {
    if (!activeSpace) return;
    const [recs, cats] = await Promise.all([getRecurrences(activeSpace.id), getCategories(activeSpace.id)]);
    setRecurrences(recs);
    setCategories(cats);
    if (!categoryId) setCategoryId(cats.find((c) => c.kind === 'expense')?.id);

    const sharingIds = members.filter((m) => m.share_income).map((m) => m.id);
    const incomes = sharingIds.length ? await getIncomesForUsers(sharingIds) : [];
    setMonthlyIncome(incomeForRange(incomes, monthRange(todayISO())));
  };

  useEffect(() => {
    load();
  }, [activeSpace, members]);

  const total = recurrences.reduce((s, r) => s + r.amount, 0);
  const pctOfIncome = monthlyIncome > 0 ? (total / monthlyIncome) * 100 : null;

  const attributionOptions = useMemo(() => {
    if (members.length <= 1) return [];
    const meFirst = [...members].sort((a, b) => (a.id === session?.user.id ? -1 : 1));
    return [
      ...meFirst.map((m) => ({ key: m.id, label: m.id === session?.user.id ? 'Eu' : m.display_name || 'Membro' })),
      { key: '__casa__', label: 'Casa' },
    ];
  }, [members, session]);

  const handleAdd = async () => {
    if (!activeSpace || !session || !categoryId) return;
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalized);
    const dayNum = parseInt(day, 10);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0 || !dayNum || dayNum < 1 || dayNum > 31) return;

    setSaving(true);
    try {
      await createRecurrence({
        space_id: activeSpace.id,
        created_by: session.user.id,
        attributed_to: attributedTo,
        category_id: categoryId,
        kind: 'expense',
        amount,
        description: name.trim(),
        payment_method: null,
        day_of_month: dayNum,
        start_date: todayISO(),
        end_date: null,
      });
      setName('');
      setAmountStr('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    await deactivateRecurrence(id);
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        <Card>
          <Label>Total em fixos</Label>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', marginTop: 4 }}>
            {formatBRL(total)}
          </Text>
          {pctOfIncome !== null ? (
            <Text style={{ color: t.warn, fontSize: 13, marginTop: 2 }}>
              {formatPct(pctOfIncome)} da renda já comprometido antes de gastar qualquer coisa
            </Text>
          ) : null}
        </Card>

        <View style={{ gap: spacing.sm }}>
          {recurrences.map((r) => (
            <View
              key={r.id}
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
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catById.get(r.category_id ?? '')?.color ?? '#94a3b8' }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{r.description}</Text>
                <Text style={{ color: t.textMuted, fontSize: 12 }}>
                  todo dia {r.day_of_month} · {catById.get(r.category_id ?? '')?.name ?? '—'}
                </Text>
              </View>
              <Text style={{ color: t.text, fontWeight: '600' }}>{formatBRL(r.amount)}</Text>
              <Ionicons name="close-circle-outline" size={20} color={t.negative} onPress={() => handleRemove(r.id)} />
            </View>
          ))}
        </View>

        <Card>
          <Label>Novo fixo</Label>
          <TextField label="Nome" value={name} onChangeText={setName} placeholder="ex: Aluguel, Netflix…" style={{ marginTop: spacing.sm }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <TextField label="Valor" value={amountStr} onChangeText={setAmountStr} keyboardType="decimal-pad" style={{ flex: 1 }} />
            <TextField label="Dia do mês" value={day} onChangeText={setDay} keyboardType="number-pad" style={{ width: 100 }} />
          </View>

          <Label style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>Categoria</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {categories.filter((c) => c.kind === 'expense').map((c) => (
              <Chip key={c.id} label={c.name} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>

          {attributionOptions.length > 0 ? (
            <>
              <Label style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>De quem é</Label>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {attributionOptions.map((opt) => (
                  <Chip
                    key={opt.key}
                    label={opt.label}
                    selected={(attributedTo ?? '__casa__') === opt.key}
                    onPress={() => setAttributedTo(opt.key === '__casa__' ? null : opt.key)}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Button title="Adicionar fixo" onPress={handleAdd} loading={saving} style={{ marginTop: spacing.md }} />
        </Card>

        <Body style={{ fontSize: 12, color: t.textMuted }}>
          Os lançamentos do mês são gerados automaticamente todo dia, de madrugada. Editar ou
          remover um fixo vale a partir de agora — os meses já lançados não mudam.
        </Body>
      </ScrollView>
    </Screen>
  );
}
