-- Métrica "ligações conectadas" — piso de conversa de 50s (14/ago/2026).
--
-- CONTEXTO: depois que os webhooks de todos os ramais voltaram a emitir
-- channel-answer (incl. 1042/1045), ficou provado que a API4COM dispara o
-- `answered_at` também quando CAIXA POSTAL / SECRETÁRIA / gravação de operadora
-- atende a linha. 41% das "conectadas" de agosto eram atendimentos de <10s (pico
-- em 0-5s); 21 ligações para número inexistente (UNALLOCATED_NUMBER, 0s) vinham
-- com answered_at; e as transcrições dos curtos são operadora/caixa postal.
--
-- DECISÃO DE NEGÓCIO DA V4: conectada = "falou de verdade com o lead" = ligação
-- ATENDIDA (answered_at) E com pelo menos 50s de conversa, e NÃO marcada como
-- voicemail pelo SDR. Alinha com o isConnectedCall do app
-- (src/features/calls/connection.ts, CONNECTED_MIN_DURATION_SECONDS=50).
--
-- Esta migration (lado Enriquece): a overload de MÉTRICAS de get_calls_for_v4sales
-- (p_year/p_month) passa a usar a regra dos 50s no ligacoes_conectadas/pct. A
-- overload p_from_date (que o n8n "Sync Calls" consome) NÃO muda — ela só exporta
-- os campos (answered_at, duration, sdr_disposition, etc.); o cálculo de connected
-- fica no sync_calls_from_enriquece do Sales Hub, também atualizado para 50s (via
-- MCP; projeto ejxlbbbjyexsoltsxiqq). Histórico do SH recomputado. Ver
-- docs/integrations/saleshub-connected-metric-fix-2026-08.md.
--
-- Aplicada em prod via MCP em 14/08; esta migration é paridade git <-> banco.

BEGIN;

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
                WHERE COALESCE(c.sdr_disposition::text,'') <> 'voicemail'
                  AND c.answered_at IS NOT NULL
                  AND c.duration_seconds >= 50
            ) AS ligacoes_conectadas,
            ROUND(COUNT(*) FILTER (
                WHERE COALESCE(c.sdr_disposition::text,'') <> 'voicemail'
                  AND c.answered_at IS NOT NULL
                  AND c.duration_seconds >= 50
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
