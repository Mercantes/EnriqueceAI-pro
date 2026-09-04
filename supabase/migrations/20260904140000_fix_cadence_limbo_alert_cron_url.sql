-- O cron `cadence-limbo-alert` (20260812120100) foi agendado com
-- `current_setting('app.settings.app_url')` sem missing_ok. O Supabase hospedado
-- não permite ALTER DATABASE SET, então o parâmetro nunca existe e TODA execução
-- falhava desde 14/ago/2026 com:
--   ERROR: unrecognized configuration parameter "app.settings.app_url"
--
-- Mesmo bug já corrigido em 20260511180000_fix_cron_jobs_url_pattern.sql para
-- outros dois crons. Produção foi corrigida fora de banda (URL fixa + token real
-- via cron.schedule). Esta migration aplica o mesmo padrão de forma idempotente
-- para que ambientes novos / reaplicações não recriem o bug.
--
-- O token NÃO entra no git. Em ambiente novo, trocar o placeholder ou rodar
-- `cron.alter_job` depois de aplicar.

BEGIN;

DO $$
DECLARE
  current_cmd TEXT;
BEGIN
  SELECT command INTO current_cmd FROM cron.job WHERE jobname = 'cadence-limbo-alert';
  IF current_cmd IS NOT NULL AND current_cmd LIKE '%current_setting(''app.settings.app_url''%' THEN
    PERFORM cron.unschedule('cadence-limbo-alert');
    PERFORM cron.schedule(
      'cadence-limbo-alert',
      '0 12 * * 1-5',
      $cron$
      SELECT net.http_post(
        url := 'https://app.enriqueceai.com.br/api/cron/cadence-limbo-alert',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'REPLACE_ME'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

COMMIT;
