-- Métrica "ligações conectadas" do Sales Hub: answered-first no export da Enriquece.
--
-- PROBLEMA: a regra `status IN ('significant','not_significant')` contava o balde
-- `not_significant`, contaminado pelo bug do answeredAt="" (corrigido no app em
-- 02/08, PR #207): ligações NÃO atendidas viravam not_significant. Resultado: a
-- conexão de todos os SDRs no Sales Hub ficou inflada ~2x em mai–jul/2026, e os
-- ramais sem webhook (1042 Giovanni) ficaram SUB-contados (0 em jul).
--
-- FIX (esta migration, lado Enriquece): a export RPC `get_calls_for_v4sales`
--   1. passa a incluir `answered_at` no payload (a overload p_from_date, que o
--      n8n "Sync Calls" consome), para o Sales Hub aplicar a regra answered-first;
--   2. usa answered-first no `ligacoes_conectadas` (a overload p_year/p_month, de
--      métricas): answered_at válido OU status='significant' OU duração>=30s —
--      a mesma regra do isConnectedCall do app (src/features/calls/connection.ts).
--
-- Lado Sales Hub (projeto ejxlbbbjyexsoltsxiqq): a função sync_calls_from_enriquece
-- passou a usar answered-first e o histórico mai–jul foi recomputado. Ver
-- docs/integrations/saleshub-connected-metric-fix-2026-08.md (projeto separado,
-- fora deste repo).
--
-- Aplicada em prod via MCP em 12/08; esta migration é paridade git <-> banco.
-- CREATE OR REPLACE idempotente.

BEGIN;

-- Overload consumida pelo n8n "Sync Calls": adiciona answered_at ao payload.
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
                   answered_at
            FROM public.calls
            WHERE org_id = v_org_id AND started_at >= v_from
            ORDER BY started_at DESC
            LIMIT p_limit
        ) c
    );
END;
$function$;

-- Overload de métricas: ligacoes_conectadas + pct passam a answered-first.
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
            COUNT(*) FILTER (WHERE c.answered_at IS NOT NULL OR c.status = 'significant' OR c.duration_seconds >= 30) AS ligacoes_conectadas,
            ROUND(COUNT(*) FILTER (WHERE c.answered_at IS NOT NULL OR c.status = 'significant' OR c.duration_seconds >= 30)::numeric / NULLIF(COUNT(*),0), 4) AS pct_conectadas
        FROM calls c JOIN auth.users au ON au.id = c.user_id
        WHERE c.started_at >= v_start AND c.started_at < v_end AND c.type = 'outbound'
        GROUP BY c.user_id, au.email
    ) t;
    SELECT jsonb_agg(row_to_json(t)) INTO v_calls FROM (
        SELECT c.id::text AS enriquece_call_id, c.user_id::text AS enriquece_user_id, au.email,
            c.origin, c.destination, c.started_at, c.duration_seconds, c.status::text, c.type::text,
            c.recording_url, c.transcription, c.transcription_status, c.answered_at
        FROM calls c JOIN auth.users au ON au.id = c.user_id
        WHERE c.started_at >= v_start AND c.started_at < v_end AND c.type = 'outbound'
    ) t;
    RETURN jsonb_build_object('year', p_year, 'month', p_month,
        'metrics', COALESCE(v_metrics, '[]'::jsonb), 'calls', COALESCE(v_calls, '[]'::jsonb));
END;
$function$;

COMMIT;
