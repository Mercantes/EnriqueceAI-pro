-- Inclui `decisor_presente` no payload de sync pro Sales Hub.
--
-- `get_leads_for_v4sales` é a RPC consumida pelo workflow n8n "Sync Leads PV"
-- (Webhook /leadspv → esta RPC monta o array → upsert_leads_pv_logged no SH).
-- Adiciona a chave `decisor_presente` em cada objeto de lead, do mesmo modo que
-- `tem_feedback_closer`: última resposta não-nula do closer em
-- `closer_feedback_requests` (só preenchida quando result=meeting_done).
-- NULL = não respondido / não se aplica.
--
-- Contrato combinado com o time do Sales Hub: chave JSON `decisor_presente`
-- (snake_case, como as demais). O lado SH (upsert_leads_pv) já lê a chave e
-- grava em leads_pv.decisor_presente. Já aplicado em prod via MCP.
--
-- Só ADITIVO: mantém todos os demais campos e a assinatura intactos.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_leads_for_v4sales(p_api_token text, p_from_date text DEFAULT NULL::text)
 RETURNS SETOF json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_org_id uuid := 'c2727473-1df8-4faa-9264-a9fc1759fe3b';
  v_caller_org uuid := public.user_org_id();
BEGIN
  IF auth.role() <> 'service_role'
     AND v_caller_org IS DISTINCT FROM v_org_id
     AND NOT public.verify_api_secret('v4sales_public_rpc', p_api_token) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT row_to_json(t)
    FROM (
      SELECT
        l.id as enriquece_lead_id,
        l.assigned_to as enriquece_user_id,
        l.cnpj, l.razao_social, l.nome_fantasia, l.porte,
        l.email, l.telefone, l.phones,
        l.first_name, l.last_name, l.job_title,
        l.status, l.lead_source, l.is_inbound, l.canal,
        l.fit_score, l.engagement_score,
        l.enrichment_status, l.enriched_at,
        l.won_at, l.lost_at, (l.won_at IS NOT NULL) as is_won,
        l.meeting_scheduled_at, l.meeting_held_at,
        l.meeting_starts_at,
        EXISTS (SELECT 1 FROM closer_feedback_requests c WHERE c.lead_id = l.id) as tem_feedback_closer,
        -- Decisor presente na call: última resposta não-nula do closer (só é
        -- preenchida quando result=meeting_done). NULL = não respondido / n/a.
        (SELECT c.decisor_presente
           FROM closer_feedback_requests c
          WHERE c.lead_id = l.id AND c.decisor_presente IS NOT NULL
          ORDER BY c.responded_at DESC NULLS LAST
          LIMIT 1) as decisor_presente,
        l.contacted_at,
        l.created_at as created_at_enriquece,
        l.updated_at as updated_at_enriquece,
        l.deleted_at
      FROM leads l
      WHERE l.org_id = v_org_id
        AND (
          l.created_at             >= COALESCE(p_from_date::date, DATE_TRUNC('month', CURRENT_DATE)::date)
          OR l.updated_at          >= COALESCE(p_from_date::date, DATE_TRUNC('month', CURRENT_DATE)::date)
          OR l.meeting_scheduled_at>= COALESCE(p_from_date::date, DATE_TRUNC('month', CURRENT_DATE)::date)
          OR l.meeting_held_at     >= COALESCE(p_from_date::date, DATE_TRUNC('month', CURRENT_DATE)::date)
          OR l.contacted_at        >= COALESCE(p_from_date::date, DATE_TRUNC('month', CURRENT_DATE)::date)
        )
      ORDER BY GREATEST(l.created_at, l.updated_at) DESC
    ) t;
END;
$function$;

COMMIT;
