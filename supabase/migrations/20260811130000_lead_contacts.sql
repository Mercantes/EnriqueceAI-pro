-- Múltiplos contatos por lead — tabela lead_contacts (1-N).
--
-- Contexto: até aqui o lead assumia UMA pessoa (colunas first_name/last_name/
-- job_title) + arrays soltos emails/phones sem dono. Empresas maiores têm vários
-- interlocutores (ex.: responsável de marketing + sócio proprietário), cada um
-- com seu cargo e seus próprios telefones/e-mails. Esta migration cria a entidade
-- "contato do lead" e mantém RETROCOMPATIBILIDADE: o contato marcado como
-- principal (is_primary) é ESPELHADO de volta nas colunas do lead
-- (first_name/last_name/job_title/email/telefone/emails/phones), que continuam
-- sendo a fonte lida por discador, cadências, régua de reunião e Sales Hub.
-- Escopo desta entrega: só o painel do lead. Forward-only.

BEGIN;

-- 1. Tabela ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id    uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  first_name text,
  last_name  text,
  job_title  text,
  -- Mesmos formatos dos arrays JSONB do lead: [{tipo,email}] e [{tipo,numero}].
  emails     jsonb NOT NULL DEFAULT '[]'::jsonb,
  phones     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON public.lead_contacts (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_org  ON public.lead_contacts (org_id);
-- No máximo 1 contato principal por lead.
CREATE UNIQUE INDEX IF NOT EXISTS ux_lead_contacts_one_primary
  ON public.lead_contacts (lead_id) WHERE is_primary;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lead_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. RLS org-scoped ----------------------------------------------------------
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_contacts_org ON public.lead_contacts;
CREATE POLICY lead_contacts_org ON public.lead_contacts FOR ALL
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- 3. Backfill: 1 contato principal por lead a partir dos dados atuais ---------
-- Feito ANTES de criar a trigger de espelhamento para não gerar UPDATEs
-- redundantes em leads (os valores já vêm de lá).
INSERT INTO public.lead_contacts (org_id, lead_id, first_name, last_name, job_title, emails, phones, is_primary)
SELECT
  l.org_id,
  l.id,
  l.first_name,
  l.last_name,
  l.job_title,
  CASE
    WHEN l.emails IS NOT NULL AND jsonb_typeof(l.emails) = 'array' AND jsonb_array_length(l.emails) > 0
      THEN l.emails
    WHEN l.email IS NOT NULL AND trim(l.email) <> ''
      THEN jsonb_build_array(jsonb_build_object('tipo', 'corporativo', 'email', l.email))
    ELSE '[]'::jsonb
  END,
  CASE
    WHEN l.phones IS NOT NULL AND jsonb_typeof(l.phones) = 'array' AND jsonb_array_length(l.phones) > 0
      THEN l.phones
    WHEN l.telefone IS NOT NULL AND trim(l.telefone) <> ''
      THEN jsonb_build_array(jsonb_build_object('tipo', 'fixo', 'numero', l.telefone))
    ELSE '[]'::jsonb
  END,
  true
FROM public.leads l
WHERE l.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.lead_contacts c WHERE c.lead_id = l.id)
  AND (
    l.first_name IS NOT NULL OR l.last_name IS NOT NULL OR l.job_title IS NOT NULL
    OR (l.email IS NOT NULL AND trim(l.email) <> '')
    OR (l.telefone IS NOT NULL AND trim(l.telefone) <> '')
    OR (l.emails IS NOT NULL AND jsonb_typeof(l.emails) = 'array' AND jsonb_array_length(l.emails) > 0)
    OR (l.phones IS NOT NULL AND jsonb_typeof(l.phones) = 'array' AND jsonb_array_length(l.phones) > 0)
  );

-- 4. Espelhamento contato principal -> colunas do lead -----------------------
CREATE OR REPLACE FUNCTION public.sync_primary_contact_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_lead_id uuid := COALESCE(NEW.lead_id, OLD.lead_id);
  v_p       public.lead_contacts%ROWTYPE;
  v_email   text;
  v_tel     text;
BEGIN
  SELECT * INTO v_p
  FROM public.lead_contacts
  WHERE lead_id = v_lead_id AND is_primary = true
  LIMIT 1;

  -- Sem contato principal (ex.: último contato removido) -> não mexe nas colunas.
  IF v_p.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT e ->> 'email' INTO v_email
  FROM jsonb_array_elements(COALESCE(v_p.emails, '[]'::jsonb)) e
  WHERE COALESCE(trim(e ->> 'email'), '') <> ''
  LIMIT 1;

  SELECT p ->> 'numero' INTO v_tel
  FROM jsonb_array_elements(COALESCE(v_p.phones, '[]'::jsonb)) p
  WHERE COALESCE(trim(p ->> 'numero'), '') <> ''
  LIMIT 1;

  UPDATE public.leads l SET
    first_name          = v_p.first_name,
    last_name           = v_p.last_name,
    job_title           = v_p.job_title,
    emails              = v_p.emails,
    phones              = v_p.phones,
    email               = v_email,
    telefone            = v_tel,
    -- Espelha o comportamento do updateLead: mudou o e-mail/telefone -> limpa flag.
    email_bounced_at    = CASE WHEN v_email IS DISTINCT FROM l.email THEN NULL ELSE l.email_bounced_at END,
    whatsapp_invalid_at = CASE WHEN v_tel   IS DISTINCT FROM l.telefone THEN NULL ELSE l.whatsapp_invalid_at END
  WHERE l.id = v_lead_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_contact ON public.lead_contacts;
CREATE TRIGGER trg_sync_primary_contact
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_contacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_contact_to_lead();

-- 5. Troca de principal atômica (evita conflito no índice único parcial) ------
CREATE OR REPLACE FUNCTION public.set_primary_lead_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_lead_id uuid;
  v_org_id  uuid;
BEGIN
  SELECT lead_id, org_id INTO v_lead_id, v_org_id
  FROM public.lead_contacts WHERE id = p_contact_id;

  IF v_lead_id IS NULL THEN
    RETURN;
  END IF;

  IF v_org_id IS DISTINCT FROM public.user_org_id() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Desmarca o principal antigo ANTES de marcar o novo, senão o índice único
  -- parcial rejeita os dois principais simultâneos.
  UPDATE public.lead_contacts
    SET is_primary = false
    WHERE lead_id = v_lead_id AND is_primary = true AND id <> p_contact_id;

  UPDATE public.lead_contacts
    SET is_primary = true
    WHERE id = p_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_primary_lead_contact(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
