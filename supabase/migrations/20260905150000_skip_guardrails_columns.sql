BEGIN;

-- Guard-rails do "Pular" na fila de Atividades (story activity-skip-guardrails).
--
-- 1) cadence_enrollments.snooze_count — quantas vezes o SDR clicou "Adiar p/
--    amanhã" no PASSO ATUAL. O servidor recusa o 3º adiamento (SNOOZE_LIMIT) e
--    força uma saída explícita (executar / perdido / trocar cadência). Zerado
--    pela RPC advance_enrollment_after_step quando o passo avança (migration
--    seguinte). Enrollment novo já nasce 0.
--
-- 2) cadences.sdr_switch_allowed — se um SDR (não manager) pode mover leads
--    PARA esta cadência pelo "Trocar cadência". Default TRUE para não mudar
--    nada no dia do deploy: restringir é decisão do gestor no editor.
ALTER TABLE cadence_enrollments
  ADD COLUMN IF NOT EXISTS snooze_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN cadence_enrollments.snooze_count IS
  'Adiamentos ("Adiar p/ amanhã") no passo atual. Limite 2 por passo; zerado ao avançar (advance_enrollment_after_step).';

ALTER TABLE cadences
  ADD COLUMN IF NOT EXISTS sdr_switch_allowed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN cadences.sdr_switch_allowed IS
  'SDR (não manager) pode mover leads para esta cadência via "Trocar cadência". Manager sempre pode.';

COMMIT;
