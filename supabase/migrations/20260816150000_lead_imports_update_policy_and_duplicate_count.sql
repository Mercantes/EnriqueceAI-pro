-- Importação de leads — Onda 1 da auditoria de 16/08/2026.
--
-- (1) `lead_imports` tinha RLS ativa com policies apenas de SELECT e INSERT.
--     O UPDATE final da server action (status 'processing' → 'completed'/'failed'
--     + contadores) rodava sob RLS e era silenciosamente bloqueado: 0 linhas
--     afetadas, nenhum erro. Toda importação ficava "Processando / 0 importados"
--     até o cron `reap-stuck-imports` (a cada 10 min, cutoff de 15 min)
--     reconstruir os números — 10 a 25 minutos de tela errada. O caminho de
--     falha também não conseguia marcar 'failed'.
--
-- (2) Duplicado era contado duas vezes: entrava em `duplicate_count` (memória
--     da action, nunca persistido) E em `lead_import_errors`, inflando
--     `error_count`. A lista mostrava "40 erros" para arquivos que só tinham
--     duplicata. `lead_import_errors.kind` separa erro real, duplicata e aviso.
--
-- (3) 'warning' é o novo estado das linhas que ANTES eram descartadas: CNPJ com
--     checksum inválido não invalida mais o lead (CNPJ é chave de
--     enriquecimento, não requisito de importação).

BEGIN;

-- 1. Policy de UPDATE ------------------------------------------------------
-- Escopo: a própria org E (autor da importação OU manager). A action sempre
-- roda como o autor; o manager fica coberto para correções manuais. O reaper
-- usa service role e não depende desta policy.
DROP POLICY IF EXISTS "imports_org_update" ON lead_imports;
CREATE POLICY "imports_org_update" ON lead_imports
  FOR UPDATE
  USING (
    org_id = (SELECT public.user_org_id())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_manager()))
  )
  WITH CHECK (
    org_id = (SELECT public.user_org_id())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_manager()))
  );

-- 2. Contador de duplicados ------------------------------------------------
ALTER TABLE lead_imports
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_imports_duplicates'
  ) THEN
    ALTER TABLE lead_imports
      ADD CONSTRAINT chk_imports_duplicates CHECK (duplicate_count >= 0);
  END IF;
END $$;

COMMENT ON COLUMN lead_imports.duplicate_count IS
  'Linhas que casaram com lead existente (não são erro — o lead já estava na base)';

-- 3. Classificação das linhas rejeitadas -----------------------------------
ALTER TABLE lead_import_errors
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'error';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_import_errors_kind'
  ) THEN
    ALTER TABLE lead_import_errors
      ADD CONSTRAINT chk_import_errors_kind
      CHECK (kind IN ('error', 'duplicate', 'warning'));
  END IF;
END $$;

COMMENT ON COLUMN lead_import_errors.kind IS
  'error = linha perdida | duplicate = lead já existia | warning = importado com ressalva (ex.: CNPJ inválido ignorado)';

CREATE INDEX IF NOT EXISTS idx_lead_import_errors_import_kind
  ON lead_import_errors (import_id, kind);

-- 4. Backfill histórico ----------------------------------------------------
UPDATE lead_import_errors
SET kind = 'duplicate'
WHERE kind = 'error'
  AND error_message ILIKE '%duplicad%';

-- Recompõe os contadores dos imports existentes a partir das linhas
-- classificadas. `processed_rows` não é tocado — o CHECK
-- chk_imports_processed (processed_rows <= total_rows) já foi satisfeito
-- quando a linha foi gravada e recalcular arriscaria violá-lo.
WITH counts AS (
  SELECT import_id,
         count(*) FILTER (WHERE kind = 'error')     AS errors,
         count(*) FILTER (WHERE kind = 'duplicate') AS duplicates
  FROM lead_import_errors
  GROUP BY import_id
)
UPDATE lead_imports i
SET error_count     = counts.errors,
    duplicate_count = counts.duplicates
FROM counts
WHERE counts.import_id = i.id;

COMMIT;
