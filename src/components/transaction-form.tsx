import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Button, Card, Chip, Label, TextField } from '@/components/ui';
import { SelectField } from '@/components/select-field';
import { DateField, type DateMode } from '@/components/date-field';
import { getCategories, createInstallments } from '@/lib/queries';
import { enqueueTransaction, generateId } from '@/lib/offline-queue';
import { todayISO } from '@/lib/period';
import { PAYMENT_LABELS, type Category, type PaymentMethod, type TransactionKind } from '@/lib/types';

const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'debit', 'credit', 'cash', 'boleto'];
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Formulário de lançamento rápido — usado pela tela Despesas (kind fixo em
 * 'expense') e pela tela Receitas (kind alterna entre 'income'/'investment'
 * por um seletor que o pai controla). Ver ESCOPO §4.3.
 */
export function TransactionForm({ kind, onSaved }: { kind: TransactionKind; onSaved: () => void }) {
  const t = useTheme();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();

  const [amountStr, setAmountStr] = useState('');
  const [attributedTo, setAttributedTo] = useState<string | null>(session?.user.id ?? null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(
    kind === 'expense' ? params.categoryId : undefined,
  );
  const [description, setDescription] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState(todayISO());
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [installments, setInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeSpace) getCategories(activeSpace.id).then(setCategories).catch(() => {});
  }, [activeSpace]);

  useEffect(() => {
    setCategoryId(undefined);
    setInstallments(false);
  }, [kind]);

  const categoriesForKind = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind]);
  const categoryOptions = useMemo(
    () => categoriesForKind.map((c) => ({ key: c.id, label: c.name, color: c.color })),
    [categoriesForKind],
  );

  useEffect(() => {
    if (categoryId && !categoriesForKind.find((c) => c.id === categoryId)) setCategoryId(undefined);
  }, [categoriesForKind, categoryId]);

  const occurredAt = useMemo(() => {
    if (dateMode === 'today') return todayISO();
    if (dateMode === 'yesterday') return shiftDay(todayISO(), -1);
    return customDate;
  }, [dateMode, customDate]);

  /** Regra do usuário: parcelamento sempre começa no mês SEGUINTE ao lançamento. */
  const firstInstallmentMonthLabel = useMemo(() => {
    const [y, m] = occurredAt.split('-').map(Number);
    const next = new Date(y, m, 1); // m já é o índice 0-based do mês seguinte
    return `${MONTH_NAMES[next.getMonth()]}/${next.getFullYear()}`;
  }, [occurredAt]);

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
          attributed_to: kind === 'income' ? null : attributedTo,
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
      setAmountStr('');
      setDescription('');
      setCategoryId(undefined);
      setInstallments(false);
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <Label>Valor</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
          <Text style={{ color: t.textMuted, fontSize: 20, marginRight: 4 }}>R$</Text>
          <TextField
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholder="0,00"
            style={{ minWidth: 140 }}
          />
        </View>
      </View>

      {attributionOptions.length > 0 && kind !== 'income' ? (
        <View>
          <Label style={{ marginBottom: spacing.xs }}>
            De quem é {kind === 'expense' ? 'esse gasto' : 'esse aporte'}?
          </Label>
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

      <SelectField label="Categoria" value={categoryId} options={categoryOptions} onChange={setCategoryId} placeholder="Escolher categoria" />

      <DateField
        mode={dateMode}
        customDate={customDate}
        onChange={(mode, date) => {
          setDateMode(mode);
          setCustomDate(date);
        }}
      />

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

      {kind === 'expense' ? (
        <View>
          <Chip
            label={installments ? '✓ Parcelado' : 'Parcelar essa compra'}
            selected={installments}
            onPress={() => setInstallments((v) => !v)}
          />
          {installments ? (
            <View style={{ marginTop: spacing.sm }}>
              <TextField
                label="Número de parcelas"
                value={installmentCount}
                onChangeText={setInstallmentCount}
                keyboardType="number-pad"
                style={{ maxWidth: 120 }}
              />
              <Text style={{ color: t.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                1ª parcela em {firstInstallmentMonthLabel} — parcelamento sempre começa no mês seguinte.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <TextField label="Descrição (opcional)" value={description} onChangeText={setDescription} placeholder="ex: mercado do mês" />

      {error ? <Text style={{ color: t.negative, fontSize: 13 }}>{error}</Text> : null}

      <Button title="Salvar" onPress={handleSave} loading={saving} disabled={!canSave} />
    </Card>
  );
}

function shiftDay(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
