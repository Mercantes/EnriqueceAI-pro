# Story: Regenerar os types do Supabase e destravar a geração automática

## Status
Ready for Review

## Change Log
| Data | Autor | Mudança |
|------|-------|---------|
| 2026-09-05 | @dev (Dex) | Ready → InProgress → **Ready for Review**. Fases 1 e 2 completas no worktree `supabase-types-regeneration` (branch `worktree-supabase-types-regeneration`, base 239fc2f8). `from()` solto + `types.ts` regenerado + 34 fixes + `pnpm gen:types` + docs. Opção (b) medida: 147 erros → descartada. CI drift adiado (sem secret). Nada commitado. |
| 2026-09-05 | Vini + Claude | Story criada após a tentativa de regenerar `types.ts` pelo MCP quebrar o typecheck (63 erros / 30 arquivos). Diagnóstico e plano em 2 fases abaixo. |
| 2026-09-05 | @po (Pax) | Validação 10 pontos: **GO 10/10** → Draft → Ready. Ajustes: as 6 chamadas `.from()` fora do wrapper são `storage.from()` (buckets), não tabelas — removidas do escopo; item 7 passa a cobrir também `deploy-verification-checklist.md` (2 menções a `TYPES_STALE`); item 8 anotado que `ci.yml` hoje não tem secret do Supabase; dependências: CLI 2.75.0 disponível via `npx`, 0 `@ts-ignore` em `src/` hoje. |

## Executor Assignment
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["typecheck", "lint", "vitest", "build"]

## Origem
Ao fechar a story `activity-skip-guardrails` (05/set/2026) tentamos regenerar `src/lib/supabase/types.ts` pelo MCP do Supabase (`generate_typescript_types`). Resultado:

| | Arquivo atual (repo) | Gerado pelo MCP |
|---|---|---|
| Linhas | 1 903 | 5 947 |
| Tabelas/views tipadas | 36 | 161 |
| Colunas `auto_loss_*`, `snooze_count`, `sdr_switch_allowed` | só as 2 últimas, editadas à mão | todas |

O arquivo do repo está defasado há meses. Desde então toda migration que cria coluna exige editar `types.ts` **à mão** (foi assim em `activity-skip-guardrails`), o que é frágil e vai divergindo do banco.

Ao substituir pelo gerado: **63 erros de typecheck em 30 arquivos**. Revertido; nada foi commitado.

## Diagnóstico (já feito, não precisa repetir)

Os 63 erros têm **duas causas**, em camadas:

### Camada 1 — o wrapper `from()` (29 dos 63 erros)
`src/lib/supabase/from.ts`:
```ts
return supabase.from(table as any) as ReturnType<SupabaseClient<Database>['from']>;
```
`ReturnType` de uma função sobrecarregada/genérica resolve para **um** ramo, e com o `Database` completo o TypeScript passa a validar todo `.update({...})`/`.insert({...})` contra as colunas de **`leads`** (a primeira tabela). Por isso os erros "`'abm_enabled' does not exist`" em `organizations`, "`'name' does not exist`" em `loss_reasons`, e `"processed"` não aceito em `webhook_events.status` (comparado com `lead_status`).

**Confirmado por teste:** trocando o cast para `ReturnType<SupabaseClient<any>['from']>` com o `types.ts` gerado, os erros caem de **63 → 34**. Todos os TS2353/TS2322/TS2339/TS2345 somem.

### Camada 2 — casts de builder para `Promise` (34 erros restantes, 14 arquivos)
Padrão recorrente, usado dentro de `Promise.all([...])`:
```ts
from(supabase, 'closers').select('id, name, email').in('id', ids) as Promise<{ data: ... }>
```
Com o builder agora tipado (`PostgrestFilterBuilder<..., { id: any; name: any }[]>`), o TS diz que a conversão para `Promise<{ data: T }>` "não se sobrepõe" (TS2352). Correção mecânica por ocorrência: `as unknown as Promise<...>` ou `await` antes do cast.

