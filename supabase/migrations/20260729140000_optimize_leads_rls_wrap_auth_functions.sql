-- =============================================================================
-- Otimização de performance da RLS de `leads` (corrige "Erro ao carregar leads")
-- =============================================================================
-- SINTOMA: SDRs recebiam "Erro ao carregar leads / Erro ao buscar leads" ao
--          abrir o menu Leads.
--
-- CAUSA RAIZ: as policies `leads_org_read` (SELECT) e `leads_org_update`
--   (UPDATE) chamavam `is_manager()` e `lead_visibility_mode()` SEM envelopar
--   em `(SELECT ...)`. Isso faz o Postgres reavaliar as funções LINHA A LINHA
--   sobre toda a org (~4.8k linhas), cada chamada fazendo um SELECT em
--   organization_members/organizations.
--   No modo de visibilidade 'own' (SDR) são até 3 chamadas por linha, dando
--   ~1,7s no SELECT + ~1,8s no count=exact (que o app pede) = ~3,5s por
--   request com cache quente. Sob concorrência / cache frio isso ultrapassa o
--   `statement_timeout = 8s` do role `authenticated` → PostgREST aborta a query
--   → o app cai no ramo genérico "Erro ao buscar leads".
--   O manager curto-circuita em `is_manager()` (1 chamada/linha), por isso o
--   problema aparecia primeiro/pior para SDRs.
--
-- FIX: envelopar as funções auth em subqueries escalares `(SELECT ...)`. Assim
--   o planner as executa UMA vez (InitPlan) em vez de por linha. Medido no
--   mesmo dataset: ~1,7s → ~0,34s (e mais rápido ainda sem a policy antiga por
--   cima). Mesma semântica, zero mudança de comportamento/visibilidade.
--   (Mesma técnica que a migração 20260510122942 já aplicou ao auth.uid().)
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS leads_org_read ON public.leads;
CREATE POLICY leads_org_read ON public.leads
  FOR SELECT
  USING (
    org_id = (SELECT public.user_org_id())
    AND (
      (SELECT public.is_manager())
      OR (SELECT public.lead_visibility_mode()) = 'all'
      OR (
        (SELECT public.lead_visibility_mode()) = ANY (ARRAY['own', 'team'])
        AND assigned_to = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS leads_org_update ON public.leads;
CREATE POLICY leads_org_update ON public.leads
  FOR UPDATE
  USING (
    org_id = (SELECT public.user_org_id())
    AND (
      (SELECT public.is_manager())
      OR (SELECT public.lead_visibility_mode()) = 'all'
      OR (
        (SELECT public.lead_visibility_mode()) = ANY (ARRAY['own', 'team'])
        AND assigned_to = (SELECT auth.uid())
      )
    )
  );

COMMIT;
