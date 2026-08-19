-- ============================================================================
-- app-financas — 001_initial_schema.sql
-- Schema inicial: Espaços, atribuição, lançamentos, recorrentes, orçamentos.
-- Toda tabela com RLS. Ver docs/ESCOPO.md.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums ----
create type transaction_kind as enum ('expense', 'income', 'investment');
create type payment_method   as enum ('cash', 'pix', 'debit', 'credit', 'boleto');
create type member_role      as enum ('owner', 'member');
create type budget_scope     as enum ('space', 'attribution');

-- ------------------------------------------------------------ utilidade ----
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Dia do lançamento de um recorrente numa competência.
-- Trata dia 31 em mês de 30 dias sem estourar (make_date levantaria erro).
create or replace function recurrence_date(p_comp date, p_day int)
returns date language sql immutable as $$
  select (
    p_comp + (
      least(p_day, extract(day from (p_comp + interval '1 month' - interval '1 day'))::int) - 1
    ) * interval '1 day'
  )::date;
$$;

-- ============================================================ profiles ====
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  theme        text not null default 'system',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ============================================================== spaces ====
create table spaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  icon          text not null default 'home',
  color         text not null default '#6366f1',
  owner_id      uuid not null references profiles(id) on delete restrict,
  has_password  boolean not null default false,
  is_personal   boolean not null default false,
  invite_code   text not null unique
                default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger spaces_updated before update on spaces
  for each row execute function set_updated_at();

