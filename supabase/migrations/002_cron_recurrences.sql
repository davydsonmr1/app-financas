-- ============================================================================
-- app-financas — 002_cron_recurrences.sql
-- Geração dos recorrentes no SERVIDOR, não no app.
--
-- Se rodasse no app: não abrir por uma semana = fixas faltando no dashboard;
-- e dois celulares abrindo junto lançariam o aluguel em duplicata.
-- A idempotência real vem do índice único (recurrence_id, competencia) em 001;
-- este job pode rodar quantas vezes quiser sem duplicar nada.
-- ============================================================================

create extension if not exists pg_cron;

-- 03:05 UTC = 00:05 em America/Sao_Paulo — logo depois da virada do dia,
-- para que um fixo com vencimento no dia N apareça já na manhã do dia N.
do $$
begin
  perform cron.unschedule('gerar-recorrentes');
exception when others then
  null;  -- ainda não existe, segue
end $$;

select cron.schedule(
  'gerar-recorrentes',
  '5 3 * * *',
  $job$ select public.generate_recurrences(); $job$
);