Arquivos e ocorrências:

| Arquivo | Erros |
|---|---|
| `src/features/billing/actions/fetch-usage-dashboard.ts` | 5 |
| `src/features/leads/actions/send-meeting-briefing.ts` | 4 |
| `src/features/leads/actions/get-missing-meeting-fields.ts` | 3 |
| `src/features/activities/actions/fetch-cadences-with-availability.ts` | 3 |
| `src/features/leads/actions/fetch-closer-feedbacks.ts` | 2 |
| `src/features/cadences/actions/fetch-cadences.ts` | 2 |
| `src/features/activities/actions/fetch-dialer-queue.ts` | 2 |
| `src/app/feedback/[token]/page.tsx` | 2 |
| `src/app/api/cron/feedback-reminders/route.ts` | 2 |
| `src/app/api/cron/expire-trials/route.ts` | 2 |
| `src/app/api/cron/check-google-connections/route.ts` | 2 |
| `src/app/api/cron/activity-reminders/route.ts` | 2 |
| `src/app/api/admin/resend-closer-feedback/route.ts` | 2 |
| `src/features/inbound-api/services/api-key.service.ts` | 1 |

As 6 chamadas `.from(...)` fora do wrapper (em `upload-avatar.ts` e `upload-org-logo.ts`) são **`supabase.storage.from('avatars'|'org-logos')`**, buckets de storage, não tabelas — o `Database` completo não as afeta. Nenhuma tabela é acessada sem o wrapper.

## Story
**As a** desenvolvedor,
**I want** que `src/lib/supabase/types.ts` seja gerado do banco real com um comando, sem quebrar o typecheck,
**so that** toda migration nova venha com os tipos certos e ninguém mais edite o arquivo à mão.

## Complexity
**M** — 1 mudança pontual no wrapper + 34 casts mecânicos em 14 arquivos + script/documentação. Sem migration, sem mudança de comportamento em runtime (só tipos).

## Scope

**IN — Fase 1 (destravar):**
1. `src/lib/supabase/from.ts`: trocar o cast do retorno para um tipo que não fixe uma tabela. Duas opções, decidir na implementação:
   - **(a) solto:** `ReturnType<SupabaseClient<any>['from']>` — zero risco, mantém o nível de tipagem que já existe hoje (nenhum). Confirmado que resolve 29 erros.
   - **(b) genérico de verdade:** `from<T extends keyof Database['public']['Tables']>(supabase, table: T)` retornando `supabase.from(table)` tipado. Dá autocomplete e checagem de coluna, mas vai expor mais casts `as { data: T }` que hoje passam por acaso. Só tentar se (a) estiver verde; medir quantos erros aparecem antes de decidir.
2. Substituir `types.ts` pelo gerado (`generate_typescript_types` do MCP, ou `npx supabase gen types typescript --project-id dhkmonctyoaenejemkrt --schema public`).
3. Corrigir os 34 casts `as Promise<...>` → `as unknown as Promise<...>` (ou `await` + cast no resultado) nos 14 arquivos listados.
4. Rodar Prettier no `types.ts` gerado (o MCP devolve sem formatação; `format:check` reclama).
5. `pnpm typecheck && pnpm lint && pnpm test:run && pnpm build` verdes.