-- O hash NUNCA fica em spaces. Membro de um Espaco pode ler a linha inteira de
-- spaces via RLS — teria o bcrypt em maos para atacar offline, e continuaria
-- com ele depois de ser removido. Aqui: RLS ligado e ZERO policies, ou seja,
-- inacessivel pela API. So as funcoes SECURITY DEFINER tocam nesta tabela.
create table space_secrets (
  space_id      uuid primary key references spaces(id) on delete cascade,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

create table space_members (
  space_id     uuid not null references spaces(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         member_role not null default 'member',
  share_income boolean not null default true,
  joined_at    timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index on space_members (user_id);

-- Helpers SECURITY DEFINER: quebram a recursão de RLS.
-- Uma policy em space_members que consultasse space_members recursaria infinito.
create or replace function is_space_member(p_space_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create or replace function is_space_owner(p_space_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from space_members
    where space_id = p_space_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function shares_space_with(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from space_members m1
    join space_members m2 on m1.space_id = m2.space_id
    where m1.user_id = auth.uid() and m2.user_id = p_user
  );
$$;

-- ============================================================= incomes ====
-- Renda RECORRENTE esperada (salário). Entradas avulsas vão em transactions
-- com kind='income'. Salário nunca é lançado como transação — ver ESCOPO 4.2.
create table incomes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  label          text not null default 'Salário',
  amount         numeric(12,2) not null check (amount >= 0),
  effective_from date not null,
  effective_to   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index on incomes (user_id, effective_from);
create trigger incomes_updated before update on incomes
  for each row execute function set_updated_at();

-- ========================================================== categories ====
create table category_templates (
  id         serial primary key,
  name       text not null,
  icon       text not null,
  color      text not null,
  kind       transaction_kind not null,
  sort_order int not null default 100
);

-- Copiadas para dentro de cada Espaço na criação. NUNCA space_id null.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  icon        text not null default 'tag',
  color       text not null default '#94a3b8',
  kind        transaction_kind not null default 'expense',
  sort_order  int not null default 100,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index categories_unique_name
  on categories (space_id, kind, lower(name)) where archived_at is null;
create index on categories (space_id) where archived_at is null;

-- ========================================================= recurrences ====
create table recurrences (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references spaces(id) on delete cascade,
  created_by     uuid not null references profiles(id),
  attributed_to  uuid references profiles(id),
  category_id    uuid references categories(id) on delete set null,
  kind           transaction_kind not null default 'expense',
  amount         numeric(12,2) not null check (amount > 0),
  description    text not null default '',
  payment_method payment_method,
  day_of_month   int not null check (day_of_month between 1 and 31),
  start_date     date not null,
  end_date       date,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on recurrences (space_id) where active;
create trigger recurrences_updated before update on recurrences
  for each row execute function set_updated_at();

-- ======================================================== transactions ====
create table transactions (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references spaces(id) on delete cascade,
  user_id              uuid not null references profiles(id),  -- quem REGISTROU
  attributed_to        uuid references profiles(id),           -- null = Casa
  category_id          uuid references categories(id) on delete set null,
  kind                 transaction_kind not null default 'expense',
  amount               numeric(12,2) not null check (amount > 0),
  description          text not null default '',
  occurred_at          date not null,
  payment_method       payment_method,
  installment_group_id uuid,
  installment_no       int,
  installment_total    int,
  recurrence_id        uuid references recurrences(id) on delete set null,
  competencia          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  check (installment_no is null or (installment_total is not null
         and installment_no between 1 and installment_total))
);

-- Impede o pg_cron de duplicar o aluguel se o job rodar duas vezes.
create unique index transactions_recurrence_competencia_uniq
  on transactions (recurrence_id, competencia)
  where recurrence_id is not null and deleted_at is null;

create index on transactions (space_id, occurred_at) where deleted_at is null;
create index on transactions (space_id, attributed_to, occurred_at) where deleted_at is null;
create index on transactions (space_id, category_id, occurred_at) where deleted_at is null;
create index on transactions (installment_group_id) where installment_group_id is not null;
create trigger transactions_updated before update on transactions
  for each row execute function set_updated_at();

-- ============================================================= refunds ====
-- Reembolso ABATE do gasto original — nunca vira receita. Ver ESCOPO 4.3.
create table refunds (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  occurred_at    date not null default current_date,
  note           text not null default '',
  created_at     timestamptz not null default now()
);
create index on refunds (transaction_id);

-- ============================================================= budgets ====
create table budgets (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  scope         budget_scope not null default 'space',
  attributed_to uuid references profiles(id),
  amount        numeric(12,2) not null check (amount > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index budgets_unique
  on budgets (space_id, category_id, scope, coalesce(attributed_to, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger budgets_updated before update on budgets
  for each row execute function set_updated_at();

-- ========================================================= ai_messages ====
create table ai_messages (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index on ai_messages (space_id, user_id, created_at);

-- ================================================ view: valor efetivo ====
-- security_invoker: a view respeita o RLS de quem consulta, não o do dono.
create view v_transactions with (security_invoker = true) as
select
  t.*,
  t.amount - coalesce((select sum(r.amount) from refunds r where r.transaction_id = t.id), 0)
    as effective_amount
from transactions t
where t.deleted_at is null;

-- ============================================================ funções ====

create or replace function seed_space_categories(p_space_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into categories (space_id, name, icon, color, kind, sort_order)
  select p_space_id, name, icon, color, kind, sort_order from category_templates;
$$;

-- Novo usuário → profile + Espaço Pessoal + categorias padrão.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
                           split_part(new.email, '@', 1)));

  insert into spaces (name, icon, color, owner_id, is_personal)
  values ('Pessoal', 'user', '#6366f1', new.id, true)
  returning id into v_space;

  insert into space_members (space_id, user_id, role) values (v_space, new.id, 'owner');
  perform seed_space_categories(v_space);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function create_space(
  p_name text, p_icon text default 'home',
  p_color text default '#6366f1', p_password text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;
  insert into spaces (name, icon, color, owner_id, has_password)
  values (trim(p_name), p_icon, p_color, auth.uid(), coalesce(p_password, '') <> '')
  returning id into v_id;

  if coalesce(p_password, '') <> '' then
    insert into space_secrets (space_id, password_hash)
    values (v_id, extensions.crypt(p_password, extensions.gen_salt('bf')));
  end if;

  insert into space_members (space_id, user_id, role) values (v_id, auth.uid(), 'owner');
  perform seed_space_categories(v_id);
  return v_id;
end $$;

-- Ingresso sem vazar o hash: spaces é ilegível para não-membros, e esta função
-- valida internamente e devolve só o id. Ver ESCOPO 3.
create or replace function join_space(p_invite_code text, p_password text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_space spaces%rowtype;
  v_hash  text;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into v_space from spaces where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'convite invalido' using errcode = 'P0002';
  end if;

  select password_hash into v_hash from space_secrets where space_id = v_space.id;

  if v_hash is not null
     and (p_password is null
          or v_hash <> extensions.crypt(p_password, v_hash)) then
    raise exception 'senha incorreta' using errcode = 'P0001';
  end if;

  insert into space_members (space_id, user_id, role)
  values (v_space.id, auth.uid(), 'member')
  on conflict do nothing;

  return v_space.id;
end $$;

-- Gera os recorrentes da competência de p_ref, só até o dia já vencido.
-- Idempotente pelo índice único (recurrence_id, competencia).
create or replace function generate_recurrences(p_ref date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_comp  date := date_trunc('month', p_ref)::date;
  v_count int;
begin
  insert into transactions (
    space_id, user_id, attributed_to, category_id, kind, amount,
    description, occurred_at, payment_method, recurrence_id, competencia)
  select r.space_id, r.created_by, r.attributed_to, r.category_id, r.kind, r.amount,
         r.description, recurrence_date(v_comp, r.day_of_month),
         r.payment_method, r.id, v_comp
  from recurrences r
  where r.active
    and r.start_date <= recurrence_date(v_comp, r.day_of_month)
    and (r.end_date is null or r.end_date >= recurrence_date(v_comp, r.day_of_month))
    and recurrence_date(v_comp, r.day_of_month) <= p_ref
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ================================================================ RLS ====
alter table profiles           enable row level security;
alter table spaces             enable row level security;
alter table space_secrets      enable row level security;  -- SEM policies: ninguem le
-- Defesa em profundidade: RLS sem policy ja devolve 0 linhas, mas o revoke
-- barra no nivel de GRANT. Se alguem adicionar uma policy por engano no
-- futuro, o hash continua inacessivel pela API.
revoke all on space_secrets from anon, authenticated;
alter table space_members      enable row level security;
alter table incomes            enable row level security;
alter table categories         enable row level security;
alter table category_templates enable row level security;
alter table recurrences        enable row level security;
alter table transactions       enable row level security;
alter table refunds            enable row level security;
alter table budgets            enable row level security;
alter table ai_messages        enable row level security;

-- profiles: eu mesmo, ou quem divide um Espaço comigo
create policy profiles_select on profiles for select
  using (id = auth.uid() or shares_space_with(id));
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- spaces: ILEGÍVEL para não-membros (protege o password_hash)
create policy spaces_select on spaces for select using (is_space_member(id));
create policy spaces_insert on spaces for insert with check (owner_id = auth.uid());
create policy spaces_update on spaces for update using (is_space_owner(id));
create policy spaces_delete on spaces for delete using (is_space_owner(id));

-- space_members: entrada só via join_space(); saída livre; dono remove
create policy members_select on space_members for select using (is_space_member(space_id));
create policy members_delete on space_members for delete
  using (user_id = auth.uid() or is_space_owner(space_id));
create policy members_update on space_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- incomes: estritamente privado ao dono
create policy incomes_all on incomes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy categories_all on categories for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy templates_select on category_templates for select
  using (auth.uid() is not null);

create policy recurrences_all on recurrences for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy transactions_all on transactions for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy refunds_all on refunds for all
  using (exists (select 1 from transactions t
                 where t.id = refunds.transaction_id and is_space_member(t.space_id)))
  with check (exists (select 1 from transactions t
                 where t.id = refunds.transaction_id and is_space_member(t.space_id)));

create policy budgets_all on budgets for all
  using (is_space_member(space_id)) with check (is_space_member(space_id));

-- chat é privado por usuário, mesmo dentro do Espaço
create policy ai_messages_all on ai_messages for all
  using (user_id = auth.uid() and is_space_member(space_id))
  with check (user_id = auth.uid() and is_space_member(space_id));

-- ================================================ categorias padrão ====
insert into category_templates (name, icon, color, kind, sort_order) values
  ('Mercado',           'shopping-cart', '#22c55e', 'expense',     10),
  ('Alimentação fora',  'utensils',      '#f97316', 'expense',     20),
  ('Transporte',        'car',           '#3b82f6', 'expense',     30),
  ('Moradia',           'home',          '#8b5cf6', 'expense',     40),
  ('Saúde',             'heart-pulse',   '#ef4444', 'expense',     50),
  ('Lazer',             'gamepad-2',     '#ec4899', 'expense',     60),
  ('Assinaturas',       'repeat',        '#06b6d4', 'expense',     70),
  ('Educação',          'book-open',     '#eab308', 'expense',     80),
  ('Pets',              'dog',           '#a855f7', 'expense',     90),
  ('Vestuário',         'shirt',         '#14b8a6', 'expense',    100),
  ('Cuidados pessoais', 'scissors',      '#f43f5e', 'expense',    110),
  ('Presentes',         'gift',          '#fb7185', 'expense',    120),
  ('Impostos e taxas',  'landmark',      '#64748b', 'expense',    130),
  ('Outros',            'circle-dashed', '#94a3b8', 'expense',    999),
  ('Freelance',         'briefcase',     '#22c55e', 'income',      10),
  ('Venda',             'tag',           '#84cc16', 'income',      20),
  ('Presente recebido', 'gift',          '#fb7185', 'income',      30),
  ('Outros',            'circle-dashed', '#94a3b8', 'income',     999),
  ('Reserva',           'shield',        '#0ea5e9', 'investment',  10),
  ('Renda fixa',        'landmark',      '#6366f1', 'investment',  20),
  ('Ações',             'trending-up',   '#22c55e', 'investment',  30),
  ('FIIs',              'building-2',    '#f59e0b', 'investment',  40),
  ('Cripto',            'bitcoin',       '#f97316', 'investment',  50),
  ('Outros',            'circle-dashed', '#94a3b8', 'investment', 999);
