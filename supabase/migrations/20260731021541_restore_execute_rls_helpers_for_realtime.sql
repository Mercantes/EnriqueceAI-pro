-- =============================================================================
-- Restaura EXECUTE das funções de RLS para o Realtime (walrus apply_rls)
-- =============================================================================
-- O Realtime (realtime.apply_rls / walrus) avalia a RLS das tabelas publicadas
-- (notifications, organizations, organization_members) chamando
-- user_org_id() / is_manager() / lead_visibility_mode(). As migrations de
-- hardening (revoke_definer_anon_authenticated_exec e cia.) revogaram o EXECUTE
-- amplo/PUBLIC, deixando só {authenticated, service_role, postgres}. Com isso o
-- walrus falha com "permission denied for function user_org_id" (42501) em
-- realtime.apply_rls, quebrando SILENCIOSAMENTE os updates ao vivo dessas tabelas.
--
-- Fix: restaurar EXECUTE para os papéis que o Realtime precisa. Seguro — essas
-- funções retornam null/false sem um auth.uid() válido, então não há exposição
-- de dado ao anon (o que o hardening queria evitar continua valendo: anon não
-- enxerga dado, só consegue "chamar" a função que devolve null/false).
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.user_org_id() TO anon, authenticator, supabase_realtime_admin;
GRANT EXECUTE ON FUNCTION public.is_manager() TO anon, authenticator, supabase_realtime_admin;
GRANT EXECUTE ON FUNCTION public.lead_visibility_mode() TO anon, authenticator, supabase_realtime_admin;
