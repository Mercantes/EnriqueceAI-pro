# Handoff → @devops (Gage): STRIPE_SECRET_KEY expirada em produção

**Data:** 2026-08-13
**Prioridade:** 🔴 Alta — billing de produção parcialmente quebrado
**Executor:** @devops (requer acesso ao painel Coolify)
**Origem:** criação do Payment Link da org "V4 Company Julio Cesar" (pagamento não ativou sozinho)

---

## Resumo

A variável de ambiente **`STRIPE_SECRET_KEY` no runtime de produção (Coolify) está EXPIRADA/revogada** (`sk_live_…DYer`). Enquanto ela não for trocada por uma chave live válida, todo o fluxo de billing que chama a API da Stripe permanece quebrado em produção.

A chave presente no `.env.local` local **é outra e está válida** (foi usada para criar o Payment Link e todas as consultas desta investigação).

## Evidência (causa raiz)

- Cliente pagou o Payment Link (session `cs_live_a1IOWh…`, `payment_status=paid`, `subscription=sub_1U41fF035ZxHFUObTrItld6g`), mas a org continuou `trialing`.
- Tabela `webhook_events` (Supabase `dhkmonctyoaenejemkrt`):
  - `checkout.session.completed` → **`status=dead_letter`, `retry_count=3`**
  - `last_error = "Expired API Key provided: sk_live_…DYer"`
- Só esse evento falha porque o handler `checkout.session.completed` ([src/app/api/webhooks/stripe/route.ts](../../../src/app/api/webhooks/stripe/route.ts)) é o único que chama a API Stripe (`stripe.subscriptions.retrieve`). Os demais (`customer.subscription.*`, `invoice.*`) usam os dados do próprio evento e aparecem `processed`.

## Escopo do impacto (enquanto não corrigir)

- ❌ Ativação de novos pagamentos (Payment Link e checkout in-app) — exige ativação manual.
- ❌ `create-checkout` in-app, `fetch-invoices`, `fetch-payment-method`, Billing Portal.
- ✅ Renovação/cancelamento de assinaturas já ativas (`subscription.updated/deleted`) continuam funcionando (não chamam a API).
- ⚠️ `STRIPE_WEBHOOK_SECRET` está **OK** — a verificação de assinatura passou; o problema é só a secret key.

## Ação (Coolify)

1. Obter uma **chave live válida** da Stripe (a que está no `.env.local` funciona; idealmente rotacionar uma nova no dashboard Stripe → Developers → API keys e revogar a `…DYer`).
2. No Coolify (app EnriqueceAI), atualizar a env **`STRIPE_SECRET_KEY`** com a chave válida.
3. **Redeploy** do app.
4. Validar (ver abaixo).

## Validação pós-troca

- `curl -s https://app.enriqueceai.com.br/api/version` → confirmar que o deploy subiu.
- No **Dashboard Stripe → Developers → Events**, localizar o evento `checkout.session.completed` da session `cs_live_a1IOWh…` e usar **"Resend"** para o endpoint `https://app.enriqueceai.com.br/api/webhooks/stripe`. Deve processar sem erro (não é estritamente necessário para a V4 — ela já foi ativada manualmente — serve como teste do fluxo).
- Alternativa: iniciar um checkout in-app de teste e confirmar que não dá erro de "Expired API Key".

## Já resolvido nesta sessão (não precisa refazer)

- ✅ Org **V4 Company Julio Cesar** (`0bbf24f6-e4f4-4cc3-92ac-0301d8b31144`) ativada manualmente via MCP com os dados reais da Stripe: `status=active`, `stripe_subscription_id=sub_1U41fF035ZxHFUObTrItld6g`, `stripe_customer_id=cus_V49zdWla5XFfoA`, período até 2026-09-13, `member_limit_override=5`.
- ✅ **PR #301** (webhook grava `stripe_customer_id` no `checkout.session.completed`) — mergeado e deployado (`main` = `80510cb`). Ortogonal a este bug: útil para renovação/cancelamento de pagamentos via Payment Link.

## Observações de segurança (fora do escopo imediato)

- A conta Stripe é **compartilhada** entre vários projetos (endpoints webhook: lovable.dev, cleo-app vercel, 4 supabase edge functions + enriqueceai). Trocar apenas a env do EnriqueceAI **não** afeta os outros; só cuidado ao revogar a chave antiga (confirmar que `…DYer` não é usada por outro serviço antes de revogar).
- Tokens Kommo e chaves Supabase aparecem em texto puro em workflows n8n (dívida de segurança separada).

## Referências

- Memória: `stripe-secret-key-expired-in-coolify`, `stripe-payment-link-v4-julio-cesar`
- Link de pagamento: `https://buy.stripe.com/3cI28j9dV05b8v67N30ZW01`