**IN — Fase 2 (não regredir):**
6. Script `pnpm gen:types` no `package.json` (CLI do Supabase, project-id fixo, `--schema public`) + Prettier automático no arquivo.
7. Documentar no `CLAUDE.md` do projeto: "migration que cria/altera coluna → rodar `pnpm gen:types` no mesmo PR". Atualizar o Checkpoint 3 do `.claude/rules/dev-checkpoints.md` (linha "Types regenerated or `TYPES_STALE` documented") **e** `.aios-core/product/checklists/deploy-verification-checklist.md` (2 menções a `TYPES_STALE`): o marcador `TYPES_STALE` deixa de ser aceito como alternativa; regenerar passa a ser obrigatório.
8. Check no CI (job leve em `.github/workflows/ci.yml`, hoje sem nenhum secret do Supabase): `pnpm gen:types` contra o projeto + `git diff --exit-code src/lib/supabase/types.ts` → falha se o arquivo estiver defasado. **Requer** `SUPABASE_ACCESS_TOKEN` como secret do GitHub — decisão do @devops se vale o acoplamento do CI ao Supabase; se não, deixar como job manual/`workflow_dispatch`.

**OUT:**
- Refatorar os `as { data: T }` espalhados pelo código para usar os tipos gerados (`Database['public']['Tables']['x']['Row']`). É a consequência natural da opção (b), mas é uma story de tipagem por feature, não esta.
- Storage (`supabase.storage.from(...)` em avatares/logos): não é tabela, fora desta story.
- Schemas fora de `public`.

## Dependencies
- MCP do Supabase ou CLI `supabase` autenticada (`SUPABASE_ACCESS_TOKEN`) para gerar. CLI 2.75.0 já disponível via `npx supabase` neste ambiente.
- Nenhuma story em andamento tocando `from.ts`.
- Hoje há **0** `@ts-ignore`/`@ts-expect-error` em `src/` (fora de testes) — o AC 2 exige que continue assim.

## Risks
| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Opção (b) do `from()` expõe dezenas de casts frágeis e a story explode de escopo | Alta | Médio | Fazer (a) primeiro e commitar; (b) só como tentativa medida (contar erros) e reverter se > ~20 |
| `types.ts` gerado muda tipos de enum que o código compara com string literal (`'processed'`, `'dead_letter'`) | Média | Baixo | Esses erros já somem com a camada 1; conferir que os literais batem com o enum real do banco |
| Arquivo gerado de 6k linhas gera diff enorme em todo PR futuro que mexa no schema | Certa | Baixo | É o esperado; `gen:types` sempre num commit separado ("chore(types): regenerate") |
| CI acoplado ao Supabase (Fase 2, item 8) falha por rede/token e bloqueia merges | Média | Médio | Job separado e não obrigatório, ou `workflow_dispatch` |

## Acceptance Criteria
1. `src/lib/supabase/types.ts` é byte-a-byte o output do gerador (após Prettier) para o projeto `dhkmonctyoaenejemkrt`, incluindo `snooze_count`, `sdr_switch_allowed`, `auto_loss_*` e as 161 tabelas/views.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test:run` e `pnpm build` verdes sem nenhum `// @ts-ignore`/`@ts-expect-error` novo.
3. `from()` não valida mais payloads contra as colunas de `leads` (regressão: `updateOrgSettings` com `abm_enabled` compila).
4. Nenhuma mudança de comportamento em runtime (só tipos): suíte inteira sem alteração de asserção.
5. `pnpm gen:types` existe, gera e formata o arquivo; documentado no `CLAUDE.md` e no `dev-checkpoints.md`.
6. Decisão registrada sobre o check de CI (item 8): implementado, ou explicitamente adiado com motivo.

