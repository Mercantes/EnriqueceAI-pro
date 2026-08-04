-- Captura estruturada de "Decisor presente na call" no feedback do closer.
--
-- CONTEXTO: o Sales Hub cria a métrica "Decisor na Call %" = reuniões realizadas
-- com o decisor presente ÷ total de reuniões realizadas. A fonte da verdade é o
-- closer, que confirma no feedback pós-reunião. Hoje o sinal só aparece solto no
-- texto livre de `comment` (~30%), não estruturado.
--
-- Só é preenchido quando result='meeting_done' (a reunião aconteceu). Para
-- no_show/rescheduled o valor fica NULL. NULL também = não respondido / histórico
-- (sem backfill a partir de `comment` — não é confiável).
--
-- Sync pro Sales Hub é externo (n8n lê esta tabela → RPC upsert_leads_pv, novo
-- parâmetro p_decisor_presente, mapeando por lead_id → enriquece_lead_id).
--
-- Idempotente, forward-only. Aplicado via MCP.

ALTER TABLE public.closer_feedback_requests
  ADD COLUMN IF NOT EXISTS decisor_presente boolean;

COMMENT ON COLUMN public.closer_feedback_requests.decisor_presente IS
  'Closer confirma se o decisor esteve presente na reunião (só quando result=meeting_done). NULL = não respondido / não se aplica. Fonte da métrica "Decisor na Call %" do Sales Hub.';
