BEGIN;

-- =============================================================================
-- Meeting webhook — fallback de telefone — 2026-08-09
-- Antes: telefone vinha SÓ da última ligação conectada → leads sem ligação
-- iam com telefone null. Agora: COALESCE(ligação conectada → leads.telefone →
-- 1º válido de leads.phones), tudo normalizado (55DDD…). Mantém a ordem das
-- colunas (restrição do CREATE OR REPLACE VIEW).
-- =============================================================================

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
  COALESCE(
    wa.whatsapp_phone,
    public.normalize_br_phone(l.telefone),
    (SELECT public.normalize_br_phone(p.elem)
       FROM jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(l.phones) = 'array' THEN l.phones ELSE '[]'::jsonb END
       ) AS p(elem)
       WHERE public.normalize_br_phone(p.elem) IS NOT NULL
       LIMIT 1)
  ) AS whatsapp_phone,
  cl.email AS responsavel_email
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
  LEFT JOIN public.closers cl ON cl.id = l.closer_id AND cl.deleted_at IS NULL
WHERE l.meeting_starts_at IS NOT NULL
  AND l.meeting_starts_at > now()
  AND l.meeting_held_at IS NULL
  AND l.deleted_at IS NULL
  AND l.status <> ALL (ARRAY['archived'::lead_status, 'unqualified'::lead_status, 'won'::lead_status])
  AND l.assigned_to IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
