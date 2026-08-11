-- Webhook de reunião marcada: expõe na view o NOME do closer responsável
-- (closers.name, dono do responsavel_email) e o user_id do SDR que MARCOU a
-- reunião (performed_by da interação meeting_scheduled). O nome do SDR é
-- resolvido no serviço (auth.users), pra não expor auth.users na view.
-- Colunas existentes ficam INALTERADAS (o n8n depende de todas) — só adiciona
-- `responsavel` e `sdr_user_id` ao final.
CREATE OR REPLACE VIEW public.v_meeting_webhook_candidates AS
SELECT l.org_id,
    l.id AS lead_id,
    l.first_name,
    l.last_name,
    l.razao_social,
    l.nome_fantasia,
    l.meeting_starts_at,
    l.meeting_scheduled_at,
    mi.meet_link,
    mi.calendar_event_id,
    COALESCE(wa.whatsapp_phone, normalize_br_phone(l.telefone), ( SELECT normalize_br_phone(p.elem) AS normalize_br_phone
           FROM jsonb_array_elements_text(
                CASE
                    WHEN jsonb_typeof(l.phones) = 'array'::text THEN l.phones
                    ELSE '[]'::jsonb
                END) p(elem)
          WHERE normalize_br_phone(p.elem) IS NOT NULL
         LIMIT 1)) AS whatsapp_phone,
    cl.email AS responsavel_email,
    cl.name AS responsavel,
    mi.performed_by AS sdr_user_id
   FROM leads l
     LEFT JOIN LATERAL ( SELECT i.metadata ->> 'meet_link'::text AS meet_link,
            i.metadata ->> 'calendar_event_id'::text AS calendar_event_id,
            i.performed_by
           FROM interactions i
          WHERE i.lead_id = l.id AND i.type = 'meeting_scheduled'::interaction_type
          ORDER BY i.created_at DESC
         LIMIT 1) mi ON true
     LEFT JOIN LATERAL ( SELECT normalize_br_phone(c.destination) AS whatsapp_phone
           FROM calls c
          WHERE c.lead_id = l.id AND c.connected AND normalize_br_phone(c.destination) IS NOT NULL
          ORDER BY c.started_at DESC NULLS LAST
         LIMIT 1) wa ON true
     LEFT JOIN closers cl ON cl.id = l.closer_id AND cl.deleted_at IS NULL
  WHERE l.meeting_starts_at IS NOT NULL AND l.meeting_starts_at > now() AND l.meeting_held_at IS NULL AND l.deleted_at IS NULL AND (l.status <> ALL (ARRAY['archived'::lead_status, 'unqualified'::lead_status, 'won'::lead_status])) AND l.assigned_to IS NOT NULL;
