import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { Chip, Heading, Screen, TextField } from '@/components/ui';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionList } from '@/components/transaction-list';
import { getCategories, getTransactions } from '@/lib/queries';
import { monthRange, navigate, todayISO } from '@/lib/period';
import type { Category, TransactionKind, TransactionWithEffective } from '@/lib/types';

export default function ReceitasScreen() {
  const t = useTheme();
  const { activeSpace } = useSpace();

  const [kind, setKind] = useState<Extract<TransactionKind, 'income' | 'investment'>>('income');
  const [refISO, setRefISO] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<TransactionWithEffective[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const range = monthRange(refISO);

  const load = useCallback(async () => {
    if (!activeSpace) return;
    const [cats, list] = await Promise.all([
      getCategories(activeSpace.id),
      getTransactions({ spaceId: activeSpace.id, from: range.from, to: range.to, kind }),
    ]);
    setCategories(cats);
    setTxs(list);
  }, [activeSpace, range.from, range.to, kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.primary}
          />
        }
      >
        <Heading>Receitas</Heading>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Receita" selected={kind === 'income'} onPress={() => setKind('income')} />
          <Chip label="Investimento" selected={kind === 'investment'} onPress={() => setKind('investment')} />
        </View>

        <TransactionForm kind={kind} onSaved={load} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Ionicons name="chevron-back" size={20} color={t.text} onPress={() => setRefISO((r) => navigate('month', r, -1))} suppressHighlighting />
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{range.label}</Text>
          <Ionicons name="chevron-forward" size={20} color={t.text} onPress={() => setRefISO((r) => navigate('month', r, 1))} suppressHighlighting />
        </View>

        <TextField value={search} onChangeText={setSearch} placeholder="Buscar por descrição ou categoria…" />

        <TransactionList
          transactions={txs}
          categories={categories}
          search={search}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
      </ScrollView>
    </Screen>
  );
}
