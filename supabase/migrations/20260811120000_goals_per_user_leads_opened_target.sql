-- Meta individual de "Leads Abertos" por vendedor (SDR).
-- Espelha, no nível do vendedor, a meta org `goals.leads_opened_target`.
-- Alimenta o "ideal por SDR" do card "Leads Abertos" do dashboard
-- (mesmo mecanismo das metas individuais de reuniões marcadas/realizadas).
-- Substitui, na UI de metas, a antiga coluna "oportunidades"
-- (goals_per_user.opportunity_target), que ficou vestigial.
BEGIN;

ALTER TABLE public.goals_per_user
  ADD COLUMN IF NOT EXISTS leads_opened_target integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.goals_per_user.leads_opened_target IS
  'Meta mensal de leads abertos (primeiro toque humano) deste vendedor. Usada como ideal/dia por SDR no card Leads Abertos.';

COMMIT;
