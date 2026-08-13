-- Métrica "Decisor na Call %" — volta a priorizar o campo explícito.
--
-- O formulário de feedback do closer voltou a ter a pergunta dedicada
-- "O decisor estava na call? (Sim/Não)", que grava closer_feedback_requests
-- .decisor_presente. Antes (migration 20260810120000) a métrica DERIVAVA o
-- decisor das divergências ('decisor' NÃO estar nas divergencias). Isso é
-- impreciso agora: um "Bateu" com o decisor ausente marcaria decisor=TRUE pela
-- derivação, mas a verdade (campo explícito) é FALSE.
--
-- Nova regra por lead (última resposta meeting_done com sinal útil):
--   COALESCE(decisor_presente explícito, derivação-das-divergências)
-- Assim o campo explícito manda; a derivação fica só como fallback para as
-- respostas da janela de transição (ago/2026: qualificação preenchida, mas
-- decisor_presente NULL porque o campo estava fora do form).

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
        -- Decisor na call: campo explícito manda; derivação das divergências é
        -- apenas fallback (respostas da transição sem decisor_presente).
        (SELECT COALESCE(
                  c.decisor_presente,
                  CASE
                    WHEN c.qualificacao_aderente IN ('bateu', 'divergiu')
                      THEN NOT ('decisor' = ANY(COALESCE(c.divergencias, ARRAY[]::text[])))
                    ELSE NULL
                  END
                )
           FROM closer_feedback_requests c
          WHERE c.lead_id = l.id
            AND c.result = 'meeting_done'
            AND (
              c.decisor_presente IS NOT NULL
              OR c.qualificacao_aderente IN ('bateu', 'divergiu')
            )
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
