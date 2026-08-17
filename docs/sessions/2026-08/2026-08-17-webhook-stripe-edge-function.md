<!-- Título do PR: feat(billing): webhook Stripe como Edge Function do Supabase -->
<!-- Branch: feat/stripe-webhook-edge-function → main (PR #333, mergeado em b50d4fad) -->
<!-- Sessão: 16–17/08/2026 -->

## Problema

**Assinatura paga não liberava acesso no sistema.**

A Stripe (`acct_1SktAT035ZxHFUOb`, produção) estava entregando os eventos em
`https://qyhjbvraplkptmhwqdek.supabase.co/functions/v1/credits-webhook` — um
projeto Supabase que não é o do Enriquece AI (`dhkmonctyoaenejemkrt`), e uma
função que não existe mais. Os eventos eram entregues com **200 OK**, então o
painel da Stripe parecia saudável enquanto nada acontecia no banco.

A rota Next (`src/app/api/webhooks/stripe/route.ts`) funciona, mas depende do
deploy do Coolify — o elo que quebrou em 13/08, quando a `STRIPE_SECRET_KEY`
expirada jogou um `checkout.session.completed` em `dead_letter`
(ver `2026-08-13-handoff-devops-stripe-secret-key-expirada-coolify.md`).

## Decisão

A Edge Function passa a ser o **endpoint único**:

```
https://dhkmonctyoaenejemkrt.supabase.co/functions/v1/stripe-webhook
```

A rota Next continua no código, **sem tráfego**. Motivo de não manter os dois
ativos: cada um usa uma tabela de idempotência diferente (`webhook_events` vs
`stripe_events`), então não se protegeriam de processamento duplo.

## O que foi feito

### 1. Migration (`20260816120000_stripe_webhook_support.sql`)

- `plans.stripe_price_id` + índice único parcial — mapeia price → plano
- `stripe_events` (`id text PK`, `type`, `processed_at`, `payload jsonb`) com
  **RLS ligada e nenhuma policy**: só a function acessa, via service role
- índice parcial em `subscriptions.stripe_subscription_id` (o webhook busca a
  linha por esse campo antes de cair no `org_id`)

Aplicada em produção via MCP antes do PR. Registrada no histórico como
`20260816205312` — divergência de timestamp com o nome do arquivo é o padrão
já existente no repo (idem `find_user_id_by_email`).

### 2. Edge Function (`supabase/functions/stripe-webhook/index.ts`)

`verify_jwt = false` no `config.toml` — a Stripe não manda `Authorization`, e
com JWT ligado todo evento voltaria 401 antes do handler rodar. **A assinatura
HMAC é a única autenticação**, por isso não é opcional.

- corpo lido com `req.text()`, nunca `req.json()`
- `constructEventAsync` + `createSubtleCryptoProvider` + `createFetchHttpClient`
- **idempotência INSERT-primeiro**: insere em `stripe_events` antes de
  processar e trata `23505` como duplicado (sem a corrida do
  SELECT-depois-INSERT usado no `evolution-webhook`). Em erro de banco, a linha
  é **removida antes do 500** — senão o retry da Stripe seria engolido como
  duplicado
- org: `metadata` → `stripe_customer_id` → e-mail do customer (reusa a RPC
  `find_user_id_by_email` da Story 8.6a)
- plano: `metadata` → `stripe_price_id` → `price_cents`
- status desconhecido → `past_due` (fail-closed). Mantido o gate da Story
  8.6b-2: checkout só ativa com `payment_status` `paid`/`no_payment_required`
- guarda de evento fora de ordem por `stripe_subscription_id`
- `_resolution` gravado no `payload` para auditoria por SQL

### 3. `create-checkout.ts` — metadata na subscription

O metadata da sessão só chega em `checkout.session.completed`. Repetindo em
`subscription_data`, toda subscription **nova** nasce com `org_id`/`plan_id`, e
os eventos seguintes (`customer.subscription.*`, invoices via
`parent.subscription_details.metadata`) resolvem a org isoladamente, sem
depender de o `stripe_customer_id` já ter sido gravado. Defesa contra evento
fora de ordem — a Stripe não garante ordem.

## Decisões de projeto que valem lembrar

**Plano não resolvido preserva o `plan_id`.** O checkout do app usa
`price_data` inline (price ad-hoc por sessão), que **nunca** casa por
`price_id` — o sinal confiável é o `metadata.plan_id`. E há contrato negociado
fora da tabela de preços: a org do Julio Cesar paga R$ 750/mês no plano
**Starter** (R$ 149). Resolver plano por valor teria trocado o plano dele.
Confirmado no processamento real: `plan_changed: false` nas três passadas.

**`metadata` é texto livre controlado por quem cria a sessão.** Validado com
regex UUID **e** `SELECT` antes de ir para o `.eq` — sem isso, um valor
inválido vira cast error e um UUID inexistente estoura a FK; nos dois casos o
resultado seria 500 e retry infinito. Mesma lição do `isUuid()` em `src/`.

**`subscriptions` já tem `UNIQUE (org_id)`.** A chave real do upsert é o
`org_id`; `stripe_subscription_id` (sem unique) serve para *localizar* a linha.

## Armadilhas encontradas (as três custaram tempo)

### ⭐⭐ SDK `stripe` v20 com apiKey vazia derruba a function no boot

`new Stripe('')` lança `Neither apiKey nor config.authenticator provided`. No
topo de um módulo Deno isso mata o worker: **todo** request vira
`WORKER_ERROR` 500, inclusive `GET`. E validar assinatura **não usa a API
key** — só o webhook secret e o Web Crypto.

Correção: construir com placeholder (`STRIPE_SECRET_KEY || 'sk_placeholder…'`)
e guardar cada chamada de leitura com `if (!STRIPE_SECRET_KEY) return null`.
Assim chave ausente ou expirada não derruba o webhook — só pula o
enriquecimento. **Era exatamente o modo de falha de 13/08.**

### ⭐ Secret nomeado `STRIPE` em vez de `STRIPE_WEBHOOK_SECRET`

Resultado: `500 Webhook secret not configured`, sem pista no painel da Stripe.
Diagnóstico em segundos com `supabase secrets list` (mostra nome e digest,
nunca o valor). O digest do `STRIPE` era idêntico ao do
`STRIPE_WEBHOOK_SECRET` depois — confirmando que era o mesmo `whsec_`.

### ⭐ Dois destinos na Stripe com listas de eventos idênticas

Reenviar no destino errado **some sem rastro**: o `isEventProcessed` da rota
Next vê o `event_id` em `webhook_events` e descarta como duplicado sem
atualizar nada — inclusive para eventos em `dead_letter`, que por isso nunca
reprocessam por lá. Levou duas rodadas de reenvio até acertar o alvo.

Diagnóstico definitivo: filtrar `function_edge_logs` por
`request.headers.user_agent = 'Stripe/1.0'` separa entrega real de teste local.

## Validação em produção

3 eventos de 13/08 reprocessados pela function:

| Evento | Resultado |
|---|---|
| `evt_1U41fH…RcKiDyrf` `checkout.session.completed` | `updated` / `active` — **estava em `dead_letter`** |
| `evt_1U41fG…lL0yJjSD` `invoice.payment_succeeded` | `updated` / `active` |
| `evt_1U41fG…HqDrapNk` `customer.subscription.created` | `updated` / `active` |

Nos três: `org_via: metadata`, `plan_via: metadata`, `plan_changed: false`.
Estado final: V4 Company Julio Cesar `active`, Starter, período 13/08 → 13/09.
As três passadas foram idempotentes (nenhuma linha duplicada).

Também verificado: assinatura inválida → **400**; header ausente → **400**;
`GET` → **405**; evento repetido → `{duplicate: true}` sem segunda escrita.

**A `STRIPE_SECRET_KEY` é a nova**, provado por evidência e não por suposição:
`checkout.session.completed` é o único handler que chama
`subscriptions.retrieve`, e não apareceu `Falha ao buscar subscription na
Stripe` no log.

Deploy confirmado: `/api/version` retornou `b50d4fad` ~80s após o merge.

## Auditoria

```sql
select id, type, processed_at, jsonb_pretty(payload->'_resolution')
from stripe_events order by processed_at desc limit 20;
```

Logs: `function_id = 9a43fae6-1958-4679-a11d-752e9d0e36f2`, prefixo
`[stripe-webhook]`, com `event_id`, `event_type` e resultado
(`processed` / `duplicate` / `ignored` / `org_not_found` / `error`).

## Estado final

| Item | Situação |
|---|---|
| Migration | aplicada em produção e versionada |
| Edge Function | ACTIVE, `verify_jwt: false`, endpoint único |
| Secrets | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` no **Supabase** (não no Coolify) |
| Destino antigo na Stripe | desativado em 16/08 |
| PR #333 | mergeado (`b50d4fad`), CI verde, deploy confirmado |
| Branch | apagada (remota e local) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não precisam ser configurados — o
runtime injeta, e o prefixo `SUPABASE_` recusa `secrets set`.

## Pendente

- **`plans.stripe_price_id` continua `NULL`.** Só importa se quiser resolver
  plano por price de catálogo — exigiria criar Prices próprios para
  Starter/Pro/Enterprise na Stripe. Hoje o `metadata` cobre o checkout do app.
  Cuidado: não mapear o `price_1U40K3035ZxHFUOb7aHzwJoy` para Starter — é o
  preço negociado do Julio Cesar, não o de catálogo.
- **`subscription_data.metadata` vale só para assinaturas novas.** As
  existentes não são retroativas; a do Julio Cesar já tinha o metadata.
- **Dívida na rota Next:** o `isEventProcessed` trata `dead_letter` como
  duplicado, impedindo reprocessamento manual. A rota está sem tráfego, então
  não incomoda hoje — mas se um dia voltar a ser usada, é bug.
