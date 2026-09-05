BEGIN;

-- snooze_count zera sempre que o PASSO muda — no trigger, não só na RPC.
--
-- Primeira versão desta migration zerava só dentro de advance_enrollment_after_step.
-- QA (REL-001) apontou que outros caminhos mudam current_step com UPDATE direto e
-- carregariam o contador para o passo seguinte: reportWhatsAppInvalid (desvio do
-- "contato inválido"), external-call.service (ligação externa avança passo) e o
-- remap do editor de cadência. Zerar no trigger calculate_next_step_due — que já
-- roda em BEFORE UPDATE OF current_step — cobre todos de uma vez.
--
-- Tudo o mais no trigger é idêntico à 20260905120000 (9h BRT / skip_weekend_brt).
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
  -- Limite de adiamentos é POR PASSO: mudou o passo, zera o contador.
  IF TG_OP = 'UPDATE' AND NEW.current_step IS DISTINCT FROM OLD.current_step THEN
    NEW.snooze_count := 0;
  END IF;

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
  'Trigger BEFORE INSERT/UPDATE OF current_step, status em cadence_enrollments. Zera snooze_count quando current_step muda. Cadência manual com delay_days >= 1 vence às 09:00 BRT do dia alvo; delay 0 e auto_email vencem em now() + delay. Sempre passa por skip_weekend_brt.';

-- A RPC continua zerando também (redundante, mas explícito e sem custo).
CREATE OR REPLACE FUNCTION public.advance_enrollment_after_step(
  p_enrollment_id uuid,
  p_executed_step_id uuid,
  p_performed_by uuid
)
RETURNS TABLE(advanced boolean, completed boolean, new_step integer)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cadence_id uuid;
  v_lead_id uuid;
  v_org_id uuid;
  v_executed_order integer;
  v_old_step integer;
  v_next_order integer;
BEGIN
  -- Trava a linha do enrollment ativo (serializa execuções concorrentes).
  SELECT ce.cadence_id, ce.lead_id, ce.org_id, ce.current_step
    INTO v_cadence_id, v_lead_id, v_org_id, v_old_step
  FROM cadence_enrollments ce
  WHERE ce.id = p_enrollment_id AND ce.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::integer;
    RETURN;
  END IF;

  SELECT cs.step_order INTO v_executed_order
  FROM cadence_steps cs
  WHERE cs.id = p_executed_step_id AND cs.cadence_id = v_cadence_id;

  IF v_executed_order IS NULL THEN
    RETURN QUERY SELECT false, false, v_old_step;
    RETURN;
  END IF;

  -- Idempotente: enrollment já avançou além do step executado → nada a fazer.
  IF v_old_step > v_executed_order THEN
    RETURN QUERY SELECT false, false, v_old_step;
    RETURN;
  END IF;

  -- Audita steps pulados no intervalo [v_old_step, v_executed_order) — mantém
  -- a timeline completa quando o SDR executa um step à frente do cursor.
  INSERT INTO interactions (org_id, lead_id, cadence_id, step_id, channel, type, message_content, performed_by, metadata)
  SELECT v_org_id, v_lead_id, v_cadence_id, s.id, 'system', 'sent',
         'Etapa ' || s.step_order || ' pulada — SDR executou a etapa ' || v_executed_order || ' primeiro.',
         p_performed_by,
         jsonb_build_object(
           'system_event', 'step_skipped',
           'reason', 'advanced_past',
           'skipped_step_order', s.step_order,
           'executed_step_order', v_executed_order
         )
  FROM cadence_steps s
  WHERE s.cadence_id = v_cadence_id
    AND s.step_order >= v_old_step
    AND s.step_order < v_executed_order;

  -- Próximo step após o executado.
  SELECT MIN(cs.step_order) INTO v_next_order
  FROM cadence_steps cs
  WHERE cs.cadence_id = v_cadence_id AND cs.step_order > v_executed_order;

  IF v_next_order IS NOT NULL THEN
    -- Trigger calculate_next_step_due recalcula next_step_due e zera snooze_count.
    UPDATE cadence_enrollments
      SET current_step = v_next_order, snooze_count = 0
      WHERE id = p_enrollment_id;
    RETURN QUERY SELECT true, false, v_next_order;
  ELSE
    UPDATE cadence_enrollments SET status = 'completed', completed_at = now() WHERE id = p_enrollment_id;
    RETURN QUERY SELECT true, true, v_old_step;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_enrollment_after_step(uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;
