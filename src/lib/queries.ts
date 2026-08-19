import { supabase } from './supabase';
import type { Category, Transaction, TransactionWithEffective } from './types';

export async function getCategories(spaceId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('space_id', spaceId)
    .is('archived_at', null)
    .order('sort_order');
  if (error) throw error;
  return data as Category[];
}

export async function createCategory(input: {
  space_id: string;
  name: string;
  icon: string;
  color: string;
  kind: Category['kind'];
}): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert(input).select().single();
  if (error) throw error;
  return data as Category;
}

export async function archiveCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export type TxFilters = {
  spaceId: string;
  from: string;
  to: string;
  attributedTo?: string | null | 'all';
  categoryId?: string;
  kind?: Transaction['kind'];
};

export async function getTransactions(filters: TxFilters): Promise<TransactionWithEffective[]> {
  let query = supabase
    .from('v_transactions')
    .select('*')
    .eq('space_id', filters.spaceId)
    .gte('occurred_at', filters.from)
    .lte('occurred_at', filters.to)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.attributedTo !== undefined && filters.attributedTo !== 'all') {
    if (filters.attributedTo === null) query = query.is('attributed_to', null);
    else query = query.eq('attributed_to', filters.attributedTo);
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.kind) query = query.eq('kind', filters.kind);

  const { data, error } = await query;
  if (error) throw error;
  return data as TransactionWithEffective[];
}

export async function createTransaction(
  tx: Omit<Transaction, 'deleted_at'> & { deleted_at?: null },
): Promise<void> {
  const { error } = await supabase.from('transactions').insert({ ...tx, deleted_at: null });
  if (error) throw error;
}

export async function createInstallments(input: {
  space_id: string;
  user_id: string;
  attributed_to: string | null;
  category_id: string;
  totalAmount: number;
  installments: number;
  description: string;
  payment_method: Transaction['payment_method'];
  firstOccurredAt: string;
  makeId: () => Promise<string>;
}): Promise<void> {
  const groupId = await input.makeId();
  const perInstallment = Math.round((input.totalAmount / input.installments) * 100) / 100;
  const rows: Transaction[] = [];
  const [y, m, d] = input.firstOccurredAt.split('-').map(Number);

  for (let i = 0; i < input.installments; i++) {
    const date = new Date(y, m - 1 + i, d);
    const occurred_at = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    rows.push({
      id: await input.makeId(),
      space_id: input.space_id,
      user_id: input.user_id,
      attributed_to: input.attributed_to,
      category_id: input.category_id,
      kind: 'expense',
      amount: perInstallment,
      description: input.description,
      occurred_at,
      payment_method: input.payment_method,
      installment_group_id: groupId,
      installment_no: i + 1,
      installment_total: input.installments,
      recurrence_id: null,
      competencia: null,
      deleted_at: null,
    });
  }

  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw error;
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function addRefund(transactionId: string, amount: number, note = ''): Promise<void> {
  const { error } = await supabase
    .from('refunds')
    .insert({ transaction_id: transactionId, amount, note });
  if (error) throw error;
}

// ------------------------------------------------------------- incomes ----
export type Income = {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  effective_from: string;
  effective_to: string | null;
};

export async function getIncomes(userId: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return data as Income[];
}

/** Editar salário NÃO reescreve o passado: fecha a vigência atual e abre uma nova. */
export async function updateIncome(
  userId: string,
  label: string,
  amount: number,
): Promise<void> {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data: current } = await supabase
    .from('incomes')
    .select('*')
    .eq('user_id', userId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1);

  if (current && current.length > 0) {
    if (current[0].effective_from === todayISO) {
      const { error } = await supabase
        .from('incomes')
        .update({ amount, label })
        .eq('id', current[0].id);
      if (error) throw error;
      return;
    }
    const { error: closeErr } = await supabase
      .from('incomes')
      .update({ effective_to: todayISO })
      .eq('id', current[0].id);
    if (closeErr) throw closeErr;
  }

  const { error } = await supabase
    .from('incomes')
    .insert({ user_id: userId, label, amount, effective_from: todayISO });
  if (error) throw error;
}

// -------------------------------------------------------- recurrences ----
export type Recurrence = {
  id: string;
  space_id: string;
  created_by: string;
  attributed_to: string | null;
  category_id: string | null;
  kind: Transaction['kind'];
  amount: number;
  description: string;
  payment_method: Transaction['payment_method'];
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
};

export async function getRecurrences(spaceId: string): Promise<Recurrence[]> {
  const { data, error } = await supabase
    .from('recurrences')
    .select('*')
    .eq('space_id', spaceId)
    .eq('active', true)
    .order('day_of_month');
  if (error) throw error;
  return data as Recurrence[];
}

export async function createRecurrence(
  input: Omit<Recurrence, 'id' | 'active'>,
): Promise<void> {
  const { error } = await supabase.from('recurrences').insert({ ...input, active: true });
  if (error) throw error;
}

/** Desativar não apaga o histórico já gerado — só para de gerar novos. */
export async function deactivateRecurrence(id: string): Promise<void> {
  const { error } = await supabase.from('recurrences').update({ active: false }).eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------- budgets ----
export type Budget = {
  id: string;
  space_id: string;
  category_id: string;
  scope: 'space' | 'attribution';
  attributed_to: string | null;
  amount: number;
};

export async function getBudgets(spaceId: string): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('space_id', spaceId);
  if (error) throw error;
  return data as Budget[];
}

/**
 * Não usa upsert com onConflict: o índice único de `budgets` é uma expressão
 * (`coalesce(attributed_to, ...)`) para tratar NULL = Casa, e o PostgREST só
 * mira listas de colunas simples nesse parâmetro. Por isso: lê, decide.
 */
export async function upsertBudget(input: Omit<Budget, 'id'>): Promise<void> {
  let existing = supabase
    .from('budgets')
    .select('id')
    .eq('space_id', input.space_id)
    .eq('category_id', input.category_id)
    .eq('scope', input.scope);
  existing = input.attributed_to ? existing.eq('attributed_to', input.attributed_to) : existing.is('attributed_to', null);

  const { data: found, error: selErr } = await existing.maybeSingle();
  if (selErr) throw selErr;

  if (found) {
    const { error } = await supabase.from('budgets').update({ amount: input.amount }).eq('id', found.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('budgets').insert(input);
    if (error) throw error;
  }
}
