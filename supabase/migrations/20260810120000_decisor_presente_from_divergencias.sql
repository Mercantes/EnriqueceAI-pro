-- Métrica "Decisor na Call %" (Sales Hub) — nova fonte de decisor_presente.
--
-- Contexto: o formulário de feedback do closer deixou de perguntar "o decisor
-- estava presente na call?" (coluna closer_feedback_requests.decisor_presente
-- não é mais preenchida). Agora ele captura "decisor" como um dos itens de
-- DIVERGÊNCIA da qualificação (qualificacao_aderente + divergencias).
--
-- Esta migration mantém a métrica viva SEM tocar no n8n nem no Sales Hub: a
-- RPC get_leads_for_v4sales continua expondo um booleano decisor_presente, mas
-- agora ele é DERIVADO. Semântica: "a informação de decisor do pré-vendas
-- conferiu na reunião" (= 'decisor' NÃO está nas divergências).
--
-- Fallback: respostas antigas (qualificacao_aderente NULL, decisor_presente
-- real preenchido em ago/2026) continuam contando pelo valor legado. Assim o
-- histórico não some. 'nao_validado' → NULL (não dá pra afirmar, não conta).

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
        -- Decisor "conferiu na call": última resposta útil do closer.
        --   • Regime novo (qualificacao_aderente = bateu/divergiu): TRUE se
        --     'decisor' NÃO está nas divergências, FALSE se está.
        --   • Regime legado (qualificacao_aderente NULL, decisor_presente real):
        --     usa o booleano original (histórico de ago/2026).
        --   • nao_validado / sem resposta: ignorado (NULL = não respondido/n/a).
        (SELECT CASE
                  WHEN c.qualificacao_aderente IN ('bateu', 'divergiu')
                    THEN NOT ('decisor' = ANY(COALESCE(c.divergencias, ARRAY[]::text[])))
                  ELSE c.decisor_presente
                END
           FROM closer_feedback_requests c
          WHERE c.lead_id = l.id
            AND c.result = 'meeting_done'
            AND (
              c.qualificacao_aderente IN ('bateu', 'divergiu')
              OR (c.qualificacao_aderente IS NULL AND c.decisor_presente IS NOT NULL)
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
