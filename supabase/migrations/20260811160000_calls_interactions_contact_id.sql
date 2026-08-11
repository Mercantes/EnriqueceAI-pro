-- Registra QUAL contato (lead_contacts) foi usado numa ligação / interação.
-- Complementa a feature de múltiplos contatos por lead: quando o SDR liga ou
-- manda WhatsApp escolhendo um contato específico (ex.: o sócio vs a responsável
-- de marketing), guardamos o contact_id para relatórios ("ligações para o
-- decisor"). Nullable: ligações/interações antigas e as sem contato explícito
-- ficam NULL. ON DELETE SET NULL para não travar remoção de contato. Forward-only.

BEGIN;

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS contact_id uuid
  REFERENCES public.lead_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS contact_id uuid
  REFERENCES public.lead_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_contact ON public.calls (contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON public.interactions (contact_id)
  WHERE contact_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
