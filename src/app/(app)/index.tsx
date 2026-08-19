import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useSpace } from '@/lib/space-context';
import { Body, Card, Chip, Heading, Label, Screen } from '@/components/ui';
import { PieChart, PieLegend } from '@/components/pie-chart';
import { getRange, navigate, monthRange, todayISO, type PeriodKind } from '@/lib/period';
import { getCategories, getIncomesForUsers, getTransactions, upcomingThisMonth } from '@/lib/queries';
import {
  calcSummary,
  formatBRL,
  formatPct,
  incomeForRange,
  pieByAttribution,
  pieByCategory,
  topCategoryDeltas,
} from '@/lib/dashboard-calc';
import type { Category, TransactionWithEffective } from '@/lib/types';

const PERIODS: { key: PeriodKind; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

export default function DashboardScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { activeSpace, members } = useSpace();

  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [refISO, setRefISO] = useState(todayISO());
  const [attributionFilter, setAttributionFilter] = useState<'all' | 'casa' | string>('all');
  const [pieMode, setPieMode] = useState<'category' | 'attribution'>('category');

  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<TransactionWithEffective[]>([]);
  const [prevTxs, setPrevTxs] = useState<TransactionWithEffective[]>([]);
  const [monthTxs, setMonthTxs] = useState<TransactionWithEffective[]>([]);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [upcoming, setUpcoming] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getRange(periodKind, refISO), [periodKind, refISO]);
  const mRange = useMemo(() => monthRange(refISO), [refISO]);

  const load = useCallback(async () => {
    if (!activeSpace || !session) return;
    setLoading(true);
    try {
      const cats = await getCategories(activeSpace.id);
      setCategories(cats);

      const prevLen = range.days;
      const prevTo = shiftDays(range.from, -1);
      const prevFrom = shiftDays(prevTo, -(prevLen - 1));

      const [current, previous, monthData] = await Promise.all([
        getTransactions({ spaceId: activeSpace.id, from: range.from, to: range.to }),
        getTransactions({ spaceId: activeSpace.id, from: prevFrom, to: prevTo }),
        getTransactions({ spaceId: activeSpace.id, from: mRange.from, to: mRange.to }),
      ]);
      setTxs(current);
      setPrevTxs(previous);
      setMonthTxs(monthData);

      const sharingIds = members.filter((m) => m.share_income).map((m) => m.id);
      const incomes = sharingIds.length ? await getIncomesForUsers(sharingIds) : [];
      setIncomeTotal(incomeForRange(incomes, range));

      setUpcoming(await upcomingThisMonth(activeSpace.id, mRange, monthData, todayISO()));
    } finally {
      setLoading(false);
    }
  }, [activeSpace, session, range, mRange, members]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const attributionOptions = useMemo(() => {
    const meFirst = [...members].sort((a, b) => (a.id === session?.user.id ? -1 : 1));
    return [
      { key: 'all', label: 'Tudo' },
      ...meFirst.map((m) => ({
        key: m.id,
        label: m.id === session?.user.id ? 'Eu' : m.display_name || 'Membro',
      })),
      { key: 'casa', label: 'Casa' },
    ];
  }, [members, session]);

  const filteredTxs = useMemo(() => {
    if (attributionFilter === 'all') return txs;
    if (attributionFilter === 'casa') return txs.filter((tx) => tx.attributed_to === null);
    return txs.filter((tx) => tx.attributed_to === attributionFilter);
  }, [txs, attributionFilter]);

  const summary = useMemo(
    () => calcSummary(filteredTxs, attributionFilter === 'all' ? incomeTotal : 0),
    [filteredTxs, incomeTotal, attributionFilter],
  );

  const pieData = useMemo(
    () =>
      pieMode === 'category'
        ? pieByCategory(filteredTxs, categories, 'expense')
        : pieByAttribution(filteredTxs, members, 'expense'),
    [pieMode, filteredTxs, categories, members],
  );

  const deltas = useMemo(
    () => topCategoryDeltas(filteredTxs, prevTxs, categories, 5),
    [filteredTxs, prevTxs, categories],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}
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
        {/* Seletor de período */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PERIODS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              selected={periodKind === p.key}
              onPress={() => setPeriodKind(p.key)}
            />
          ))}
        </View>

        <Card style={{ paddingVertical: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Ionicons
              name="chevron-back"
              size={22}
              color={t.text}
              onPress={() => setRefISO((r) => navigate(periodKind, r, -1))}
              suppressHighlighting
            />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                {range.label}
              </Text>
              {range.partial ? (
                <Text style={{ color: t.warn, fontSize: 11, marginTop: 2 }}>
                  parcial · {range.days} {range.days === 1 ? 'dia' : 'dias'}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={t.text}
              onPress={() => setRefISO((r) => navigate(periodKind, r, 1))}
              suppressHighlighting
            />
          </View>
        </Card>

        {/* Filtro de atribuição */}
        {members.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {attributionOptions.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  selected={attributionFilter === opt.key}
                  onPress={() => setAttributionFilter(opt.key)}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {/* Cards resumo */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <SummaryCard label="Entrou" value={summary.entrou} color={t.positive} icon="arrow-down-circle" />
          <SummaryCard label="Saiu" value={summary.saiu} color={t.negative} icon="arrow-up-circle" />
          <SummaryCard label="Investido" value={summary.investido} color={t.invest} icon="trending-up" />
          <SummaryCard
            label="Sobra"
            value={summary.sobra}
            color={summary.sobra >= 0 ? t.positive : t.negative}
            icon="wallet"
            wide
            subtitle={summary.entrou > 0 ? `${formatPct((summary.sobra / summary.entrou) * 100)} da renda` : undefined}
          />
        </View>

        {upcoming.count > 0 ? (
          <Card style={{ backgroundColor: t.surfaceAlt, borderStyle: 'dashed' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="time-outline" size={20} color={t.warn} />
              <View style={{ flex: 1 }}>
                <Label>Ainda vai sair esse mês</Label>
                <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>
                  {formatBRL(upcoming.total)}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: 12 }}>{upcoming.count} pendências</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Pizza */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Heading style={{ fontSize: 16 }}>Despesas</Heading>
            {members.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Chip label="Categoria" selected={pieMode === 'category'} onPress={() => setPieMode('category')} />
                <Chip label="Atribuição" selected={pieMode === 'attribution'} onPress={() => setPieMode('attribution')} />
              </View>
            ) : null}
          </View>
          <PieChart
            slices={pieData}
            onSlicePress={(s) =>
              router.push({ pathname: '/lancamentos', params: { categoryId: pieMode === 'category' ? s.key : undefined } } as any)
            }
          />
          <PieLegend slices={pieData} />
        </Card>

        {/* Top categorias com variação */}
        {deltas.length > 0 ? (
          <Card>
            <Heading style={{ fontSize: 16, marginBottom: spacing.sm }}>Maiores categorias</Heading>
            <View style={{ gap: spacing.sm }}>
              {deltas.map((d) => (
                <View key={d.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.color }} />
                  <Body style={{ flex: 1 }}>{d.label}</Body>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>{formatBRL(d.current)}</Text>
                  {d.deltaPct !== null ? (
                    <Text
                      style={{
                        color: d.deltaPct > 0 ? t.negative : t.positive,
                        fontSize: 12,
                        width: 52,
                        textAlign: 'right',
                      }}
                    >
                      {d.deltaPct > 0 ? '↑' : '↓'} {formatPct(Math.abs(d.deltaPct))}
                    </Text>
                  ) : (
                    <Text style={{ color: t.textMuted, fontSize: 12, width: 52, textAlign: 'right' }}>novo</Text>
                  )}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card
          style={{ borderStyle: 'dashed' }}
          {...({ onTouchEnd: () => router.push('/comparacao' as any) } as any)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="stats-chart" size={18} color={t.primary} />
            <Body style={{ flex: 1 }}>Comparar com outro mês</Body>
            <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
          </View>
        </Card>

        {loading ? <Text style={{ color: t.textMuted, textAlign: 'center' }}>Carregando…</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
  wide,
  subtitle,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  wide?: boolean;
  subtitle?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexBasis: wide ? '100%' : '48%',
        flexGrow: 1,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Ionicons name={icon} size={15} color={color} />
        <Label>{label}</Label>
      </View>
      <Text style={{ color: t.text, fontSize: 19, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit>
        {formatBRL(value)}
      </Text>
      {subtitle ? <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
  );
}

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
