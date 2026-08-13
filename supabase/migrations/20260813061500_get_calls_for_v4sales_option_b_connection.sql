-- Métrica "ligações conectadas" — regra "Opção B" (remove o fallback de duração
-- crua que inflava a conexão de TODOS os SDRs).
--
-- PROBLEMA: a regra answered-first (PR de 02/08 + migration 20260812120000) ainda
-- carregava `duration_seconds >= 30` como fallback. Os dados de agosto provaram que
-- isso conta FRACASSO DE DISCAGEM como conexão: a operadora deixa a gravação de
-- aviso ("este número foi alterado…") tocando 30-500s em não-atendimentos
-- (NUMBER_CHANGED, ORIGINATOR_CANCEL, UNALLOCATED_NUMBER, ...), todos com
-- `answered_at` nulo e `status='not_connected'`. Somava ~570 falsas conexões/mês na
-- org — e nem "salvava" o ramal sem webhook (Giovanni/1042: 197 dessas, só 7 com
-- gravação). Conexão = falar com o lead; isso não é.
--
-- FIX (Opção B, alinhada ao isConnectedCall do app, src/features/calls/connection.ts):
--   conectada = answered_at válido
--            OU status='significant'
--            OU (hangup_cause='NORMAL_CLEARING' E tem gravação E duração>=30)  ← proxy
--   e SEMPRE exclui sdr_disposition='voicemail'.
-- O proxy resgata a conversa genuína de ramais SEM webhook (answered_at nunca chega,
-- defeito da API4COM que não emite channel-answer) com PROVA POSITIVA — encerramento
-- normal de chamada atendida + gravação de áudio + duração real —, sem readmitir o
-- fracasso de discagem.
--
-- Esta migration (lado Enriquece):
--   1. overload p_from_date (consumida pelo n8n "Sync Calls"): passa a exportar
--      `hangup_cause` e `sdr_disposition` no payload, para o Sales Hub aplicar a
--      Opção B no cálculo de `connected` (o SH recomputa a flag no sync).
--   2. overload p_year/p_month (métricas): `ligacoes_conectadas` passa à Opção B.
--
-- Lado Sales Hub (projeto ejxlbbbjyexsoltsxiqq): a função sync_calls_from_enriquece
-- passou à Opção B e o histórico Abr-Ago foi recomputado re-puxando desta RPC (o
-- raw_payload histórico não tinha answered_at/hangup_cause). Ver
-- docs/integrations/saleshub-connected-metric-fix-2026-08.md (projeto separado).
--
-- Aplicada em prod via MCP em 13/08; esta migration é paridade git <-> banco.

BEGIN;

-- Overload consumida pelo n8n "Sync Calls": adiciona hangup_cause + sdr_disposition.
CREATE OR REPLACE FUNCTION public.get_calls_for_v4sales(p_from_date text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_from timestamptz;
    v_org_id uuid := 'c2727473-1df8-4faa-9264-a9fc1759fe3b';
BEGIN
    v_from := COALESCE(p_from_date::timestamptz, date_trunc('month', CURRENT_DATE));
    RETURN (
        SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
        FROM (
            SELECT id, user_id, origin, destination, started_at, duration_seconds,
                   status, type, recording_url, transcription, metadata,
                   answered_at, hangup_cause, sdr_disposition
            FROM public.calls
            WHERE org_id = v_org_id AND started_at >= v_from
            ORDER BY started_at DESC
            LIMIT p_limit
        ) c
    );
END;
$function$;

-- Overload de métricas: ligacoes_conectadas + pct passam à Opção B.
CREATE OR REPLACE FUNCTION public.get_calls_for_v4sales(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_start TIMESTAMPTZ; v_end TIMESTAMPTZ; v_metrics jsonb; v_calls jsonb;
BEGIN
    v_start := DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1))::TIMESTAMPTZ;
    v_end := (DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month')::TIMESTAMPTZ;
    SELECT jsonb_agg(row_to_json(t)) INTO v_metrics FROM (
        SELECT c.user_id::text AS enriquece_user_id, au.email,
            COUNT(*) AS ligacoes_realizadas,
            COUNT(*) FILTER (
                WHERE COALESCE(c.sdr_disposition::text,'') <> 'voicemail' AND (
                    c.answered_at IS NOT NULL OR c.status = 'significant'
                    OR (c.hangup_cause = 'NORMAL_CLEARING' AND c.recording_url IS NOT NULL AND c.duration_seconds >= 30))
            ) AS ligacoes_conectadas,
            ROUND(COUNT(*) FILTER (
                WHERE COALESCE(c.sdr_disposition::text,'') <> 'voicemail' AND (
                    c.answered_at IS NOT NULL OR c.status = 'significant'
                    OR (c.hangup_cause = 'NORMAL_CLEARING' AND c.recording_url IS NOT NULL AND c.duration_seconds >= 30))
            )::numeric / NULLIF(COUNT(*),0), 4) AS pct_conectadas
        FROM calls c JOIN auth.users au ON au.id = c.user_id
        WHERE c.started_at >= v_start AND c.started_at < v_end AND c.type = 'outbound'
        GROUP BY c.user_id, au.email
    ) t;
    SELECT jsonb_agg(row_to_json(t)) INTO v_calls FROM (
        SELECT c.id::text AS enriquece_call_id, c.user_id::text AS enriquece_user_id, au.email,
            c.origin, c.destination, c.started_at, c.duration_seconds, c.status::text, c.type::text,
            c.recording_url, c.transcription, c.transcription_status, c.answered_at,
            c.hangup_cause, c.sdr_disposition::text
        FROM calls c JOIN auth.users au ON au.id = c.user_id
        WHERE c.started_at >= v_start AND c.started_at < v_end AND c.type = 'outbound'
    ) t;
    RETURN jsonb_build_object('year', p_year, 'month', p_month,
        'metrics', COALESCE(v_metrics, '[]'::jsonb), 'calls', COALESCE(v_calls, '[]'::jsonb));
END;
$function$;

COMMIT;
