-- Guard-rail: bloqueia inscrição de lead SEM responsável (leads.assigned_to)
-- em cadências manuais.
--
-- Contexto (06/08/2026): duas cargas de prospecção ("Prospecção Fria" 24 +
-- "Prospecção Agro" 14) foram inscritas em cadência `standard` sem assigned_to.
-- Sem dono, os passos (Ligação/WhatsApp) viram tarefas que ninguém trabalha →
-- os leads esfriam e disparam o alerta "cadência sem atividade". 38 pausados.
--
-- Escopo: só cadências que geram trabalho manual (type <> 'auto_email'). Cadências
-- `auto_email` disparam sozinhas (nutrição inbound), então podem inscrever lead
-- sem dono sem gerar órfão. Trigger BEFORE INSERT pega TODOS os caminhos (ação do
-- app, import, inbound API/webhook, n8n). SECURITY DEFINER para checar o
-- assigned_to real do lead independente da RLS de quem insere. Forward-only.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_enrollment_has_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cadence_type text;
  v_assigned_to  uuid;
BEGIN
  SELECT type::text INTO v_cadence_type FROM public.cadences WHERE id = NEW.cadence_id;

  -- Cadência auto_email dispara sozinha → não exige responsável.
  IF v_cadence_type = 'auto_email' THEN
    RETURN NEW;
  END IF;

  SELECT assigned_to INTO v_assigned_to FROM public.leads WHERE id = NEW.lead_id;

  IF v_assigned_to IS NULL THEN
    RAISE EXCEPTION
      'Lead sem responsável não pode ser inscrito em cadência manual (tipo: %).',
      COALESCE(v_cadence_type, 'desconhecido')
      USING ERRCODE = 'check_violation',
            HINT = 'Atribua um SDR ao lead (assigned_to) antes de inscrever, ou use uma cadência auto_email.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_enrollment_has_owner ON public.cadence_enrollments;
CREATE TRIGGER enforce_enrollment_has_owner
  BEFORE INSERT ON public.cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_enrollment_has_owner();

COMMIT;
