export type TransactionKind = 'expense' | 'income' | 'investment';
export type PaymentMethod = 'cash' | 'pix' | 'debit' | 'credit' | 'boleto';
export type MemberRole = 'owner' | 'member';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  theme: string;
};

export type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  photo_url: string | null;
  owner_id: string;
  has_password: boolean;
  is_personal: boolean;
  invite_code: string;
  created_at: string;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: MemberRole;
  share_income: boolean;
};

export type Category = {
  id: string;
  space_id: string;
  name: string;
  icon: string;
  color: string;
  kind: TransactionKind;
  sort_order: number;
  archived_at: string | null;
};

export type Transaction = {
  id: string;
  space_id: string;
  /** quem REGISTROU o lançamento */
  user_id: string;
  /** a quem PERTENCE o gasto. null = Casa */
  attributed_to: string | null;
  category_id: string | null;
  kind: TransactionKind;
  amount: number;
  description: string;
  occurred_at: string;
  payment_method: PaymentMethod | null;
  installment_group_id: string | null;
  installment_no: number | null;
  installment_total: number | null;
  recurrence_id: string | null;
  competencia: string | null;
  deleted_at: string | null;
};

/** Vem da view v_transactions: amount menos a soma dos reembolsos. */
export type TransactionWithEffective = Transaction & { effective_amount: number };

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  boleto: 'Boleto',
};

export const KIND_LABELS: Record<TransactionKind, string> = {
  expense: 'Despesa',
  income: 'Receita',
  investment: 'Investimento',
};
