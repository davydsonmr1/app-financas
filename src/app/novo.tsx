import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Label, Screen, TextField } from '@/components/ui';
import { getCategories, createInstallments } from '@/lib/queries';
import { enqueueTransaction, generateId } from '@/lib/offline-queue';
import { todayISO } from '@/lib/period';
import { PAYMENT_LABELS, type Category, type PaymentMethod, type TransactionKind } from '@/lib/types';

const KIND_TABS: { key: TransactionKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'expense', label: 'Despesa', icon: 'arrow-up-circle' },
  { key: 'income', label: 'Receita', icon: 'arrow-down-circle' },
  { key: 'investment', label: 'Investimento', icon: 'trending-up' },
];

const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'debit', 'credit', 'cash', 'boleto'];

export default function NovoLancamentoScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { session, profile } = useAuth();
  const { activeSpace, members } = useSpace();

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [attributedTo, setAttributedTo] = useState<string | null>(session?.user.id ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);
  const [description, setDescription] = useState('');
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(todayISO());
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [installments, setInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSpace) getCategories(activeSpace.id).then(setCategories).catch(() => {});
  }, [activeSpace]);

  const categoriesForKind = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );

  useEffect(() => {
    if (categoryId && !categoriesForKind.find((c) => c.id === categoryId)) setCategoryId(undefined);
  }, [categoriesForKind, categoryId]);

  const occurredAt = useMemo(() => {
    if (dateMode === 'today') return todayISO();
    if (dateMode === 'yesterday') return shiftDay(todayISO(), -1);
    return customDate;
  }, [dateMode, customDate]);

  const amount = useMemo(() => {
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const attributionOptions = useMemo(() => {
    if (members.length <= 1) return [];
    const meFirst = [...members].sort((a, b) => (a.id === session?.user.id ? -1 : 1));
    return [
      ...meFirst.map((m) => ({ key: m.id, label: m.id === session?.user.id ? 'Eu' : m.display_name || 'Membro' })),
      { key: '__casa__', label: 'Casa' },
    ];
  }, [members, session]);

  const canSave = amount > 0 && !!categoryId && !!activeSpace && !!session && !saving;

  const handleSave = async () => {
    if (!canSave || !activeSpace || !session) return;
    setError(null);
    setSaving(true);
    try {
      if (kind === 'expense' && installments) {
        const n = parseInt(installmentCount, 10);
        if (!n || n < 2) {
          setError('Número de parcelas inválido.');
          setSaving(false);
          return;
        }
        await createInstallments({
          space_id: activeSpace.id,
          user_id: session.user.id,
          attributed_to: attributedTo,
          category_id: categoryId!,
          totalAmount: amount,
          installments: n,
          description,
          payment_method: payment,
          firstOccurredAt: occurredAt,
          makeId: generateId,
        });
      } else {
        const id = await generateId();
        await enqueueTransaction({
          id,
          space_id: activeSpace.id,
          user_id: session.user.id,
          attributed_to: kind === 'expense' || kind === 'investment' ? attributedTo : null,
          category_id: categoryId!,
          kind,
          amount,
          description,
          occurred_at: occurredAt,
          payment_method: kind === 'income' ? null : payment,
          installment_group_id: null,
          installment_no: null,
          installment_total: null,
          recurrence_id: null,
          competencia: null,
        });
      }
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        {/* Tipo */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {KIND_TABS.map((k) => (
            <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>

        {/* Valor — teclado numérico, foco imediato */}
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Label>Valor</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Text style={{ color: t.textMuted, fontSize: 22, marginRight: 4 }}>R$</Text>
            <TextField
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0,00"
              autoFocus
              style={{ minWidth: 140 }}
              // @ts-ignore - estilo de texto grande direto no input
              textAlign="left"
            />
          </View>
        </Card>

        {/* Atribuição */}
        {attributionOptions.length > 0 && kind !== 'income' ? (
          <View>
            <Label style={{ marginBottom: spacing.xs }}>De quem é esse {kind === 'expense' ? 'gasto' : 'aporte'}?</Label>
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
          </View>
        ) : null}

        {/* Categoria */}
        <View>
          <Label style={{ marginBottom: spacing.xs }}>Categoria</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {categoriesForKind.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </View>
        </View>

        {/* Data */}
        <View>
          <Label style={{ marginBottom: spacing.xs }}>Data</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Chip label="Hoje" selected={dateMode === 'today'} onPress={() => setDateMode('today')} />
            <Chip label="Ontem" selected={dateMode === 'yesterday'} onPress={() => setDateMode('yesterday')} />
            <Chip label="Escolher" selected={dateMode === 'custom'} onPress={() => setDateMode('custom')} />
          </View>
          {dateMode === 'custom' ? (
            <TextField
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="aaaa-mm-dd"
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>

        {/* Forma de pagamento */}
        {kind !== 'income' ? (
          <View>
            <Label style={{ marginBottom: spacing.xs }}>Forma de pagamento</Label>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map((p) => (
                <Chip key={p} label={PAYMENT_LABELS[p]} selected={payment === p} onPress={() => setPayment(p)} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Parcelamento */}
        {kind === 'expense' ? (
          <View>
            <Chip
              label={installments ? '✓ Parcelado' : 'Parcelar essa compra'}
              selected={installments}
              onPress={() => setInstallments((v) => !v)}
            />
            {installments ? (
              <TextField
                label="Número de parcelas"
                value={installmentCount}
                onChangeText={setInstallmentCount}
                keyboardType="number-pad"
                style={{ marginTop: spacing.sm, maxWidth: 120 }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Descrição */}
        <TextField
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          placeholder="ex: mercado do mês"
        />

        {error ? <Text style={{ color: t.negative, fontSize: 13 }}>{error}</Text> : null}
        {!categoryId && amount > 0 ? (
          <Body style={{ color: t.textMuted, fontSize: 12 }}>Escolha uma categoria para salvar.</Body>
        ) : null}

        <Button title="Salvar" onPress={handleSave} loading={saving} disabled={!canSave} />
      </ScrollView>
    </Screen>
  );
}

function shiftDay(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
