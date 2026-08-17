<!-- Título: Auditoria de cibersegurança da aplicação (defensiva) -->
<!-- Branch: fix/lead-import-batch-parser (3 commits, sem push) -->
<!-- Commits: 9c66daab (P1), 04e0d2af (P2), b59d226b (P3) -->
<!-- Sessão: 17/08/2026 -->

## Objetivo

Auditoria defensiva de segurança da aplicação EnriqueceAI (Next.js App Router +
Supabase/RLS, multi-tenant por org, papéis `manager`/`sdr`) e correção dos
achados priorizados. Cobertura: 70 rotas de API, 13 Edge Functions, 272 arquivos
de Server Action, 265 migrations, middleware, guards de auth e configs.

Método: 4 auditores em paralelo (auth/RLS, rotas API/webhooks, Server
Actions/validação, segredos/deps), lendo o código de verdade. Cada correção foi
validada com `pnpm typecheck && pnpm lint && pnpm test:run && pnpm build`.

Veredito geral: base sólida (headers exemplares, webhooks assinados+idempotentes,
RLS por org, comparações timing-safe, padrão IDOR correto na maioria). Os
achados abaixo eram brechas pontuais — 3 delas com vazamento cross-tenant.

## Corrigido — Prioridade 1 (`9c66daab`)

1. **IDOR cross-tenant no `bulkAssignLeads`** — os writes de service role em
   `cadence_enrollments`/`scheduled_activities` usavam `leadIds` crus do cliente.
   Agora usam `confirmedIds` (SELECT sob RLS), como as ações irmãs. Arquivo:
   `src/features/leads/actions/bulk-assign-leads.ts`.
2. **OAuth sem validação de `state` (connection grafting)** — só o Kommo
   validava. Corrigido em HubSpot, Pipedrive, Gmail e Calendar: os adapters
   passaram a propagar o `state` real e os callbacks validam com
   `consumeOAuthState`. Gmail empacota `state = "<csrf>|<redirect>"`. RD Station
   ficou de fora de propósito (não usa OAuth — API token).
3. **Next.js `16.1.6` → `16.3.1`** — advisories de bypass de middleware, SSRF e
   DoS (o middleware é quem faz auth-redirect, CSRF check e default-deny de
   `/api/admin` e `/api/workers`).

## Corrigido — Prioridade 2 (`04e0d2af`)

4. **Gravações de ligação abertas + SSRF** —
   `src/app/api/calls/recording/[callId]/route.ts` era aberto (qualquer UUID
   baixava o MP3, inclusive de outra org). Agora exige **token HMAC assinado com
   expiração (30d) amarrado ao `callId`** (`src/lib/security/recording-token.ts`);
   o link no e-mail de briefing já sai assinado. Adicionada **allowlist de
   domínio** antes do proxy (a `recording_url` vem do webhook API4COM = SSRF).
   > Efeito colateral: links de briefing já enviados (sem token) passam a dar 403.
5. **Injeção de filtro PostgREST** — `sanitizeFilterValue()` nas buscas de leads
   e calls (`fetch-leads`, `get-calls`, `export-all-filtered-leads-csv`,
   `export-calls-csv`). Impedia injetar condições OR extras via `x,status.eq.won`.
6. **CSV injection** — `neutralizeCsvFormula()` em `src/lib/utils/csv.ts` prefixa
   `'` em células que começam com `= + - @ \t \r` (OWASP), aplicado aos exports.
7. **Webhook Apollo** — removido o caminho legacy do token global em texto puro
   (aceitava `org_id` arbitrário). Agora só HMAC amarrado ao `org_id`.
8. **`send-invite-email`** — Edge Function morta do produto "V4 Money" (relay de
   e-mail sem authz, HTML sem escape, sem rate limit). Neutralizada para stub 410.

## Corrigido — Prioridade 3 (`b59d226b`)

- **Ações em massa → manager-only** — `bulkDelete/Assign/Archive/MarkLost` agora
  exigem papel `manager` (decisão do time). Fecha o risco de um SDR mexer na base
  inteira com `lead_visibility_mode='all'`. Teste adicionado.
- **Chaves de API → manager-only** — `create/revoke/delete` de chaves inbound.
- **Injeção de HTML em e-mail** — `escapeHtml: true` no e-mail de atividade e
  escape no `sendManualEmail`.
- **IDOR menor** — `addLeadNote` confirma que o lead é da org antes de inserir.
- **Sentry** — `beforeSend` removendo `Authorization`/`Cookie`/`apikey`;
  `tracesSampleRate` 1.0 → 0.1 (client + server).
- **`.gitignore`** — `/*.csv` e `/*.pdf` na raiz (evita commit acidental de PII).

## Pendências (fora do código — não aplicadas nesta sessão)

- **@devops:** `supabase functions delete send-invite-email` — a função deployada
  continua no ar até redeploy/remoção.
- **@devops:** criar envs dedicadas `RECORDING_SIGNING_SECRET` e
  `UNSUBSCRIBE_SIGNING_SECRET` (código já tem fallback; hoje reusa a
  `SUPABASE_SERVICE_ROLE_KEY` — item A6 de hardening).
- **@devops:** CRON_SECRET real hardcoded em migrations antigas
  (`20260303*/20260304*/20260305*`) — valores já rotacionados/mortos, mas no
  histórico do git; avaliar purge (BFG).
- **UX:** esconder na interface os botões de ação em massa / chaves de API para
  SDR (senão ele vê o botão e recebe erro).

## Follow-ups de hardening (baixo impacto, incrementais)

- CSP `script-src 'unsafe-inline'` → nonce + `strict-dynamic` (PR dedicado).
- `serverActions.allowedOrigins` (cuidado com o proxy Coolify).
- `worker_run_state` RLS `USING (true)` → restringir a manager/service role.
- `requireAdmin` com allowlist de UUIDs hardcoded → tabela/flag.
- Jobs com service-role em módulos `'use server'` → mover para services.
- Comparações de segredo não timing-safe em Edge Functions (`_shared/auth.ts`,
  relays `check-email-replies`/`execute-cadence-steps`/`enrich-leads`).
- Dependências transitivas (`pnpm audit`): `minimatch`/`undici`/`tar`; críticas
  são dev-only (`vitest`, `node-tar`).

## Validação

`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test:run` ✅ (1790 passing, 10 RLS
skipped) · `pnpm build` ✅. 3 commits na branch `fix/lead-import-batch-parser`,
sem push (push/PR é operação exclusiva do @devops).
