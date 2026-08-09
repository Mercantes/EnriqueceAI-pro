BEGIN;

-- =============================================================================
-- app_flags — flags globais de infra controláveis via banco (sem depender de
-- env do Coolify). Ex.: ligar/desligar o dispatch do webhook de reunião.
-- Global (sem org_id): é toggle de plataforma, não por tenant.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.app_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Leitura para managers (debug no painel); escrita só via service role.
CREATE POLICY app_flags_manager_select ON public.app_flags
  FOR SELECT USING ((SELECT public.is_manager()));

-- Seed do flag do webhook de reunião (começa desligado; ligo via MCP).
INSERT INTO public.app_flags (key, enabled, note)
VALUES ('meeting_webhook_enabled', false, 'Liga o dispatch do webhook de reunião pro n8n')
ON CONFLICT (key) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
