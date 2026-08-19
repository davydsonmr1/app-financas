import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme, spacing, radius } from '@/constants/theme';
import { useSpace } from '@/lib/space-context';
import { Body, Card, Chip, Label, Screen } from '@/components/ui';
import { AccumulatedLineChart } from '@/components/line-chart';
import { getTransactions } from '@/lib/queries';
import { accumulatedByDay, compareFixed, formatBRL, formatPct } from '@/lib/dashboard-calc';
import { monthRange, monthsAgo, todayISO } from '@/lib/period';
import type { TransactionWithEffective } from '@/lib/types';

const OPTIONS = [1, 2, 3, 6];

export default function ComparacaoScreen() {
  const t = useTheme();
  const { activeSpace } = useSpace();

  const [monthsBack, setMonthsBack] = useState(1);
  const [currentTxs, setCurrentTxs] = useState<TransactionWithEffective[]>([]);
  const [previousTxs, setPreviousTxs] = useState<TransactionWithEffective[]>([]);
  const [loading, setLoading] = useState(true);

  const today = todayISO();
  const todayDay = Number(today.split('-')[2]);
  const curRange = useMemo(() => monthRange(today), [today]);
  const refDate = useMemo(() => monthsAgo(today, monthsBack), [today, monthsBack]);
  const refRange = useMemo(() => monthRange(refDate), [refDate]);

  useEffect(() => {
    if (!activeSpace) return;
    setLoading(true);
    Promise.all([
      getTransactions({ spaceId: activeSpace.id, from: curRange.from, to: curRange.to }),
      getTransactions({ spaceId: activeSpace.id, from: refRange.from, to: refRange.to }),
    ])
      .then(([cur, prev]) => {
        setCurrentTxs(cur);
        setPreviousTxs(prev);
      })
      .finally(() => setLoading(false));
  }, [activeSpace, curRange.from, refRange.from]);

  const curDays = daysInRange(curRange.from, curRange.to);
  const refDays = daysInRange(refRange.from, refRange.to);
  const cutoff = Math.min(todayDay, curDays, refDays);

  const curAcc = useMemo(() => accumulatedByDay(currentTxs, curDays).slice(0, cutoff), [currentTxs, curDays, cutoff]);
  const refAccCut = useMemo(() => accumulatedByDay(previousTxs, refDays).slice(0, cutoff), [previousTxs, refDays, cutoff]);
  const refAccFull = useMemo(() => accumulatedByDay(previousTxs, refDays), [previousTxs, refDays]);

  const curTotalAtCutoff = curAcc[curAcc.length - 1] ?? 0;
  const refTotalAtCutoff = refAccCut[refAccCut.length - 1] ?? 0;
  const deltaPct = refTotalAtCutoff > 0 ? ((curTotalAtCutoff - refTotalAtCutoff) / refTotalAtCutoff) * 100 : null;
  const refTotalClosed = refAccFull[refAccFull.length - 1] ?? 0;

  const descriptionById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of [...currentTxs, ...previousTxs]) {
      if (tx.recurrence_id) map.set(tx.recurrence_id, tx.description || map.get(tx.recurrence_id) || 'Fixo');
    }
    return map;
  }, [currentTxs, previousTxs]);

  const fixedDeltas = useMemo(
    () => compareFixed(currentTxs, previousTxs, descriptionById),
    [currentTxs, previousTxs, descriptionById],
  );
  const fixedTotalCur = fixedDeltas.reduce((s, f) => s + (f.current ?? 0), 0);
  const fixedTotalPrev = fixedDeltas.reduce((s, f) => s + (f.previous ?? 0), 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {OPTIONS.map((n) => (
            <Chip
              key={n}
              label={n === 1 ? '1 mês atrás' : `${n} meses atrás`}
              selected={monthsBack === n}
              onPress={() => setMonthsBack(n)}
            />
          ))}
        </View>

        <Card>
          <Label>Gasto acumulado — até o dia {cutoff}</Label>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <View>
              <Text style={{ color: t.text, fontSize: 20, fontWeight: '700' }}>{formatBRL(curTotalAtCutoff)}</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>{curRange.label}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.textMuted, fontSize: 20, fontWeight: '700' }}>{formatBRL(refTotalAtCutoff)}</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>{refRange.label}</Text>
            </View>
          </View>
          {deltaPct !== null ? (
            <Text style={{ color: deltaPct > 0 ? t.negative : t.positive, fontSize: 13, marginTop: spacing.xs, fontWeight: '600' }}>
              {deltaPct > 0 ? '↑' : '↓'} {formatPct(Math.abs(deltaPct))} vs. mesmo período de {refRange.label.split(' de ')[0]}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <AccumulatedLineChart
              series={[
                { label: curRange.label, color: t.primary, points: curAcc },
                { label: `${refRange.label} (até dia ${cutoff})`, color: t.textMuted, points: refAccCut },
              ]}
            />
          </View>

          <Body style={{ fontSize: 11, color: t.textMuted, marginTop: spacing.xs }}>
            {refRange.label} fechou o mês em {formatBRL(refTotalClosed)} — não somado à comparação acima, que é sempre no mesmo corte de dia.
          </Body>
        </Card>

        {fixedDeltas.length > 0 ? (
          <Card>
            <Label>Despesas fixas — {curRange.label} vs. {refRange.label}</Label>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {fixedDeltas.map((f) => (
                <FixedRow key={f.recurrenceId} item={f} />
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: spacing.sm,
                  marginTop: spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: t.border,
                }}
              >
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>Total</Text>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 13 }}>
                  {formatBRL(fixedTotalPrev)} → {formatBRL(fixedTotalCur)}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {loading ? <Text style={{ color: t.textMuted, textAlign: 'center' }}>Carregando…</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function FixedRow({ item }: { item: { label: string; current: number | null; previous: number | null } }) {
  const t = useTheme();
  let badge = '—';
  let color = t.textMuted;
  if (item.current !== null && item.previous === null) {
    badge = '🆕 novo';
    color = t.invest;
  } else if (item.current === null && item.previous !== null) {
    badge = '❌ saiu';
    color = t.textMuted;
  } else if (item.current !== null && item.previous !== null && item.current !== item.previous) {
    const pct = ((item.current - item.previous) / item.previous) * 100;
    badge = `${pct > 0 ? '🔺' : '🔻'} ${formatPct(Math.abs(pct))}`;
    color = pct > 0 ? t.negative : t.positive;
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: t.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
        {item.label}
      </Text>
      <Text style={{ color: t.textMuted, fontSize: 12, width: 70, textAlign: 'right' }}>
        {item.previous !== null ? formatBRL(item.previous) : '—'}
      </Text>
      <Text style={{ color: t.text, fontSize: 12, width: 70, textAlign: 'right' }}>
        {item.current !== null ? formatBRL(item.current) : '—'}
      </Text>
      <Text style={{ color, fontSize: 11, width: 60, textAlign: 'right' }}>{badge}</Text>
    </View>
  );
}

function daysInRange(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1;
}
