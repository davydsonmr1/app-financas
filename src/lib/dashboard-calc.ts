import type { Category, TransactionWithEffective } from './types';
import type { MemberWithProfile } from './space-context';
import type { Income } from './queries';
import type { PeriodRange } from './period';

function daysInMonthOf(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const diff = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(diff / 86400000) + 1;
}

/**
 * Rateia a renda mensal pelos dias do período. Como nenhum período atravessa
 * o mês (regra do §4.10), o mês-base é sempre único — sem isso, "Entrou" no
 * dashboard de um dia mostraria o salário inteiro do mês.
 */
export function incomeForRange(incomes: Income[], range: PeriodRange): number {
  const monthDays = daysInMonthOf(range.from);
  let total = 0;
  for (const inc of incomes) {
    const from = inc.effective_from > range.from ? inc.effective_from : range.from;
    const to = inc.effective_to && inc.effective_to < range.to ? inc.effective_to : range.to;
    if (from > to) continue;
    total += (inc.amount / monthDays) * daysBetween(from, to);
  }
  return total;
}

export type Summary = {
  entrou: number;
  saiu: number;
  investido: number;
  /** Renda − Despesas − Investido. Ver ESCOPO §4.10. */
  sobra: number;
};

/** Soma incomes vigentes no período (rateado por dia) + receitas avulsas do período. */
export function calcSummary(
  txs: TransactionWithEffective[],
  incomeInPeriod: number,
): Summary {
  let saiu = 0;
  let investido = 0;
  let receitaAvulsa = 0;

  for (const t of txs) {
    if (t.kind === 'expense') saiu += t.effective_amount;
    else if (t.kind === 'investment') investido += t.effective_amount;
    else if (t.kind === 'income') receitaAvulsa += t.effective_amount;
  }

  const entrou = incomeInPeriod + receitaAvulsa;
  return { entrou, saiu, investido, sobra: entrou - saiu - investido };
}

export type PieSlice = { key: string; label: string; value: number; color: string };

export function pieByCategory(
  txs: TransactionWithEffective[],
  categories: Category[],
  kind: 'expense' | 'investment' = 'expense',
): PieSlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const t of txs) {
    if (t.kind !== kind) continue;
    const key = t.category_id ?? '__sem_categoria__';
    totals.set(key, (totals.get(key) ?? 0) + t.effective_amount);
  }

  return [...totals.entries()]
    .map(([key, value]) => {
      const cat = byId.get(key);
      return { key, label: cat?.name ?? 'Sem categoria', value, color: cat?.color ?? '#94a3b8' };
    })
    .sort((a, b) => b.value - a.value);
}

const ATTRIBUTION_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#f59e0b'];

export function pieByAttribution(
  txs: TransactionWithEffective[],
  members: MemberWithProfile[],
  kind: 'expense' | 'investment' = 'expense',
): PieSlice[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const totals = new Map<string, number>();

  for (const t of txs) {
    if (t.kind !== kind) continue;
    const key = t.attributed_to ?? '__casa__';
    totals.set(key, (totals.get(key) ?? 0) + t.effective_amount);
  }

  return [...totals.entries()]
    .map(([key, value], i) => ({
      key,
      label: key === '__casa__' ? 'Casa' : (byId.get(key)?.display_name ?? 'Alguém'),
      value,
      color: key === '__casa__' ? '#64748b' : ATTRIBUTION_COLORS[i % ATTRIBUTION_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export type CategoryDelta = {
  categoryId: string;
  label: string;
  color: string;
  current: number;
  previous: number;
  deltaPct: number | null;
};

/** Top categorias com variação vs. um período anterior de mesma duração. */
export function topCategoryDeltas(
  current: TransactionWithEffective[],
  previous: TransactionWithEffective[],
  categories: Category[],
  limit = 5,
): CategoryDelta[] {
  const cur = pieByCategory(current, categories);
  const prevMap = new Map(pieByCategory(previous, categories).map((p) => [p.key, p.value]));

  return cur.slice(0, limit).map((c) => {
    const previous = prevMap.get(c.key) ?? 0;
    const deltaPct = previous === 0 ? null : ((c.value - previous) / previous) * 100;
    return { categoryId: c.key, label: c.label, color: c.color, current: c.value, previous, deltaPct };
  });
}

/** Série acumulada dia-a-dia dentro de um mês, para o gráfico de comparação. */
export function accumulatedByDay(
  txs: TransactionWithEffective[],
  daysInMonth: number,
  kind: 'expense' | 'investment' = 'expense',
): number[] {
  const perDay = new Array(daysInMonth).fill(0);
  for (const t of txs) {
    if (t.kind !== kind) continue;
    const day = Number(t.occurred_at.split('-')[2]);
    if (day >= 1 && day <= daysInMonth) perDay[day - 1] += t.effective_amount;
  }
  const acc: number[] = [];
  let running = 0;
  for (const v of perDay) {
    running += v;
    acc.push(running);
  }
  return acc;
}

export type FixedDelta = {
  recurrenceId: string;
  label: string;
  current: number | null;
  previous: number | null;
};

/** Compara despesas fixas (por recurrence_id) entre dois meses já materializados. */
export function compareFixed(
  currentTxs: TransactionWithEffective[],
  previousTxs: TransactionWithEffective[],
  descriptionById: Map<string, string>,
): FixedDelta[] {
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();

  for (const t of currentTxs) {
    if (t.recurrence_id) cur.set(t.recurrence_id, (cur.get(t.recurrence_id) ?? 0) + t.effective_amount);
  }
  for (const t of previousTxs) {
    if (t.recurrence_id) prev.set(t.recurrence_id, (prev.get(t.recurrence_id) ?? 0) + t.effective_amount);
  }

  const ids = new Set([...cur.keys(), ...prev.keys()]);
  return [...ids]
    .map((id) => ({
      recurrenceId: id,
      label: descriptionById.get(id) ?? 'Fixo removido',
      current: cur.get(id) ?? null,
      previous: prev.get(id) ?? null,
    }))
    .sort((a, b) => (b.current ?? 0) - (a.current ?? 0));
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}
