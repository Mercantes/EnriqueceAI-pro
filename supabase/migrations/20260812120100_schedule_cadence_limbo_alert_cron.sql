BEGIN;

-- Cron: alerta diário de leads em limbo de cadência (9h BRT = 12h UTC, seg-sex).
-- Padrão canônico com current_setting (sem token hardcoded). unschedule-if-exists
-- para ser idempotente em reaplicações.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cadence-limbo-alert') THEN
    PERFORM cron.unschedule('cadence-limbo-alert');
  END IF;
END $$;

SELECT cron.schedule(
  'cadence-limbo-alert',
  '0 12 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/cadence-limbo-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMIT;