## Tasks
- [x] Fase 1.1 — `from.ts` opção (a); typecheck com o `types.ts` gerado mostrou exatamente os 34 previstos (33 TS2352 + 1 TS2339)
- [x] Fase 1.2 — 33 casts `as Promise<…>` → `as unknown as Promise<…>` em 13 arquivos; `api-key.service.ts` (TS2339: builder tipado não expõe `.catch`) envolvido em `Promise.resolve(...)`
- [x] Fase 1.3 — Prettier no `types.ts`; typecheck ✅ lint ✅ test:run ✅ (1870) build ✅. (`pnpm format:check` global falha em 879 arquivos **pré-existentes** e não faz parte do CI — dívida do projeto, não desta story; `types.ts` e `from.ts` passam no Prettier.)
- [x] Fase 1.4 — medido e **descartado**: `from<T extends keyof Tables>` tipado → **147 erros em 85 arquivos** (110 TS2769 "no overload matches", 37 TS2345). Muito acima do teto de ~20. Revertido; fica como story futura de tipagem por feature.
- [x] Fase 2.1 — `pnpm gen:types` (`supabase gen types typescript --project-id dhkmonctyoaenejemkrt --schema public` + prettier). Verificado: output **byte-a-byte idêntico** ao do MCP após prettier (AC 1). `supabase` já é devDependency (2.76.10).
- [x] Fase 2.2 — `.claude/CLAUDE.md` (seção "Supabase types"), `.claude/rules/dev-checkpoints.md` (Checkpoint 3), `.aios-core/product/checklists/deploy-verification-checklist.md` (2 trechos): `TYPES_STALE` deixa de ser aceito
- [x] Fase 2.3 — **decisão: adiado.** `ci.yml` não tem nenhum secret do Supabase; acoplar o CI obrigatório a um token/rede externa por um check de drift não compensa agora. Quando @devops quiser, é um job separado `types-drift` (`pnpm gen:types && git diff --exit-code src/lib/supabase/types.ts`) com `SUPABASE_ACCESS_TOKEN`, não bloqueante. Até lá, o Checkpoint 3 é a trava.

## Dev Notes
- Listas completas dos erros (63 com `from()` atual; 34 com `from()` solto) foram geradas em 05/set e cabem em 1 comando: substituir `types.ts` pelo gerado e rodar `pnpm typecheck 2>&1 | grep "error TS"`. Não anexadas para não envelhecer.
- O MCP devolve o TS dentro de um JSON `{"types": "..."}` numa linha só (~190 kB); extrair com `jq -r '.types'`. A CLI do Supabase gera direto.
- `from.ts` tem 1 uso de `as any` de propósito (o `table`); a story mexe **só no cast do retorno**.
- ⭐ Não misturar com feature: PR só de tipos, revisável por diff de `from.ts` + os 14 arquivos; o `types.ts` gerado entra como "arquivo gerado".

## Dev Agent Record
### Agent Model Used
claude-fable-5-1 (@dev / Dex) — worktree `.claude/worktrees/supabase-types-regeneration`, branch `worktree-supabase-types-regeneration`, base `main` 239fc2f8

### File List
**Tipos**
- `src/lib/supabase/types.ts` — **gerado** por `pnpm gen:types` (5866 linhas, 161 tabelas/views, formatado)
- `src/lib/supabase/from.ts` — cast do retorno `SupabaseClient<Database>` → `SupabaseClient<any>` + comentário explicando o porquê

**Casts `as unknown as Promise<…>` (13 arquivos, 33 ocorrências)**
- `src/app/api/admin/resend-closer-feedback/route.ts`, `src/app/api/cron/{activity-reminders,check-google-connections,expire-trials,feedback-reminders}/route.ts`, `src/app/feedback/[token]/page.tsx`
- `src/features/activities/actions/{fetch-cadences-with-availability,fetch-dialer-queue}.ts`, `src/features/billing/actions/fetch-usage-dashboard.ts`, `src/features/cadences/actions/fetch-cadences.ts`, `src/features/leads/actions/{fetch-closer-feedbacks,get-missing-meeting-fields,send-meeting-briefing}.ts`
- `src/features/inbound-api/services/api-key.service.ts` — `Promise.resolve(builder).then().catch()`

**Fase 2**
- `package.json` — script `gen:types`
- `.claude/CLAUDE.md` — seção "Supabase types" na área Database
- `.claude/rules/dev-checkpoints.md` — Checkpoint 3
- `.aios-core/product/checklists/deploy-verification-checklist.md` — seção 3 e "If types are stale"
- `docs/stories/supabase-types-regeneration.story.md`

