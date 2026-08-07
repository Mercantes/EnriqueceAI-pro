-- Remove travessões (—) do CONTEÚDO dos templates de e-mail da V4 Amaral.
--
-- Motivo: copy que vai pro cliente não deve usar travessão (pedido do time —
-- os e-mails da régua de reunião e de cadência saíam com "—" no assunto/corpo).
--   Assunto: ' — ' → ': '  (padrão "título: detalhe")
--   Corpo:   ' — ' → ', '  (aposto/pausa)
--
-- Já aplicado em produção via MCP em 2026-08-07 (backup em
-- _bkp_email_templates_emdash_20260805). Esta migration versiona/reproduz o fix
-- em setups novos: o seed 20260710140000 ainda insere travessões, então rodar
-- DEPOIS dele limpa. Idempotente — `replace` é no-op quando não há travessão.
--
-- NÃO toca no `name` (rótulo interno, não vai ao lead) nem em outros canais.
-- Todos os travessões eram da forma espaçada ' — ' (verificado); por isso o
-- replace posicional é seguro.
BEGIN;

UPDATE public.message_templates
SET subject = replace(subject, ' — ', ': '),
    body = replace(body, ' — ', ', ')
WHERE org_id = 'c2727473-1df8-4faa-9264-a9fc1759fe3b'
  AND channel = 'email'
  AND (subject LIKE '%—%' OR body LIKE '%—%');

COMMIT;
