-- Story 8.6a — Elimina o N+1 de getUserById na resolução de usuário por e-mail.
--
-- Problema (auditoria 2026-08-14): para achar se um e-mail já é usuário,
-- inviteMember / createOrgWithManager listavam TODOS os organization_members e
-- chamavam admin.auth.admin.getUserById() por membro (N+1 sobre a base inteira,
-- cross-org) — latência alta e risco de timeout/rate-limit da Admin API. O
-- listUsers do SDK não filtra por e-mail no servidor, então a correção eficiente
-- é uma função de banco (SECURITY DEFINER) que consulta auth.users diretamente.
--
-- Espelha find_pending_invite_by_email: somente-leitura, retorna só o user_id,
-- EXECUTE restrito ao service_role (as Server Actions usam o admin client).

BEGIN;

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;

COMMENT ON FUNCTION public.find_user_id_by_email(text) IS 'Resolve user_id em auth.users a partir do e-mail (case-insensitive). Somente-leitura, service_role. Evita o N+1 de getUserById.';

COMMIT;
