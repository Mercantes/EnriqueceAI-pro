BEGIN;

-- =============================================================================
-- Meeting webhook dispatch — 2026-08-08
-- Dispara um POST para o n8n (fluxo externo) na véspera (D-1) e no dia da
-- reunião. Standalone: NÃO usa reminder_steps/templates (isso é a régua de
-- e-mail/WhatsApp). Aqui só existe a fonte de candidatos + o log de idempotência.
-- =============================================================================

-- 1. View de candidatos: um lead-reunião válido por linha, já com meet_link,
--    calendar_event_id e telefone (mesma derivação da v_reminders_due).
--    O escopo por org fica no serviço (.eq('org_id', ...)) — a view é geral.
CREATE OR REPLACE VIEW public.v_meeting_webhook_candidates AS
SELECT
  l.org_id,
  l.id AS lead_id,
  l.first_name,
  l.last_name,
  l.razao_social,
  l.nome_fantasia,
  l.meeting_starts_at,
  l.meeting_scheduled_at,
  mi.meet_link,
  mi.calendar_event_id,
  wa.whatsapp_phone
FROM public.leads l
  LEFT JOIN LATERAL (
    SELECT i.metadata ->> 'meet_link' AS meet_link,
           i.metadata ->> 'calendar_event_id' AS calendar_event_id
    FROM public.interactions i
    WHERE i.lead_id = l.id AND i.type = 'meeting_scheduled'::interaction_type
    ORDER BY i.created_at DESC
    LIMIT 1
  ) mi ON true
  LEFT JOIN LATERAL (
    SELECT public.normalize_br_phone(c.destination) AS whatsapp_phone
    FROM public.calls c
    WHERE c.lead_id = l.id
      AND c.connected
      AND public.normalize_br_phone(c.destination) IS NOT NULL
    ORDER BY c.started_at DESC NULLS LAST
    LIMIT 1
  ) wa ON true
WHERE l.meeting_starts_at IS NOT NULL
  AND l.meeting_starts_at > now()
  AND l.meeting_held_at IS NULL
  AND l.deleted_at IS NULL
  AND l.status <> ALL (ARRAY['archived'::lead_status, 'unqualified'::lead_status, 'won'::lead_status])
  AND l.assigned_to IS NOT NULL;

-- 2. Log de idempotência: 1 disparo por (lead, início da reunião, momento).
--    A chave inclui meeting_starts_at → reagendamento gera novos disparos
--    (chave nova), igual à mecânica do meeting_reminder_log.
CREATE TABLE IF NOT EXISTS public.meeting_webhook_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  meeting_starts_at TIMESTAMPTZ NOT NULL,
  momento TEXT NOT NULL,               -- 'd1' | 'dia'
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  detail TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meeting_webhook_dispatch_log_uniq UNIQUE (lead_id, meeting_starts_at, momento)
);

ALTER TABLE public.meeting_webhook_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meeting_webhook_dispatch_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Escrita é exclusiva do serviço (service role → bypassa RLS). Leitura só do
-- próprio org (managers/SDRs), para debug no painel/Supabase.
CREATE POLICY meeting_webhook_dispatch_log_org_select ON public.meeting_webhook_dispatch_log
  FOR SELECT USING (org_id = (SELECT public.user_org_id()));

CREATE INDEX IF NOT EXISTS idx_mwdl_org_meeting
  ON public.meeting_webhook_dispatch_log (org_id, meeting_starts_at);

COMMIT;

NOTIFY pgrst, 'reload schema';
