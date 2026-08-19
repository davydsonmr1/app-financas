-- ============================================================================
-- app-financas — 003_income_sharing.sql
--
-- Bug de design encontrado antes de qualquer dado real existir: a policy
-- original de `incomes` era "só o dono lê", ponto. Isso contradiz o próprio
-- ESCOPO §4.2 — "num Espaço compartilhado as rendas dos membros somam", com
-- toggle por membro (`share_income`). Sem ajustar a policy, o app nunca
-- conseguiria ler o salário do cônjuge para somar, mesmo com o toggle ligado.
--
-- Nova regra: a renda de um usuário é visível para outro se existe um Espaço
-- onde os dois são membros E o dono da renda tem share_income=true NAQUELE
-- Espaço. Edição continua estritamente privada ao dono.
-- ============================================================================

drop policy if exists incomes_all on incomes;

create policy incomes_select on incomes for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from space_members viewer
      join space_members owner on owner.space_id = viewer.space_id
      where viewer.user_id = auth.uid()
        and owner.user_id = incomes.user_id
        and owner.share_income = true
    )
  );

create policy incomes_insert on incomes for insert
  with check (user_id = auth.uid());

create policy incomes_update on incomes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy incomes_delete on incomes for delete
  using (user_id = auth.uid());
