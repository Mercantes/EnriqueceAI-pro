-- Story 8.6a — Uso de IA: incremento atômico + tokens_used.
--
-- Problema (auditoria 2026-08-14): AIService.incrementUsage fazia
-- read-modify-write (SELECT generation_count → UPDATE +1) não-atômico. Gerações
-- concorrentes liam o mesmo valor e ambas gravavam n+1 (lost update), burlando o
-- limite diário. Além disso, o total de tokens do Claude era calculado e
-- descartado — o custo de uma geração de 50 tokens era tratado igual ao de 4000.
--
-- Fix: coluna tokens_used + função increment_ai_usage() que faz um único
-- INSERT ... ON CONFLICT (org_id, usage_date) DO UPDATE, atômico por natureza.
-- SECURITY DEFINER + EXECUTE restrito a service_role (as Server Actions chamam
-- via service role client), consistente com find_pending_invite_by_email.

BEGIN;

-- 1. Coluna de tokens acumulados por dia (custo real, não só contagem).
ALTER TABLE ai_usage
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ai_usage
  DROP CONSTRAINT IF EXISTS chk_ai_usage_tokens_positive;
ALTER TABLE ai_usage
  ADD CONSTRAINT chk_ai_usage_tokens_positive CHECK (tokens_used >= 0);

-- 2. Incremento atômico. Retorna a contagem NOVA e o limite para o chamador
--    decidir o alerta de 80% (a contagem anterior = out_count - 1, já que esta
--    chamada fez exatamente um incremento). Aproveita o UNIQUE(org_id, usage_date).
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_org_id uuid,
  p_usage_date date,
  p_tokens integer,
  p_default_limit integer
)
RETURNS TABLE (out_count integer, out_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO ai_usage AS au (org_id, usage_date, generation_count, tokens_used, daily_limit)
  VALUES (p_org_id, p_usage_date, 1, GREATEST(COALESCE(p_tokens, 0), 0), p_default_limit)
  ON CONFLICT (org_id, usage_date) DO UPDATE
    SET generation_count = au.generation_count + 1,
        tokens_used = au.tokens_used + GREATEST(COALESCE(p_tokens, 0), 0)
  RETURNING au.generation_count, au.daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_ai_usage(uuid, date, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, date, integer, integer) TO service_role;

COMMENT ON COLUMN ai_usage.tokens_used IS 'Total de tokens (input+output) consumidos no dia — custo real da IA.';
COMMENT ON FUNCTION public.increment_ai_usage(uuid, date, integer, integer) IS 'Incremento atômico de uso de IA (evita lost update sob concorrência). Retorna a contagem nova e o limite diário.';

COMMIT;
