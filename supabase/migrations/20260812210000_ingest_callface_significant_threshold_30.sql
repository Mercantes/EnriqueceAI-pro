-- Callface: alinha o threshold "significant" de 50s para 30s.
--
-- A ingest_callface_call classificava significant com `duration >= 50`, enquanto
-- o resto do sistema (API4COM / app / Sales Hub) usa 30s (o default de
-- organization_call_settings / DEFAULT_SIGNIFICANT_THRESHOLD_SECONDS). Não muda
-- a contagem de "conectadas" (o answered_at já resolve isso), só o rótulo
-- significant vs not_significant — mas alinhar evita inconsistência entre fontes.
--
-- Aplicada em prod via MCP em 12/08; migration = paridade git <-> banco.
--
-- (A entrega imediata de cada ligação Callface ao Sales Hub é feita fora do git:
-- um nó "Disparar Sync V4" no workflow n8n "Callface → EnriqueceAI" aciona o
-- webhook do Sync Calls após o ingest — o Callface é fonte separada e não era
-- coberto pelo sync disparado pelo fluxo API4COM.)

BEGIN;

CREATE OR REPLACE FUNCTION public.ingest_callface_call(p_payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_call_link   text := p_payload->>'call_link';
  v_callface_id text;
  v_email       text := lower(nullif(btrim(p_payload->>'user_email'), ''));
  v_user_id     uuid;
  v_org_id      uuid;
  v_dest_raw    text := coalesce(p_payload->>'destination_number', '');
  v_dest        text := regexp_replace(coalesce(p_payload->>'destination_number',''), '[^0-9]', '', 'g');
  v_duration    int  := coalesce((p_payload->>'call_duration')::numeric, 0)::int;
  v_status_raw  text := upper(coalesce(p_payload->>'call_status', ''));
  v_connected   boolean;
  v_status      call_status;
  v_type        call_type;
  v_started     timestamptz;
  v_lead_id     uuid;
  v_transcript  text;
  v_metadata    jsonb;
  v_call_id     uuid;
  v_action      text;
BEGIN
  v_callface_id := nullif(regexp_replace(coalesce(v_call_link, ''), '^.*/', ''), '');
  IF v_callface_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_call_link');
  END IF;

  SELECT om.user_id, om.org_id INTO v_user_id, v_org_id
  FROM organization_members om JOIN auth.users u ON u.id = om.user_id
  WHERE lower(u.email) = v_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found', 'user_email', v_email, 'callface_call_id', v_callface_id);
  END IF;

  v_started   := coalesce((p_payload->>'call_date')::timestamptz, now());
  v_connected := v_status_raw IN ('FINISHED', 'ANSWERED', 'COMPLETED');

  -- Threshold significativo alinhado a 30s (era 50).
  v_status := CASE
    WHEN NOT v_connected     THEN 'not_connected'::call_status
    WHEN v_duration >= 30    THEN 'significant'::call_status
    ELSE                          'not_significant'::call_status
  END;

  v_type := CASE
    WHEN coalesce(p_payload->>'call_audio_url','') ~ '/IN-' THEN 'inbound'::call_type
    ELSE 'outbound'::call_type
  END;

  v_lead_id := find_lead_id_by_phone(v_org_id, v_dest, v_user_id);

  SELECT string_agg(
           CASE WHEN seg->>'speaker' = 'client' THEN 'Lead: ' ELSE 'SDR: ' END || coalesce(seg->>'text',''),
           E'\n' ORDER BY coalesce((seg->>'time')::numeric, 0))
    INTO v_transcript
  FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(p_payload->'transcription') = 'array'
              THEN p_payload->'transcription' ELSE '[]'::jsonb END) seg;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'provider', 'callface', 'callface_call_id', v_callface_id, 'call_link', v_call_link,
    'callface_status', v_status_raw, 'workspace_name', p_payload->>'workspace_name',
    'agent_name', p_payload->>'agent_name', 'user_email', v_email, 'user_name', p_payload->>'user_name',
    'summarization', p_payload->>'summarization', 'deal_closure_percentage', p_payload->'deal_closure_percentage',
    'scheduling', p_payload->'scheduling'));

  INSERT INTO calls (
    org_id, user_id, lead_id, origin, destination, started_at, duration_seconds,
    status, type, connected, answered_at, hangup_cause, recording_url, notes,
    transcription, transcription_status, metadata
  ) VALUES (
    v_org_id, v_user_id, v_lead_id, 'callface', v_dest_raw, v_started, v_duration,
    v_status, v_type, v_connected, CASE WHEN v_connected THEN v_started END,
    nullif(v_status_raw, ''), p_payload->>'call_audio_url', p_payload->>'summarization',
    v_transcript, CASE WHEN v_transcript IS NOT NULL THEN 'completed' ELSE 'skipped' END, v_metadata
  )
  ON CONFLICT ((metadata->>'callface_call_id')) WHERE metadata->>'callface_call_id' IS NOT NULL
  DO UPDATE SET
    lead_id = coalesce(calls.lead_id, EXCLUDED.lead_id),
    duration_seconds = GREATEST(calls.duration_seconds, EXCLUDED.duration_seconds),
    status = EXCLUDED.status, connected = EXCLUDED.connected,
    answered_at = coalesce(calls.answered_at, EXCLUDED.answered_at),
    hangup_cause = EXCLUDED.hangup_cause,
    recording_url = coalesce(EXCLUDED.recording_url, calls.recording_url),
    notes = coalesce(calls.notes, EXCLUDED.notes),
    transcription = coalesce(EXCLUDED.transcription, calls.transcription),
    transcription_status = CASE WHEN EXCLUDED.transcription IS NOT NULL THEN 'completed' ELSE calls.transcription_status END,
    metadata = calls.metadata || EXCLUDED.metadata, updated_at = now()
  RETURNING id, (xmax = 0) INTO v_call_id, v_action;

  RETURN jsonb_build_object('ok', true, 'call_id', v_call_id, 'inserted', v_action::boolean,
    'user_id', v_user_id, 'lead_id', v_lead_id, 'lead_matched', v_lead_id IS NOT NULL,
    'status', v_status, 'duration_seconds', v_duration);
END;
$function$;

COMMIT;
