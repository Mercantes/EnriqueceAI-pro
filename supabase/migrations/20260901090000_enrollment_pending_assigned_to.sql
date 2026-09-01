BEGIN;

-- =============================================================================
-- Recuperação de inbound: reatribuição adiada para a ativação.
-- O serviço de recovery deixa de trocar leads.assigned_to no ato do perdido e
-- passa a guardar o SDR escolhido aqui; o motor de cadência aplica a troca
-- quando ativa o enrollment agendado (junto com unqualified → new). Assim a
-- perda fica atribuída ao SDR original e o lead só entra na carteira do novo
-- SDR no mês em que volta a ser trabalhável.
-- =============================================================================

ALTER TABLE public.cadence_enrollments
  ADD COLUMN IF NOT EXISTS pending_assigned_to UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.cadence_enrollments.pending_assigned_to IS
  'SDR que receberá o lead quando este enrollment agendado for ativado (recuperação de inbound). NULL = sem troca de dono na ativação.';

COMMIT;

NOTIFY pgrst, 'reload schema';
