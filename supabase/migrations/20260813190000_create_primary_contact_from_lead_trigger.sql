-- Padroniza a criação do contato principal em lead_contacts para QUALQUER canal.
--
-- Contexto: leads criados direto na tabela `leads` (criação manual `createLead`,
-- import CSV `importLeads`, import Apollo `importApolloLeads`, inbound API) gravam
-- nome/e-mail/telefone nas colunas do lead, mas o painel "Contatos" lê de
-- lead_contacts. A trigger existente sync_primary_contact_to_lead só espelha
-- lead_contacts -> leads (nunca o inverso), então esses leads apareciam com o card
-- de Contatos vazio. Esta trigger fecha o caminho contrário no momento da criação do
-- lead, cobrindo todos os canais (presentes e futuros) num único ponto — em vez de
-- replicar a lógica em cada action de criação.
--
-- Segurança contra loop: dispara AFTER INSERT em leads e insere em lead_contacts; a
-- sync trigger responde com UPDATE em leads (não INSERT), logo não re-dispara esta
-- trigger. Guarda de idempotência (IF EXISTS) evita duplicar quando algum caminho já
-- criou o contato (ex.: o painel via upsertLeadContact). Forward-only.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_primary_contact_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_emails jsonb;
  v_phones jsonb;
BEGIN
  -- Lead soft-deleted não recebe contato.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Já tem contato (ex.: algum caminho criou antes)? Não duplica.
  IF EXISTS (SELECT 1 FROM public.lead_contacts c WHERE c.lead_id = NEW.id) THEN
    RETURN NULL;
  END IF;

  -- e-mails: prefere o array estruturado, cai para o e-mail escalar.
  v_emails := CASE
    WHEN NEW.emails IS NOT NULL AND jsonb_typeof(NEW.emails)='array' AND jsonb_array_length(NEW.emails) > 0
      THEN NEW.emails
    WHEN NEW.email IS NOT NULL AND btrim(NEW.email) <> ''
      THEN jsonb_build_array(jsonb_build_object('tipo','corporativo','email', btrim(NEW.email)))
    ELSE '[]'::jsonb
  END;

  -- telefones: prefere o array, cai para o telefone escalar (tipo celular, default do painel).
  v_phones := CASE
    WHEN NEW.phones IS NOT NULL AND jsonb_typeof(NEW.phones)='array' AND jsonb_array_length(NEW.phones) > 0
      THEN NEW.phones
    WHEN NEW.telefone IS NOT NULL AND btrim(NEW.telefone) <> ''
      THEN jsonb_build_array(jsonb_build_object('tipo','celular','numero', btrim(NEW.telefone)))
    ELSE '[]'::jsonb
  END;

  -- Sem nenhum dado de contato -> não cria (mesma regra do backfill original).
  IF NULLIF(btrim(NEW.first_name), '') IS NULL
     AND NULLIF(btrim(NEW.last_name), '') IS NULL
     AND NULLIF(btrim(NEW.job_title), '') IS NULL
     AND jsonb_array_length(v_emails) = 0
     AND jsonb_array_length(v_phones) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.lead_contacts (org_id, lead_id, first_name, last_name, job_title, emails, phones, is_primary)
  VALUES (
    NEW.org_id, NEW.id,
    NULLIF(btrim(NEW.first_name), ''),
    NULLIF(btrim(NEW.last_name), ''),
    NULLIF(btrim(NEW.job_title), ''),
    v_emails, v_phones, true
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_primary_contact ON public.leads;
CREATE TRIGGER trg_create_primary_contact
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.create_primary_contact_from_lead();

COMMIT;

NOTIFY pgrst, 'reload schema';
