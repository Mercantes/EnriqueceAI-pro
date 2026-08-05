-- Lembretes de reunião — suprime passos ancorados na reunião que disparariam
-- "atrasados" por agendamento em cima da hora.
--
-- Bug (05/08/2026): reunião marcada às 10:37 BRT para as 17:00 BRT do MESMO dia
-- disparou o passo D-1 ("Amanhã: o que preparei…") no mesmo tick, porque o
-- fire_at do D-1 (meeting_starts_at − 1440min) já estava no passado no momento
-- da marcação. Resultado: e-mail dizendo "Nossa reunião é amanhã" para uma
-- reunião que era HOJE.
--
-- Fix: passos ancorados na reunião (anchor='meeting': D-1 e T-60/120) só entram
-- na fila se a reunião foi marcada ANTES do momento de disparo do passo, ou seja
-- meeting_scheduled_at <= fire_at. Para o D-1 isso é exatamente "marcada com
-- ≥24h de antecedência". Passos on_book (confirmação) e leads sem
-- meeting_scheduled_at seguem o comportamento anterior. Forward-only.

BEGIN;

CREATE OR REPLACE VIEW public.v_reminders_due
WITH (security_invoker = true) AS
SELECT
    org_id,
    lead_id,
    sdr_user_id,
    first_name,
    last_name,
    razao_social,
    nome_fantasia,
    email,
    meeting_scheduled_at,
    meeting_starts_at,
    meet_link,
    calendar_event_id,
    reminder_step_id,
    context,
    step_order,
    channel,
    message_template_id,
    fire_at,
    whatsapp_phone
FROM (
  SELECT
    l.org_id,
    l.id AS lead_id,
    l.assigned_to AS sdr_user_id,
    l.first_name,
    l.last_name,
    l.razao_social,
    l.nome_fantasia,
    l.email,
    l.meeting_scheduled_at,
    l.meeting_starts_at,
    mi.meet_link,
    mi.calendar_event_id,
    rs.id AS reminder_step_id,
    rs.context,
    rs.step_order,
    rs.channel,
    rs.message_template_id,
    rs.anchor,
    CASE rs.anchor
      WHEN 'on_book'::text THEN l.meeting_scheduled_at + make_interval(mins => rs.offset_minutes)
      ELSE l.meeting_starts_at + make_interval(mins => rs.offset_minutes)
    END AS fire_at,
    wa.whatsapp_phone
  FROM leads l
    JOIN reminder_source_context m ON m.org_id = l.org_id AND m.lead_source = l.lead_source
    JOIN reminder_steps rs ON rs.org_id = l.org_id AND rs.context = m.context AND rs.active
    LEFT JOIN LATERAL (
      SELECT i.metadata ->> 'meet_link' AS meet_link,
             i.metadata ->> 'calendar_event_id' AS calendar_event_id
      FROM interactions i
      WHERE i.lead_id = l.id AND i.type = 'meeting_scheduled'::interaction_type
      ORDER BY i.created_at DESC
      LIMIT 1
    ) mi ON true
    LEFT JOIN LATERAL (
      SELECT normalize_br_phone(c.destination) AS whatsapp_phone
      FROM calls c
      WHERE c.lead_id = l.id AND c.connected AND normalize_br_phone(c.destination) IS NOT NULL
      ORDER BY c.started_at DESC NULLS LAST
      LIMIT 1
    ) wa ON true
  WHERE l.meeting_starts_at IS NOT NULL
    AND l.meeting_starts_at > now()
    AND l.meeting_held_at IS NULL
    AND l.deleted_at IS NULL
    AND (l.status <> ALL (ARRAY['archived'::lead_status, 'unqualified'::lead_status, 'won'::lead_status]))
    AND l.assigned_to IS NOT NULL
    AND (
      rs.channel = 'email'::text AND l.email IS NOT NULL AND l.email_bounced_at IS NULL
      OR rs.channel = 'whatsapp'::text AND wa.whatsapp_phone IS NOT NULL AND l.whatsapp_invalid_at IS NULL
    )
    AND NOT (EXISTS (
      SELECT 1
      FROM meeting_reminder_log lg
      WHERE lg.lead_id = l.id
        AND lg.reminder_step_id = rs.id
        AND lg.meeting_starts_at = l.meeting_starts_at
    ))
) x
WHERE fire_at <= now()
  -- Gate anti "amanhã que é hoje": passos ancorados na reunião só disparam se a
  -- reunião foi marcada antes do momento de disparo do passo. Agendamento <24h
  -- tem o fire_at do D-1 já no passado → seria enviado como se fosse a véspera.
  -- on_book e meeting_scheduled_at NULL seguem o comportamento anterior.
  AND (anchor <> 'meeting'::text OR meeting_scheduled_at IS NULL OR meeting_scheduled_at <= fire_at);

COMMIT;

NOTIFY pgrst, 'reload schema';
