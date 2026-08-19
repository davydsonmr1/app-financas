import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Button, Card, Chip, Divider, Label, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { addRefund, getCategories, softDeleteTransaction } from '@/lib/queries';
import { formatBRL } from '@/lib/dashboard-calc';
import { PAYMENT_LABELS, type Category, type PaymentMethod, type TransactionWithEffective } from '@/lib/types';

export default function TransacaoDetalheScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();

  const [tx, setTx] = useState<TransactionWithEffective | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [refundStr, setRefundStr] = useState('');
  const [addingRefund, setAddingRefund] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id || !activeSpace) return;
      const [{ data }, cats] = await Promise.all([
        supabase.from('v_transactions').select('*').eq('id', id).single(),
        getCategories(activeSpace.id),
      ]);
      if (data) {
        setTx(data as TransactionWithEffective);
        setDescription(data.description ?? '');
        setAmountStr(String(data.amount).replace('.', ','));
        setPayment(data.payment_method);
        setCategoryId(data.category_id ?? undefined);
      }
      setCategories(cats);
      setLoading(false);
    })();
  }, [id, activeSpace]);

  const categoriesForKind = useMemo(
    () => categories.filter((c) => c.kind === tx?.kind),
    [categories, tx],
  );

  const memberLabel = (userId: string | null) => {
    if (userId === null) return 'Casa';
    if (userId === session?.user.id) return 'Eu';
    return members.find((m) => m.id === userId)?.display_name || 'Alguém';
  };

  if (loading || !tx) {
    return (
      <Screen>
        <Text style={{ color: t.textMuted, padding: spacing.lg }}>Carregando…</Text>
      </Screen>
    );
  }

  const isInstallment = !!tx.installment_group_id;
  const isRecurrence = !!tx.recurrence_id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalized = amountStr.replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(normalized);
      const { error } = await supabase
        .from('transactions')
        .update({
          description,
          amount: Number.isFinite(amount) ? amount : tx.amount,
          payment_method: payment,
          category_id: categoryId ?? null,
        })
        .eq('id', tx.id);
      if (error) throw error;
      router.back();
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Excluir lançamento?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await softDeleteTransaction(tx.id);
          router.back();
        },
      },
    ]);
  };

  const handleRefund = async () => {
    const normalized = refundStr.replace(/\./g, '').replace(',', '.');
    const value = parseFloat(normalized);
    if (!Number.isFinite(value) || value <= 0) return;
    setAddingRefund(true);
    try {
      await addRefund(tx.id, value);
      const { data } = await supabase.from('v_transactions').select('*').eq('id', tx.id).single();
      if (data) setTx(data as TransactionWithEffective);
      setRefundStr('');
    } finally {
      setAddingRefund(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        {(isInstallment || isRecurrence) && (
          <Card style={{ backgroundColor: t.surfaceAlt }}>
            <Body style={{ fontSize: 12, color: t.textMuted }}>
              {isInstallment && `Parcela ${tx.installment_no}/${tx.installment_total}. `}
              {isRecurrence && 'Gerado automaticamente de um fixo. '}
              Editar aqui muda só este lançamento — os demais meses continuam como estão.
            </Body>
          </Card>
        )}

        <TextField label="Descrição" value={description} onChangeText={setDescription} />
        <TextField label="Valor (bruto)" value={amountStr} onChangeText={setAmountStr} keyboardType="decimal-pad" />

        <View>
          <Label style={{ marginBottom: spacing.xs }}>Categoria</Label>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {categoriesForKind.map((c) => (
              <Chip key={c.id} label={c.name} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </View>

        {tx.kind !== 'income' && (
          <View>
            <Label style={{ marginBottom: spacing.xs }}>Forma de pagamento</Label>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => (
                <Chip key={p} label={PAYMENT_LABELS[p]} selected={payment === p} onPress={() => setPayment(p)} />
              ))}
            </View>
          </View>
        )}

        <Card>
          <Label>Atribuído a</Label>
          <Body style={{ marginTop: 4 }}>{memberLabel(tx.attributed_to)}</Body>
          <Divider />
          <Label style={{ marginTop: spacing.sm }}>Data</Label>
          <Body style={{ marginTop: 4 }}>{tx.occurred_at.split('-').reverse().join('/')}</Body>
        </Card>

        <Button title="Salvar alterações" onPress={handleSave} loading={saving} />

        {tx.kind === 'expense' && (
          <Card>
            <Label>Reembolso</Label>
            <Body style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
              Abate do valor deste gasto. Bruto: {formatBRL(tx.amount)} · Líquido: {formatBRL(tx.effective_amount)}
            </Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TextField
                value={refundStr}
                onChangeText={setRefundStr}
                keyboardType="decimal-pad"
                placeholder="0,00"
                style={{ flex: 1 }}
              />
              <Button title="Adicionar" onPress={handleRefund} loading={addingRefund} variant="secondary" />
            </View>
          </Card>
        )}

        <Button title="Excluir lançamento" onPress={handleDelete} variant="danger" />
      </ScrollView>
    </Screen>
  );
}
