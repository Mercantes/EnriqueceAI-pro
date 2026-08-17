<!-- Corpo do PR da auditoria de segurança (17/08/2026). Uso: gh pr create --body-file este-arquivo -->

> **⚠️ Composição da branch:** esta branch (`fix/lead-import-batch-parser`) está 7 commits à frente de `main` e mistura 3 temas: `aed14f95` (importação em lote — Onda 2), `131aa34e` (doc de feedbacks) e os 5 commits da auditoria de segurança. Se preferir, separe a auditoria num PR próprio (cherry-pick de `9c66daab..2cbdfe40` a partir de `main`). A descrição abaixo cobre **a auditoria de segurança**.

## Resumo

Auditoria defensiva de cibersegurança da aplicação (Next.js App Router + Supabase/RLS, multi-tenant por org). Cobertura: 70 rotas de API, 13 Edge Functions, 272 Server Actions, 265 migrations, middleware e configs — via 4 auditores em paralelo (auth/RLS, API/webhooks, Server Actions/validação, segredos/deps).

Fecha **3 vazamentos cross-tenant**, endurece autorização, valida OAuth e sobe o Next.js. Handoff completo em `docs/sessions/2026-08/2026-08-17-auditoria-seguranca.md`.

## Mudanças por prioridade

### P1 — crítico (`9c66daab`)
- **IDOR cross-tenant em `bulkAssignLeads`**: os writes de service role em `cadence_enrollments`/`scheduled_activities` usavam IDs crus do cliente → agora usam `confirmedIds` (SELECT sob RLS).
- **OAuth sem validação de `state` (connection grafting)**: corrigido em HubSpot, Pipedrive, Gmail e Calendar (adapters passam a propagar o `state` real; callbacks validam com `consumeOAuthState`). RD Station não usa OAuth.
- **Next.js `16.1.6` → `16.3.1`**: advisories de bypass de middleware, SSRF e DoS.

### P2 — cross-tenant e abuso (`04e0d2af`)
- **Gravações de ligação abertas + SSRF** (`/api/calls/recording/[callId]`): agora exige token HMAC assinado e expirável, amarrado ao `callId` (link do briefing já sai assinado) + allowlist de domínio no proxy.
- **Injeção de filtro PostgREST**: `sanitizeFilterValue()` nas buscas de leads e calls.
- **CSV injection**: `neutralizeCsvFormula()` (prefixo `'`, padrão OWASP) nos exports.
- **Webhook Apollo**: removido o caminho legacy do token global; só HMAC amarrado ao `org_id`.
- **`send-invite-email`**: relay de e-mail legado (produto "V4 Money"), neutralizado para stub 410.

### P3 — hardening + política (`b59d226b`, `2cbdfe40`)
- **Ações em massa (delete/assign/archive/mark-lost) e chaves de API (create/revoke/delete) → manager-only.** UI esconde os botões para SDR (`2cbdfe40`).
- **Injeção de HTML em e-mail** (e-mail de atividade + `sendManualEmail`): passam a escapar valores de lead.
- **`addLeadNote`** confirma que o lead é da org antes de inserir.
- **Sentry**: `beforeSend` removendo `Authorization`/`Cookie`/`apikey`; `tracesSampleRate` 1.0 → 0.1.
- **`.gitignore`**: ignora `/*.csv` e `/*.pdf` na raiz (evita commit de PII de leads).

## ✅ Validação
`pnpm typecheck` · `pnpm lint` · `pnpm test:run` (**1790 passing**, 10 RLS skipped — Supabase local off) · `pnpm build` — todos verdes. Testes adicionados para o token de gravação, neutralização de CSV e a regra manager-only.

## 🚨 Ações obrigatórias PÓS-MERGE (@devops)
1. **`supabase functions delete send-invite-email`** — a função deployada continua no ar até ser removida/redeployada.
2. **Criar as envs no Coolify** (o código tem fallback para `SUPABASE_SERVICE_ROLE_KEY`, mas o ideal é dedicar):
   - `RECORDING_SIGNING_SECRET` (64 hex)
   - `UNSUBSCRIBE_SIGNING_SECRET` (64 hex)
3. Confirmar o deploy (`curl -s app.enriqueceai.com.br/api/version`).

## ⚠️ Efeitos colaterais conhecidos
- Links de gravação em **e-mails de briefing já enviados** (sem token) passarão a retornar 403. Só os novos e-mails têm o link assinado.
- SDR deixa de ver os botões de ação em massa (Atribuir/Perdido) e de mutação de chaves de API — comportamento pretendido.

## 🔭 Follow-ups (não neste PR)
CRON_SECRET no histórico do git (purge BFG); CSP `unsafe-inline` → nonce; `serverActions.allowedOrigins`; `worker_run_state` RLS `USING(true)`; `requireAdmin` allowlist hardcoded; jobs service-role em módulos `'use server'`; Edge Functions timing-safe.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
