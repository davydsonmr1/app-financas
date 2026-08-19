import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Chip, EmptyState } from '@/components/ui';
import { formatBRL } from '@/lib/dashboard-calc';
import { KIND_LABELS, type Category, type TransactionWithEffective } from '@/lib/types';

/**
 * Lista embutida nas telas Despesas/Receitas — sem seletor de tipo (o pai já
 * fixa o `kind`), mas com busca e filtro de categoria/atribuição. Ver
 * ESCOPO §4.10 (decisão: formulário + lista na mesma tela).
 */
export function TransactionList({
  transactions,
  categories,
  search,
  categoryFilter,
  onCategoryFilterChange,
}: {
  transactions: TransactionWithEffective[];
  categories: Category[];
  search: string;
  categoryFilter?: string;
  onCategoryFilterChange: (id: string | undefined) => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { members } = useSpace();

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (categoryFilter && tx.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const catName = tx.category_id ? catById.get(tx.category_id)?.name.toLowerCase() : '';
        if (!tx.description.toLowerCase().includes(needle) && !catName?.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, categoryFilter, search, catById]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nada por aqui ainda"
        subtitle="Use o formulário acima para lançar o primeiro deste mês."
      />
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {categoryFilter ? (
        <Chip label={`✕ ${catById.get(categoryFilter)?.name ?? 'categoria'}`} selected onPress={() => onCategoryFilterChange(undefined)} />
      ) : null}

      {filtered.map((item) => {
        const cat = item.category_id ? catById.get(item.category_id) : undefined;
        const attrLabel =
          item.attributed_to === null
            ? 'Casa'
            : item.attributed_to === session?.user.id
              ? 'Eu'
              : memberById.get(item.attributed_to)?.display_name || '';
        const color = item.kind === 'expense' ? t.negative : item.kind === 'investment' ? t.invest : t.positive;
        const hasRefund = item.amount !== item.effective_amount;

        return (
          <View
            key={item.id}
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
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat?.color ?? '#94a3b8' }} />
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
      })}
    </View>
  );
}

function formatDatePt(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
