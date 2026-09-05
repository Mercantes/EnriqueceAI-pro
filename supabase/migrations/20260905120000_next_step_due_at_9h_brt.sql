BEGIN;

-- Vencimento da próxima atividade às 9h BRT do dia alvo (cadências manuais).
--
-- Antes: next_step_due = now() + delay → a próxima atividade vencia na MESMA
-- hora do relógio em que o SDR executou a anterior (executou 16h → vence
-- amanhã 16h). Como a fila só mostra o que já venceu, o SDR "zerava" a lista
-- de manhã e as tarefas iam chegando hora a hora ao longo do dia, virando
-- "atrasadas" 4h depois. Sensação relatada: "termina as que tinha e aparecem
-- várias atrasadas".
--
-- Agora: passo com delay_days >= 1 em cadência manual vence às 09:00 BRT de
-- (hoje + delay_days), depois skip_weekend_brt. O SDR abre a fila às 9h com o
-- dia inteiro na frente; nada aparece "do nada" à tarde.
--
-- Mantido como estava:
-- - delay 0 (ligação + WhatsApp no mesmo dia): vence na hora, por desenho.
-- - cadências auto_email: continuam now() + delay, para espalhar os envios
--   pelo horário comercial (evita rajada às 9h e limites do Gmail).
-- - fim de semana → segunda 09:00 (skip_weekend_brt).
CREATE OR REPLACE FUNCTION public.calculate_next_step_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  step RECORD;
  v_cadence_type text;
  raw_due timestamptz;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT delay_days, delay_hours INTO step
    FROM cadence_steps
    WHERE cadence_id = NEW.cadence_id AND step_order = NEW.current_step;

    IF FOUND THEN
      SELECT type::text INTO v_cadence_type FROM cadences WHERE id = NEW.cadence_id;

      IF step.delay_days >= 1 AND coalesce(v_cadence_type, '') <> 'auto_email' THEN
        -- 09:00 BRT do dia alvo (data BRT de hoje + delay_days)
        raw_due := (
          ((now() AT TIME ZONE 'America/Sao_Paulo')::date + step.delay_days) + time '09:00'
        ) AT TIME ZONE 'America/Sao_Paulo';
      ELSE
        raw_due := now() + make_interval(days => step.delay_days, hours => step.delay_hours);
      END IF;

      NEW.next_step_due := public.skip_weekend_brt(raw_due);
    ELSE
      -- Step not found — set to now() so the engine can mark as completed
      NEW.next_step_due := now();
    END IF;
  ELSIF NEW.status IN ('completed', 'replied', 'bounced', 'unsubscribed', 'paused') THEN
    NEW.next_step_due := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.calculate_next_step_due() IS
  'Trigger BEFORE INSERT/UPDATE OF current_step, status em cadence_enrollments. Cadência manual com delay_days >= 1 vence às 09:00 BRT do dia alvo; delay 0 e auto_email vencem em now() + delay. Sempre passa por skip_weekend_brt.';

COMMIT;
