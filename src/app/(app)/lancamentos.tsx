import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Chip, EmptyState, Label, Screen, TextField } from '@/components/ui';
import { getCategories, getTransactions } from '@/lib/queries';
import { formatBRL } from '@/lib/dashboard-calc';
import { monthRange, navigate, todayISO } from '@/lib/period';
import { KIND_LABELS, type Category, type TransactionKind, type TransactionWithEffective } from '@/lib/types';

export default function LancamentosScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();

  const [refISO, setRefISO] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<TransactionKind | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(params.categoryId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<TransactionWithEffective[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const range = useMemo(() => monthRange(refISO), [refISO]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const load = useCallback(async () => {
    if (!activeSpace) return;
    setLoading(true);
    try {
      const [cats, list] = await Promise.all([
        getCategories(activeSpace.id),
        getTransactions({ spaceId: activeSpace.id, from: range.from, to: range.to }),
      ]);
      setCategories(cats);
      setTxs(list);
    } finally {
      setLoading(false);
    }
  }, [activeSpace, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    return txs.filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (categoryFilter && tx.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const catName = tx.category_id ? catById.get(tx.category_id)?.name.toLowerCase() : '';
        if (!tx.description.toLowerCase().includes(needle) && !catName?.includes(needle)) return false;
      }
      return true;
    });
  }, [txs, kindFilter, categoryFilter, search, catById]);

  return (
    <Screen>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={t.text}
            onPress={() => setRefISO((r) => navigate('month', r, -1))}
            suppressHighlighting
          />
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{range.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={t.text}
            onPress={() => setRefISO((r) => navigate('month', r, 1))}
            suppressHighlighting
          />
        </View>

        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por descrição ou categoria…"
        />

        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          <Chip label="Todos" selected={kindFilter === 'all'} onPress={() => setKindFilter('all')} />
          <Chip label="Despesas" selected={kindFilter === 'expense'} onPress={() => setKindFilter('expense')} />
          <Chip label="Receitas" selected={kindFilter === 'income'} onPress={() => setKindFilter('income')} />
          <Chip label="Investim." selected={kindFilter === 'investment'} onPress={() => setKindFilter('investment')} />
        </View>

        {categoryFilter ? (
          <Chip
            label={`✕ ${catById.get(categoryFilter)?.name ?? 'categoria'}`}
            selected
            onPress={() => setCategoryFilter(undefined)}
          />
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, gap: spacing.sm }}
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
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Nada por aqui ainda"
              subtitle="Toque no + para lançar o primeiro gasto do mês."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const cat = item.category_id ? catById.get(item.category_id) : undefined;
          const attrLabel =
            item.attributed_to === null
              ? 'Casa'
              : item.attributed_to === session?.user.id
                ? 'Eu'
                : memberById.get(item.attributed_to)?.display_name || '';
          const color =
            item.kind === 'expense' ? t.negative : item.kind === 'investment' ? t.invest : t.positive;
          const hasRefund = item.amount !== item.effective_amount;

          return (
            <View
              onTouchEnd={() => router.push(`/transacao/${item.id}` as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: cat?.color ?? '#94a3b8',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                  {item.description || cat?.name || KIND_LABELS[item.kind]}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                  {cat?.name ?? '—'}
                  {attrLabel ? ` · ${attrLabel}` : ''}
                  {item.installment_no ? ` · ${item.installment_no}/${item.installment_total}` : ''}
                  {' · '}
                  {formatDatePt(item.occurred_at)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color, fontWeight: '700', fontSize: 14 }}>
                  {item.kind === 'expense' ? '-' : '+'}
                  {formatBRL(item.effective_amount)}
                </Text>
                {hasRefund ? (
                  <Text style={{ color: t.textMuted, fontSize: 10, textDecorationLine: 'line-through' }}>
                    {formatBRL(item.amount)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

function formatDatePt(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
