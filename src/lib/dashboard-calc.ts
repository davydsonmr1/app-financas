import type { Category, TransactionWithEffective } from './types';
import type { MemberWithProfile } from './space-context';

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

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}
