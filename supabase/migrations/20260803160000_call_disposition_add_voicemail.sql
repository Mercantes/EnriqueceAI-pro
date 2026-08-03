-- Adiciona o desfecho "Caixa postal / Secretária eletrônica" ao enum
-- call_disposition (calls.sdr_disposition).
--
-- PROBLEMA: quando a ligação cai na caixa postal / secretária eletrônica, a
-- LINHA atende (a máquina "pega") → a telefonia manda answered_at e acumula
-- duração → o sistema marca "Atendida". Mas não houve contato humano, e nenhum
-- desfecho existente cabe: "Atendeu, sem avanço" pressupõe humano, "Falha
-- técnica" pressupõe chamada quebrada. O SDR era forçado a informar um desfecho
-- errado, e a taxa de conexão inflava.
--
-- SOLUÇÃO: valor próprio `voicemail`. Semanticamente = NÃO falou com humano;
-- comportamento de cadência = igual "não atendeu" (segue a cadência, conta como
-- tentativa). A exclusão da taxa de conexão fica para uma fase 2 (fora desta
-- migration).
--
-- Idempotente e forward-only. Aplicar via MCP ANTES do deploy do código que
-- referencia o valor (padrão do projeto para enums — ver 20260801210000).

ALTER TYPE public.call_disposition ADD VALUE IF NOT EXISTS 'voicemail';
