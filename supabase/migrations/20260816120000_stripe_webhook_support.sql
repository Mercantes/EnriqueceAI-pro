-- Stripe webhook support (Edge Function `stripe-webhook`)
--
-- Contexto: a Stripe estava entregando eventos numa URL de um projeto que nao
-- existe mais, entao assinatura paga nao liberava acesso. A Edge Function
-- `stripe-webhook` passa a ser o unico endpoint. Esta migration cria o que ela
-- precisa no banco.
--
-- 1) plans.stripe_price_id  -> unica forma confiavel de saber qual plano o
--    cliente comprou (o price do item da assinatura).
-- 2) stripe_events          -> garante que o mesmo evento nao seja processado
--    duas vezes. Separada de webhook_events (que e do handler Next) de
--    proposito: as duas nunca disputam a mesma chave.
--
-- Ambas com RLS ligada. stripe_events fica sem policy: so a Edge Function
-- acessa, via service role (que ignora RLS).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Vinculo price -> plano
-- ---------------------------------------------------------------------------

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

COMMENT ON COLUMN public.plans.stripe_price_id IS
  'Price ID do catalogo da Stripe (price_...) correspondente a este plano. '
  'Usado pelo webhook para resolver qual plano o cliente comprou. NULL enquanto '
  'nao houver Price no catalogo — nesse caso o webhook cai no match por price_cents.';

-- Indice unico parcial em vez de UNIQUE na coluna: idempotente via IF NOT EXISTS
-- e explicito quanto a multiplos NULL (planos ainda sem Price no catalogo).
CREATE UNIQUE INDEX IF NOT EXISTS plans_stripe_price_id_key
  ON public.plans (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

-- NOTA: public.plans ja tem RLS habilitada (policy `plans_public_read`,
-- criada no schema inicial). Nao mexer — a coluna nova entra sob a policy
-- que ja existe.

-- ---------------------------------------------------------------------------
-- 2. Idempotencia de eventos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload      JSONB
);

COMMENT ON TABLE public.stripe_events IS
  'Eventos recebidos da Stripe pela Edge Function stripe-webhook. O id e o '
  'event.id da Stripe (evt_...) e serve como chave de idempotencia: a function '
  'insere ANTES de processar e trata violacao de PK (23505) como duplicado.';

COMMENT ON COLUMN public.stripe_events.payload IS
  'Evento bruto da Stripe + chave _resolution com o resultado do processamento '
  '(org_id, org_via, plan_id, plan_via, status, warning) para auditoria.';

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON public.stripe_events (processed_at DESC);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- Sem policy de proposito: nenhum usuario autenticado le esta tabela.
-- Somente a Edge Function, com service role.

-- ---------------------------------------------------------------------------
-- 3. Suporte a busca da assinatura pelo id da Stripe
-- ---------------------------------------------------------------------------

-- O webhook localiza a linha por stripe_subscription_id antes de cair no
-- org_id (e usa isso no guard de evento fora de ordem). Sem indice isso e
-- seq scan a cada evento.
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMIT;
