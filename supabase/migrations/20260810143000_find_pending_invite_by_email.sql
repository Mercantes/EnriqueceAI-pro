-- Localiza um convite pendente (organization_members.status = 'invited') a partir do
-- e-mail em auth.users. Usado na tela de login para, quando alguém tenta entrar com
-- uma conta ainda não ativada, oferecer o reenvio do convite em vez de exibir o
-- genérico "credenciais inválidas".
--
-- SECURITY DEFINER porque cruza public.organization_members com auth.users. É
-- somente-leitura e retorna apenas os identificadores mínimos (member_id, user_id) —
-- nunca a senha ou outros dados sensíveis. EXECUTE fica restrito ao service_role
-- (as Server Actions que a chamam usam o admin client), não sendo exposta a anon
-- nem a authenticated.

BEGIN;

CREATE OR REPLACE FUNCTION public.find_pending_invite_by_email(p_email text)
RETURNS TABLE (member_id uuid, user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT om.id, om.user_id
  FROM auth.users u
  JOIN public.organization_members om ON om.user_id = u.id
  WHERE lower(u.email) = lower(trim(p_email))
    AND om.status = 'invited'
  ORDER BY om.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_pending_invite_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_pending_invite_by_email(text) TO service_role;

COMMIT;
