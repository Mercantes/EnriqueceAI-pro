-- Desfecho do SDR ganha ENUM PRÓPRIO, separado da telemetria.
--
-- PROBLEMA (auditoria V4 Amaral, jul/2026): `calls.sdr_outcome` reusava o enum
-- `call_status` (a MEDIÇÃO da telefonia). O mesmo valor passou a ter dois
-- significados conflitantes conforme a coluna:
--   `busy`           telemetria = linha ocupada / não atendeu
--                    desfecho   = o lead ATENDEU e pediu para ligar depois
--   `significant`    telemetria = duração >= threshold
--                    desfecho   = o SDR julgou a conversa relevante
-- Construir indicador sobre `sdr_outcome` sobre esse enum induz a erro.
--
-- SOLUÇÃO: enum `call_disposition` com valores auto-explicativos + coluna nova
-- `calls.sdr_disposition`. `sdr_outcome` (call_status) é MANTIDA por ora
-- (deprecated, write-only, dados históricos preservados) — drop futuro em
-- migration própria, com aprovação.
--
-- Retrocompatível: só CRIA tipo/coluna/índice e faz backfill. O código em
-- produção hoje não referencia `sdr_disposition`, então aplicar esta migration
-- ANTES do deploy do código novo é seguro (sem janela de escrita quebrada).

BEGIN;

-- 1. Enum próprio do desfecho comercial (idempotente).
DO $$ BEGIN
  CREATE TYPE call_disposition AS ENUM (
    'relevant_conversation',  -- Conversa relevante   (era significant)
    'answered_no_progress',   -- Atendeu, sem avanço  (era not_significant)
    'callback_requested',     -- Pediu para ligar depois (era busy)
    'no_answer',              -- Não atendeu          (era no_contact)
    'technical_failure'       -- Falha técnica        (era not_connected)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Coluna nova, ao lado da antiga (nullable — ligações sem seleção ficam NULL).
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS sdr_disposition call_disposition;

COMMENT ON COLUMN calls.sdr_disposition IS
  'Desfecho informado pelo SDR ao concluir a ligação (enum call_disposition, próprio). Substitui calls.sdr_outcome, que reusava call_status e será removido. NÃO confundir com calls.status (medição objetiva da telefonia).';

-- 3. Backfill dos desfechos já coletados em sdr_outcome (call_status → call_disposition).
UPDATE calls
SET sdr_disposition = (
  CASE sdr_outcome::text
    WHEN 'significant'     THEN 'relevant_conversation'
    WHEN 'not_significant' THEN 'answered_no_progress'
    WHEN 'busy'            THEN 'callback_requested'
    WHEN 'no_contact'      THEN 'no_answer'
    WHEN 'not_connected'   THEN 'technical_failure'
  END
)::call_disposition
WHERE sdr_outcome IS NOT NULL
  AND sdr_disposition IS NULL;

-- 4. Índice parcial espelhando o de sdr_outcome (BI filtra org + desfecho).
CREATE INDEX IF NOT EXISTS idx_calls_sdr_disposition
  ON calls (org_id, sdr_disposition)
  WHERE sdr_disposition IS NOT NULL;

COMMIT;