### Validation
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test:run` ✅ 1870 passed (sem alteração de asserção) · `pnpm build` ✅ (exit 0)
- `pnpm format:check` global: ❌ 879 arquivos pré-existentes fora do padrão (não está no CI; dívida do projeto). Os 3 arquivos reescritos (`types.ts`, `from.ts`, `api-key.service.ts`) passam no Prettier; os 13 arquivos de casts mantêm o estado de formatação que já tinham na `main` (a troca foi textual, sem reformatar — reformatá-los poluiria o diff).
- `pnpm gen:types` executado de verdade: arquivo idêntico ao gerado pelo MCP após prettier.
- Nenhum `@ts-ignore`/`@ts-expect-error` novo (0 em `src/` fora de testes).
- Sem verificação no browser: só tipos, zero mudança de runtime.

### Decisões
- **Opção (a) no `from()`**: `ReturnType<SupabaseClient<any>['from']>`. Tipagem real (opção b) medida em 147 erros / 85 arquivos → fora desta story.
- **`as unknown as Promise<…>`** em vez de `await` + cast: mantém o `Promise.all` paralelo como estava; zero mudança de comportamento.
- **CI drift check adiado** (ver task 2.3).
- **Commit separado sugerido**: `chore(types): regenerate` para o `types.ts` e `fix(types): ...` para `from.ts` + casts + docs, para o diff da revisão não ser engolido pelas 5866 linhas geradas.

### DoD (story-dod-checklist) — autoavaliação
- [x] AC 1–5 atendidos; AC 6 atendido por decisão documentada (adiado com motivo).
- [x] Padrões do projeto; sem dependência nova (`supabase` já era devDependency); sem env nova (token só para quem roda `gen:types`).
- [x] Build, lint, format e testes verdes.
- [ ] Verificação manual — N/A (só tipos).
- [ ] CodeRabbit — não rodou (login interativo).

## QA Results

### Review Date: 2026-09-05

### Reviewed By: Quinn (Test Architect)

**Escopo revisado:** diff completo do worktree (20 arquivos), com o `types.ts` gerado tratado como artefato; `pnpm gen:types` re-executado pelo QA; suíte re-executada.

| # | Check | Resultado |
|---|-------|-----------|
| 1 | Code review | ✅ Os 33 casts são troca textual `as` → `as unknown as`; `api-key.service.ts` usa `Promise.resolve(builder)` (adota o thenable, mesma semântica). `from.ts` documenta o porquê do `SupabaseClient<any>`. |
| 2 | Unit tests | ✅ 1870 verdes re-executados; nenhuma asserção alterada (AC 4). Story é só de tipos — sem teste novo esperado. |
| 3 | Acceptance criteria | ✅ AC 1–6 (AC 6 por decisão documentada). |
| 4 | No regressions | ✅ Zero mudança de runtime. `gen:types` idempotente: hash `953d01eac6b2` antes e depois. |
| 5 | Performance | N/A |
| 6 | Security | ✅ Nenhuma env nova no repo; token só na máquina de quem gera. |
| 7 | Documentation | ✅ `CLAUDE.md`, `dev-checkpoints.md`, `deploy-verification-checklist.md`; `TYPES_STALE` removido como alternativa. |

### Observações (low, não bloqueiam)
- **REL-001** — `gen:types` redireciona direto para `types.ts`; se a CLI falhar, o arquivo fica vazio (typecheck denuncia na hora). Melhor gerar em temporário e `mv`.
- **MNT-001** — Prettier reordenou imports de `api-key.service.ts`; ruído de diff, sem regra de lint.
- **DOC-001** — CodeRabbit continua sem rodar (login interativo).

### Gate Status

Gate: PASS → docs/qa/gates/supabase-types-regeneration.yml

Pronto para `@devops`: dois commits como o @dev sugeriu (`chore(types): regenerate` só com `types.ts`; `fix(types): …` com `from.ts`, casts e docs), push e PR.
