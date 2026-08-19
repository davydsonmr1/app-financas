/**
 * Regra do escopo (docs/ESCOPO.md §4.10): nenhum período do dashboard
 * atravessa a fronteira do mês. Semana é a semana do calendário RECORTADA
 * nas bordas do mês — por isso pode ter 1 ou 2 dias em vez de 7.
 *
 * Tudo aqui trabalha com strings 'yyyy-MM-dd' (fuso do dispositivo), nunca
 * com Date+hora — para não repetir o bug clássico de UTC empurrando um
 * lançamento de 31 às 21h para o mês seguinte.
 */

export type PeriodKind = 'day' | 'week' | 'month';

export type PeriodRange = {
  kind: PeriodKind;
  from: string; // yyyy-MM-dd, inclusive
  to: string; // yyyy-MM-dd, inclusive
  label: string;
  partial: boolean;
  days: number;
  /** true quando a navegação teria atravessado o mês e foi bloqueada */
  atMonthStart: boolean;
  atMonthEnd: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function monthBounds(refISO: string): { first: string; last: string } {
  const d = fromISO(refISO);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { first: toISODate(first), last: toISODate(last) };
}

function daysBetweenInclusive(a: string, b: string): number {
  const diff = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(diff / 86400000) + 1;
}

const WEEKDAY_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTH_LABEL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function dayRange(refISO: string): PeriodRange {
  const { first, last } = monthBounds(refISO);
  const d = fromISO(refISO);
  return {
    kind: 'day',
    from: refISO,
    to: refISO,
    label: `${WEEKDAY_LABEL[d.getDay()]}, ${d.getDate()} de ${MONTH_LABEL[d.getMonth()]}`,
    partial: false,
    days: 1,
    atMonthStart: refISO === first,
    atMonthEnd: refISO === last,
  };
}

/** Semana começa no domingo, recortada nas bordas do mês. */
export function weekRange(refISO: string): PeriodRange {
  const { first, last } = monthBounds(refISO);
  const d = fromISO(refISO);
  const sunday = addDays(refISO, -d.getDay());
  const saturday = addDays(sunday, 6);
  const from = sunday < first ? first : sunday;
  const to = saturday > last ? last : saturday;
  const days = daysBetweenInclusive(from, to);
  const df = fromISO(from);
  const dt = fromISO(to);
  const sameMonth = df.getMonth() === dt.getMonth();
  const label = sameMonth
    ? `${df.getDate()}–${dt.getDate()} de ${MONTH_LABEL[df.getMonth()]}`
    : `${df.getDate()} ${MONTH_LABEL[df.getMonth()].slice(0, 3)} – ${dt.getDate()} ${MONTH_LABEL[dt.getMonth()].slice(0, 3)}`;
  return {
    kind: 'week',
    from,
    to,
    label,
    partial: days < 7,
    days,
    atMonthStart: from === first,
    atMonthEnd: to === last,
  };
}

export function monthRange(refISO: string): PeriodRange {
  const { first, last } = monthBounds(refISO);
  const d = fromISO(refISO);
  return {
    kind: 'month',
    from: first,
    to: last,
    label: `${MONTH_LABEL[d.getMonth()][0].toUpperCase()}${MONTH_LABEL[d.getMonth()].slice(1)} de ${d.getFullYear()}`,
    partial: false,
    days: daysBetweenInclusive(first, last),
    atMonthStart: true,
    atMonthEnd: true,
  };
}

export function getRange(kind: PeriodKind, refISO: string): PeriodRange {
  if (kind === 'day') return dayRange(refISO);
  if (kind === 'week') return weekRange(refISO);
  return monthRange(refISO);
}

/**
 * Navega para o período anterior/seguinte SEM atravessar o mês.
 * Na borda, `refISO` não muda de mês — quem quiser sair do mês troca de mês
 * explicitamente (ação separada, não a seta `<` `>`).
 */
export function navigate(kind: PeriodKind, refISO: string, dir: -1 | 1): string {
  const { first, last } = monthBounds(refISO);
  if (kind === 'day') {
    const next = addDays(refISO, dir);
    return next < first || next > last ? refISO : next;
  }
  if (kind === 'week') {
    const next = addDays(refISO, dir * 7);
    if (next < first) return first;
    if (next > last) return last;
    return next;
  }
  // month: refISO deixa de ser "hoje" e passa a ser o dia 1 do mês alvo
  const d = fromISO(refISO);
  const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
  return toISODate(target);
}

/** Mesmo dia do calendário N meses atrás — para a comparação entre meses. */
export function monthsAgo(refISO: string, n: number): string {
  const d = fromISO(refISO);
  const target = new Date(d.getFullYear(), d.getMonth() - n, 1);
  const { last } = monthBounds(toISODate(target));
  const day = Math.min(d.getDate(), fromISO(last).getDate());
  return toISODate(new Date(target.getFullYear(), target.getMonth(), day));
}
