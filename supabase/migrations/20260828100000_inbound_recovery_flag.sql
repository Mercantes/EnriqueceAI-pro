BEGIN;

-- =============================================================================
-- Flag da recuperação automática de leads inbound perdidos.
-- Perda com motivo reativável (Nunca respondeu / Sem interesse / Sem timing)
-- em lead Blackbox/Leadbroker → redistribui entre os SDRs de outbound e agenda
-- a cadência Recovery em +10 dias. Regra por org vive no código
-- (src/features/leads/services/inbound-recovery.service.ts); este flag é o
-- liga/desliga global sem deploy, mesmo padrão do meeting_webhook_enabled.
-- =============================================================================

INSERT INTO public.app_flags (key, enabled, note)
VALUES (
  'inbound_recovery_enabled',
  true,
  'Redistribui lead inbound perdido (motivo reativável) e agenda cadência Recovery em +10 dias'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
