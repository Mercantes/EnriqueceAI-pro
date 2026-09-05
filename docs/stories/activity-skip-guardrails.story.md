# Story: Guard-rails do "Pular" na fila de Atividades

## Status
Ready for Review

## Change Log
| Data | Autor | Mudança |
|------|-------|---------|
| 2026-09-05 | Vini + Claude | Story criada a partir da revisão do menu de ações da fila (opção 2 escolhida: atrito + visibilidade + limite) |
| 2026-09-05 | @dev (Dex) | Ready → InProgress → **Ready for Review**. Implementação completa na branch `feat/activity-skip-guardrails` (base `origin/main` ef352b99). typecheck/lint/1864 testes/build verdes. CodeRabbit NÃO rodou: CLI pede `coderabbit auth login` interativo. ⚠️ **Deploy só depois das 2 migrations em prod** — o código seleciona `snooze_count`/`sdr_switch_allowed`; sem as colunas a fila quebra. Nada commitado (regra git manual). |
| 2026-09-05 | @dev (Dex) | **QA fixes aplicados** (gate FAIL → re-review): REL-001 `snooze_count` zera no trigger `calculate_next_step_due` quando `current_step` muda (migration `20260905150100` reescrita; RPC mantém o reset redundante); REL-002 `ActivityLogView` passa `onSwitchCadence` ao sheet; REL-003 `SkipStepReasonDialog` reseta estado no confirm; SEC-001 `switchLeadsCadence` valida `reason` (enum) e `note` (max 140) com zod; TEST-001 +6 testes RTL (SkipStepReasonDialog, SnoozeLimitDialog, ProgressCard) + 1 no switch. MNT-001 fica como dívida. typecheck/lint ✅, 1870 testes ✅, build ✅. Status permanece Ready for Review. |
| 2026-09-05 | Claude (MCP Supabase) | **Migrations aplicadas em prod** (`dhkmonctyoaenejemkrt`). Ensaio em `BEGIN … ROLLBACK` num enrollment ativo: adiar mantém `snooze_count`; `status` igual mantém; `current_step` muda → zera. Depois: colunas criadas, 1160 enrollments ativos com `snooze_count = 0`, 0 cadências bloqueadas (default `true`), trigger e RPC com o reset. Função de prod antes da troca era idêntica à versão 9h BRT do repo (nada sobrescrito). Deploy do código agora está liberado. |
| 2026-09-05 | @po (Pax) | Validação 10 pontos: **GO 9/10** → Draft → Ready. Ajustes aplicados: `fetchActiveCadences` ganha `forSwitch`; editor = `CadenceBuilder.tsx`; input de `reportWhatsAppInvalid` composto no `skipStep`; "Perdidos hoje" não existia no card → incluído no contador (item 4 / AC 7); Migration B apontada na linha exata da RPC. Ponto 10 (epic) parcial: story standalone, origem rastreada à sessão 05/set e ao PR #360. |

## Executor Assignment
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vitest", "typecheck", "lint"]

## Origem
Revisão de 05/set/2026 do menu de ações de cada linha da fila (`Executar ▾`). Diagnóstico:

- Existem **dois "Pular" com nomes iguais e efeitos diferentes**:
  - **Botão "Pular" dentro da execução** (`ActivityExecutionSheet.tsx` → `skipActivity`) só adia a MESMA tarefa em 2h (ou o delay do passo, se maior). Matheus (62/dia) e Giovanni (45/dia) usam como "depois eu vejo"; em 05/set, 59/102 e 46/103 das vencidas deles tinham esse evento como último. A tarefa volta à tarde e fica vermelha.
  - **Item "Pular esta atividade" no menu da linha** (`ActivityRow.tsx` → `skipStep`) pula o PASSO inteiro: a cadência avança como se tivesse sido executado. Sem confirmação, sem motivo, sem limite.
- **"Trocar cadência"** (`EnrollInCadenceDialog mode="switch"` → `switchLeadsCadence`) tira o lead da cadência atual sem pedir motivo e lista TODAS as cadências ativas.
- Nenhuma dessas ações aparece para o gestor em lugar nenhum (só na timeline do lead, uma a uma).

Resultado: o SDR consegue esvaziar a fila inteira sem falar com ninguém e sem deixar dado. Contexto anterior: fix do vencimento às 9h BRT (PR #360) resolveu a causa 1 da fila "atrasada"; esta story ataca a causa 2 (uso do Pular).

## Story
**As a** gestor de SDRs,
**I want** que pular/adiar/trocar cadência tenha custo mínimo (motivo de 1 clique), limite e visibilidade,
**so that** a fila reflita trabalho real e eu enxergue quem está empurrando tarefa em vez de executar.

**As a** SDR,
**I want** que "adiar" jogue a tarefa para amanhã de manhã (e não para daqui a 2h),
**so that** eu não termine o dia com uma fila vermelha que eu mesmo criei.

## Complexity
**M** — 2 migrations pequenas (coluna + reset na RPC), 3 server actions alteradas, 2 diálogos novos/ajustados, 1 card de gestor.

## Scope

**IN:**

### 1. Adiar (botão dentro da execução) → amanhã 9h BRT, com limite de 2 por passo
- `skipActivity` (`src/features/activities/actions/skip-activity.ts`) passa a marcar `next_step_due` = **09:00 BRT do próximo dia útil** (reusar `skip_weekend_brt` / mesma regra da migration `20260905120000_next_step_due_at_9h_brt.sql`). O piso de 2h e o "delay do passo" deixam de existir aqui.
- Nova coluna `cadence_enrollments.snooze_count INTEGER NOT NULL DEFAULT 0`.
  - `skipActivity` incrementa.
  - RPC `advance_enrollment_after_step` zera ao avançar o passo (migration `CREATE OR REPLACE` sobre `20260615150000_advance_enrollment_after_step_rpc.sql`).
  - Enrollment novo já nasce 0 (trocar cadência cria outra linha).
- **Limite: 2 adiamentos por passo.** No 3º, o servidor recusa (`code: 'SNOOZE_LIMIT'`) e a UI abre um diálogo "Esse lead já foi adiado 2 vezes" com 3 saídas: **Executar agora** (fecha o diálogo e mantém na execução), **Lead perdido** (abre `MarkLeadLostDialog`), **Trocar cadência** (abre o diálogo de troca). Não existe 4ª opção.
- Botão renomeado para **"Adiar p/ amanhã"** e mostra o restante ("1 adiamento restante"). Toast: "Adiado para amanhã às 9h".
- Evento na timeline continua `activity_skipped`, mensagem "Adiada para amanhã 9h (2/2)".

### 2. Pular passo (menu da linha) → exige motivo de 1 clique
- Item renomeado para **"Pular este passo"** (deixa claro que a cadência avança).
- Ao clicar, abre diálogo pequeno com motivos fixos em código (constante, sem tabela): `Sem telefone / WhatsApp`, `Número ou e-mail inválido`, `Já contatei por outro canal`, `Outro` (campo curto opcional, máx. 140). Sem motivo não confirma.
- `skipStep` (`skip-step.ts`) passa a receber `reason` (obrigatório, enum) + `note` opcional e grava em `interactions.metadata.skip_reason` / `skip_note`. Mensagem: "Passo pulado pelo SDR — motivo: {motivo}".
- Se motivo = `Número ou e-mail inválido` e o canal do passo é WhatsApp, chamar o fluxo existente de `report-whatsapp-invalid.ts` em vez de só pular (evita repetir a mesma pergunta 3 passos depois). `reportWhatsAppInvalid` exige `enrollmentId, cadenceId, stepId, leadId, orgId`; `skipStep` já busca `lead_id, cadence_id, org_id` do enrollment, então compõe o input sem query extra. Se for e-mail, apenas registrar (fora do escopo marcar e-mail inválido).

### 3. Trocar cadência → motivo + lista restrita para SDR
- Diálogo de troca (`EnrollInCadenceDialog mode="switch"`) passa a pedir motivo (mesma lista do item 2 + `Cadência errada para esse lead`). Grava em `cadence_switched.metadata.switch_reason`.
- Nova coluna `cadences.sdr_switch_allowed BOOLEAN NOT NULL DEFAULT true`.
  - Gestor desmarca no editor de cadência (`CadenceBuilder.tsx`, checkbox "SDR pode mover leads para esta cadência").
  - `fetchActiveCadences` hoje não recebe parâmetro; ganha um opcional `{ forSwitch?: boolean }`. Com `forSwitch=true` e usuário NÃO manager (`isManager()` de `lib/auth/require-manager`), filtra por essa flag. Manager vê todas. O diálogo passa `forSwitch` quando `mode="switch"`.
  - `switchLeadsCadence` valida no servidor: não-manager tentando cadência com flag `false` → erro `FORBIDDEN`.
- Default `true` para não mudar nada no dia do deploy. Restringir é decisão do gestor depois.

### 4. Visibilidade do gestor
- No card **Controle Diário** da tela de Atividades (`fetchDailyProgress` já aceita `sdrUserId` para manager), adicionar linha secundária: **"Adiadas 12 · Puladas 3 · Trocadas 1 · Perdidos 4"** (hoje, BRT, por SDR selecionado). Fonte: `interactions` com `channel='system'` e `metadata.system_event` em `activity_skipped` / `step_skipped_manual` / `cadence_switched` / evento de lead perdido (conferir o nome usado por `markLeadAsLost`), `performed_by = SDR`, `created_at` de hoje. "Perdidos" entra porque é a válvula de escape natural quando o adiamento trava (ver Risks).
- Ao passar o mouse na linha, tooltip com os motivos mais usados do dia (contagem por `skip_reason`).
- Para o próprio SDR a linha também aparece (ele vê o próprio número).

### 5. Comunicação
- Avisar Matheus e Giovanni antes do deploy (existe rascunho no Gmail do Vini sobre o Pular; atualizar com a regra nova).

**OUT:**
- Retorno agendado (`postponeScheduledActivity` / atividades `isScheduled`): continua como está, o horário é do SDR.
- Tirar "Pular este passo" do menu do SDR (era a opção 3).
- Relatório histórico de pulos por semana/mês (só o contador do dia). Se virar necessidade, entra como story de Relatórios.
- Marcar e-mail como inválido a partir do motivo.
- Limite de trocas de cadência por dia.

## Dependencies
- PR #360 mergeado (regra das 9h BRT / `skip_weekend_brt`) — reusar a mesma função, não copiar.
- `report-whatsapp-invalid.ts` (fluxo de WhatsApp inválido) já existe.
- `MarkLeadLostDialog` e `EnrollInCadenceDialog` já existem e são reaproveitados no diálogo do limite.

## Risks
| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| SDR passa a usar "Pular este passo" (sem limite) no lugar do "Adiar" para fugir do limite | Média | Médio | motivo obrigatório + contador visível pro gestor no dia; se inflar, próxima iteração limita também |
| SDR marca "Perdido" só para se livrar do lead | Média | Alto | motivo de perda já é obrigatório; "Perdidos hoje" NÃO existe no card ainda → incluído no contador do item 4 |
| Backfill: enrollments com `next_step_due` daqui a 2h hoje | Baixa | Baixo | não mexer nos existentes; a regra nova vale a partir do próximo clique |
| Alterar a RPC `advance_enrollment_after_step` quebra o fluxo de execução | Baixa | Alto | só adicionar `snooze_count = 0` no UPDATE existente; testar em prod com `BEGIN … ROLLBACK` |
| Duplo clique em "Adiar" consome 2 adiamentos | Média | Baixo | botão desabilita durante o persist (já existe `persistInBackground`); servidor incrementa atômico (`snooze_count = snooze_count + 1` via RPC ou `UPDATE … RETURNING`) |

## Acceptance Criteria
1. **Adiar vai para amanhã.** Dado um passo pendente hoje às 15h, quando o SDR clica "Adiar p/ amanhã", então `next_step_due` = amanhã 09:00 BRT (segunda, se for sexta) e a tarefa some da fila de hoje.
2. **Limite de 2.** Dado um enrollment com `snooze_count = 2` no passo atual, quando o SDR clica "Adiar p/ amanhã", então o servidor responde `SNOOZE_LIMIT`, nada muda no banco e a UI mostra o diálogo com exatamente 3 saídas (Executar agora / Lead perdido / Trocar cadência).
3. **Reset ao avançar.** Dado `snooze_count = 2`, quando o passo é executado ou pulado e a cadência avança, então `snooze_count = 0` no novo passo.
4. **Motivo obrigatório no pulo de passo.** Quando o SDR clica "Pular este passo", então não é possível confirmar sem escolher um motivo, e a interaction gravada tem `metadata.skip_reason` preenchido.
5. **WhatsApp inválido reaproveita o fluxo.** Dado passo WhatsApp e motivo "Número ou e-mail inválido", quando confirma, então o lead recebe a marcação de WhatsApp inválido (mesmo efeito de `report-whatsapp-invalid`) e a cadência avança.
6. **Troca com motivo e lista restrita.** Dado um SDR (não manager) e uma cadência com `sdr_switch_allowed = false`, então ela não aparece no diálogo de troca e, se chamada direto, `switchLeadsCadence` recusa com `FORBIDDEN`. Manager vê e consegue mover. O evento `cadence_switched` tem `metadata.switch_reason`.
7. **Contador do gestor.** Dado que hoje o SDR X adiou 5, pulou 2, trocou 1 e marcou 3 perdidos, quando o gestor abre Atividades com filtro no SDR X, então o card Controle Diário mostra "Adiadas 5 · Puladas 2 · Trocadas 1 · Perdidos 3".
8. **Nomes distintos.** Não existe mais dois controles com o texto "Pular": o do sheet é "Adiar p/ amanhã", o do menu é "Pular este passo".
9. **Nada quebra no dia do deploy.** Todas as cadências continuam trocáveis (default `true`); enrollments existentes seguem com `snooze_count = 0`.
10. `pnpm typecheck`, `pnpm lint`, `pnpm test:run` verdes; testes novos para `skipActivity` (limite, reset, 9h), `skipStep` (motivo obrigatório), `switchLeadsCadence` (flag por role).

## Tasks
- [x] Migration A: `cadence_enrollments.snooze_count` + `cadences.sdr_switch_allowed` (Checkpoint 1 do `dev-checkpoints.md`: timestamp único 14 dígitos, `BEGIN/COMMIT`, `IF NOT EXISTS`)
- [x] Migration B: `CREATE OR REPLACE advance_enrollment_after_step` zerando `snooze_count` (é só acrescentar `snooze_count = 0` no `UPDATE cadence_enrollments SET current_step = v_next_order` da migration `20260615150000`)
- [x] `skipActivity`: amanhã 9h BRT + incremento atômico + `SNOOZE_LIMIT`
- [x] `ActivityExecutionSheet`: botão "Adiar p/ amanhã" com restante + diálogo do limite (3 saídas)
- [x] `skipStep`: `reason`/`note` obrigatórios + desvio para `report-whatsapp-invalid` quando aplicável
- [x] `ActivityRow` + `ActivityQueueView`: item "Pular este passo" abre `SkipStepReasonDialog`
- [x] `EnrollInCadenceDialog` (switch): motivo + filtro por `sdr_switch_allowed`
- [x] `switchLeadsCadence`: validação server-side por role + `switch_reason`
- [x] Editor de cadência: checkbox "SDR pode mover leads para esta cadência"
- [x] `fetchDailyProgress` + card Controle Diário: contadores + tooltip de motivos
- [x] Testes (AC 10)
- [x] Types do Supabase: `src/lib/supabase/types.ts` editado à mão (`snooze_count`, `sdr_switch_allowed`). `TYPES_STALE`: o arquivo gerado já não tinha `auto_loss_*` antes desta story — regenerar via MCP depois de aplicar as migrations em prod.
- [x] Aplicar as 2 migrations em prod (MCP Supabase) — ensaio `BEGIN … ROLLBACK` com 4 casos OK; aplicadas em 05/set 16:48 UTC como `20260905164819 skip_guardrails_columns` e `20260905164906 advance_enrollment_reset_snooze` (versões do MCP; os arquivos do repo são `150000`/`150100`, mesmo padrão da 9h BRT)
- [ ] Atualizar rascunho de e-mail p/ Matheus e Giovanni (fora de código — Vini)

## Dev Notes
- Hoje `skipActivity` calcula `max(2h, delay do passo)` e o piso de 2h existia para passos com delay 0 não voltarem na hora. Com "amanhã 9h" isso deixa de importar.
- ⭐ O trigger de `next_step_due` é `BEFORE INSERT OR UPDATE OF current_step, status` — UPDATE só em `next_step_due` NÃO recalcula. `skipActivity` continua setando a coluna direto, como já faz.
- `logLeadEvent` promove `metadata.cadence_id` / `step_id` para colunas; manter `cadence_id` no metadata para os contadores por cadência continuarem funcionando.
- `fetchDailyProgress` já faz o recorte "hoje BRT" (shift −3h); reusar a mesma janela para os contadores.
- Motivos são constante TypeScript (ex.: `src/features/activities/constants/skip-reasons.ts`), não tabela: são poucos, fixos e servem para agrupar. Motivos de PERDA continuam na tabela `loss_reasons`.
- Não confundir com `rescheduleCurrentStep` (callback com horário escolhido, story 7.6): esse continua sem limite, é retorno combinado com o lead.
- Precedente de "escolha obrigatória" já existe: `MarkLeadLostDialog` (motivo de perda). Seguir o mesmo padrão visual.

## Dev Agent Record
### Agent Model Used
claude-fable-5-1 (@dev / Dex) — modo interativo, branch `feat/activity-skip-guardrails` (base `origin/main` ef352b99)

### File List
**Migrations (novas)**
- `supabase/migrations/20260905150000_skip_guardrails_columns.sql` — `cadence_enrollments.snooze_count` + `cadences.sdr_switch_allowed`
- `supabase/migrations/20260905150100_advance_enrollment_reset_snooze.sql` — trigger `calculate_next_step_due` zera `snooze_count` quando `current_step` muda (cobre RPC, WhatsApp inválido, ligação externa, remap do editor) + RPC `advance_enrollment_after_step` com reset redundante

**Activities**
- `src/features/activities/constants/skip-reasons.ts` (novo) — motivos fixos, `SNOOZE_LIMIT`, `SNOOZE_LIMIT_CODE`, `snoozeButtonLabel`
- `src/features/activities/utils/daily-guardrails.ts` (novo) — `summarizeGuardrails`, `EMPTY_GUARDRAILS`
- `src/features/activities/actions/skip-activity.ts` — amanhã 9h BRT (`nextBusinessDayAt9hBRT`), optimistic lock em `snooze_count`, `SNOOZE_LIMIT` / `SNOOZE_CONFLICT`
- `src/features/activities/actions/skip-step.ts` — `reason` obrigatório + `note`; desvio p/ `reportWhatsAppInvalid` em WhatsApp + contato inválido
- `src/features/activities/actions/fetch-daily-progress.ts` — `guardrails` no `DailyProgress` (query de eventos `system` do dia)
- `src/features/activities/actions/fetch-pending-activities.ts`, `fetch-activity-log.ts` — `snooze_count` no select → `PendingActivity.snoozeCount`
- `src/features/activities/types/index.ts` — `PendingActivity.snoozeCount`
- `src/features/activities/components/SkipStepReasonDialog.tsx` (novo)
- `src/features/activities/components/SnoozeLimitDialog.tsx` (novo)
- `src/features/activities/components/ActivityExecutionSheet.tsx` — `handleSkip` com limite + diálogo; prop `onSwitchCadence`
- `src/features/activities/components/ActivityExecutionSheetContent.tsx` — `snoozesLeft` → `skipLabel` p/ os painéis
- `src/features/activities/components/{ActivityPhonePanel,ActivityWhatsAppCompose,ActivityEmailCompose,ActivityResearchPanel,ActivitySocialPointPanel}.tsx` — botão "Pular" → `skipLabel` ("Adiar p/ amanhã")
- `src/features/activities/components/ActivityRow.tsx` — item "Pular este passo"
- `src/features/activities/components/ActivityQueueView.tsx`, `ActivityLogView.tsx` — `SkipStepReasonDialog`; sheet recebe `onSwitchCadence`; card recebe `guardrails`
- `src/features/activities/components/ProgressCard.tsx` — linha "Adiadas · Puladas · Trocadas · Perdidos" + tooltip de motivos
- `src/app/(app)/atividades/page.tsx` — fallback com `EMPTY_GUARDRAILS`

**Cadences / Leads**
- `src/features/cadences/cadence.schemas.ts`, `types/index.ts` — `sdr_switch_allowed`; `CadenceEnrollmentRow.snooze_count`
- `src/features/cadences/actions/manage-cadences.ts` — `createCadence`/`updateCadence` só aceitam a flag de manager; `switchLeadsCadence(…, { reason, note })` + `FORBIDDEN` server-side
- `src/features/cadences/components/CadenceBuilder.tsx` — switch "Troca pelo SDR"
- `src/features/leads/actions/fetch-active-cadences.ts` — `{ forSwitch }` filtra pela flag p/ não-manager
- `src/features/leads/components/EnrollInCadenceDialog.tsx` — motivo obrigatório no modo switch; `onSuccess`
- `src/lib/supabase/types.ts` — colunas novas nos tipos gerados

**Testes**
- `src/features/activities/actions/skip-activity.test.ts` (reescrito), `skip-step.test.ts` (novo)
- `src/features/cadences/actions/manage-cadences.switch.test.ts` (novo)
- `src/features/activities/utils/daily-guardrails.test.ts` (novo)
- `src/features/activities/components/SkipStepReasonDialog.test.tsx`, `SnoozeLimitDialog.test.tsx`, `ProgressCard.test.tsx` (novos, QA TEST-001)
- Fixtures ajustadas: `ActivityExecutionSheetContent.test.tsx`, `ActivityLogView.test.tsx`, `ActivityQueueView.test.ts`, `CadenceBuilder.test.tsx`, `CadenceListView.test.tsx`

### Validation
- Após QA fixes: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test:run` ✅ 1870 passed (231 arquivos; +30 testes novos no total) · `pnpm build` ✅
- CodeRabbit (`coderabbit --prompt-only -t uncommitted`, CLI local em `/opt/homebrew/bin`): **não rodou** — "Authentication required. Please run 'coderabbit auth login' in an interactive session". Pendente para @qa ou rodar manualmente após o login.
- Verificação no browser: não feita — as migrations ainda não estão aplicadas em nenhum ambiente, e a fila passa a selecionar `snooze_count` (quebraria sem a coluna). Roteiro de teste manual na seção abaixo.

### Roteiro de teste manual (após migrations)
1. Fila → Executar um passo → botão "Adiar p/ amanhã (2 restantes)" → toast "Adiado para amanhã às 9h"; timeline do lead mostra "Adiada para amanhã 9h (1/2)".
2. Repetir no mesmo passo → "(1 restante)". Terceira vez → diálogo "Esse lead já foi adiado 2 vezes" com Executar agora / Trocar cadência / Lead perdido.
3. Menu da linha → "Pular este passo" → diálogo de motivo; sem motivo o botão fica desabilitado. Com "Número ou e-mail inválido" num passo WhatsApp → lead fica `whatsapp_invalid_at` e os WhatsApp seguintes somem.
4. Menu → "Trocar cadência" → precisa escolher motivo para liberar a lista. Como SDR, cadência com "Troca pelo SDR" desligada não aparece.
5. Cadência (editor, como gestor) → linha "Troca pelo SDR" → desligar → salvar → conferir item 4.
6. Card "Meu progresso hoje" → linha "Adiadas X · Puladas Y · Trocadas Z · Perdidos W"; hover mostra os motivos do dia. Gestor com filtro por SDR vê o do SDR.

### Decisões de implementação
- **Incremento atômico sem RPC nova:** `UPDATE … SET snooze_count = lido+1 WHERE id = ? AND snooze_count = lido` (optimistic lock). Corrida devolve `SNOOZE_CONFLICT`, sem consumir adiamento.
- **Helper das 9h reaproveitado:** `nextBusinessDayAt9hBRT` de `src/app/api/cron/meeting-outcome-check/route.ts` (mesmo que `lead-crm.ts` já usa). Não duplica a regra do trigger.
- **Retorno agendado** (`scheduled:`) fica fora do limite, como a story pede.
- **Sheet mantém contador local** (`localSnoozes`) só para o rótulo não voltar a "2 restantes" ao navegar; a fonte da verdade continua no servidor.
- **Flag da cadência:** SDR que edita cadência não consegue mudar `sdr_switch_allowed` (servidor descarta o campo para não-manager) — UI mostra o switch para todos, mas o save de SDR não aplica.
- **`summarizeGuardrails` foi para `utils/`** porque arquivo `'use server'` só pode exportar funções async.
- **(QA REL-001) Reset de `snooze_count` mora no trigger, não na RPC.** `calculate_next_step_due` já roda em `BEFORE UPDATE OF current_step`; `IF TG_OP = 'UPDATE' AND NEW.current_step IS DISTINCT FROM OLD.current_step THEN NEW.snooze_count := 0`. Qualquer caminho que mude o passo (RPC, `reportWhatsAppInvalid`, ligação externa, editor) zera sem precisar lembrar.
- **Dívida (MNT-001):** mover `nextBusinessDayAt9hBRT` de `src/app/api/cron/meeting-outcome-check/route.ts` para `src/shared/utils/`. Dois consumidores hoje (`lead-crm.ts`, `skip-activity.ts`).

### DoD (story-dod-checklist) — autoavaliação
- [x] Requisitos e AC 1–4, 6, 8, 9, 10 implementados e cobertos por teste unitário.
- [x] AC 5 (WhatsApp inválido) e AC 7 (contador) implementados; cobertos por teste unitário, **não** verificados no browser (migrations pendentes).
- [x] Padrões do projeto (feature module, `ActionResult`, `requireAuth`→Zod→Supabase), sem lint/erro novo, sem dependência nova, sem env nova.
- [x] Tasks marcadas; decisões documentadas acima; File List completo.
- [ ] Verificação manual no app — pendente até aplicar as migrations (roteiro acima).
- [ ] CodeRabbit — pendente (login interativo).
- [x] Build e lint passam.
- Dívida/follow-up: regenerar `types.ts` via MCP; retorno agendado continua sem limite (fora de escopo por decisão).

## QA Results

### Review Date: 2026-09-05

### Reviewed By: Quinn (Test Architect)

**Escopo revisado:** diff completo da branch `feat/activity-skip-guardrails` (32 modificados + 10 novos), 2 migrations, suíte (1864 verdes, +23 novos), build. CodeRabbit **não rodou** (CLI pede login interativo).

### 7 verificações

| # | Check | Resultado |
|---|-------|-----------|
| 1 | Code review | ⚠️ 3 achados medium (abaixo). Padrões do projeto respeitados (ActionResult, Zod, `from()`, feature module). Optimistic lock em `snooze_count` é boa solução sem RPC nova. |
| 2 | Unit tests | ✅ `skipActivity` (8), `skipStep` (8), `switchLeadsCadence` (5), `summarizeGuardrails`/`snoozeButtonLabel` (6). Sem teste de componente dos diálogos novos (TEST-001, low). |
| 3 | Acceptance criteria | ⚠️ AC 1, 2 (fila), 4, 6, 7, 8, 9, 10 OK. **AC 3 falha** nos caminhos que avançam o passo fora da RPC (REL-001) — inclusive o desvio do AC 5. **AC 2 falha na aba Registro** (REL-002). |
| 4 | No regressions | ✅ Fluxos de execução, ligação, WhatsApp inválido e retorno agendado intocados; `EnrollInCadenceDialog` em modo `enroll` (LeadTable, LeadDetail, CreateLead) sem mudança de comportamento; flag default `true`. |
| 5 | Performance | ✅ Query nova de guardrails filtra por `org_id + performed_by + created_at` (índices existentes), limit 2000/dia. |
| 6 | Security | ✅ Trava de `sdr_switch_allowed` é server-side por `role`; SDR não altera a flag (servidor descarta); `skipStep` valida enum + max. Low: `switchLeadsCadence` aceita reason/note livres (SEC-001). |
| 7 | Documentation | ✅ Story, handoff e comentários de código completos. Types do Supabase editados à mão (regenerar). |

### Achados

- **REL-001 (medium) — `snooze_count` não zera fora da RPC.** `reportWhatsAppInvalid`, `external-call.service.ts:161` e o remap do editor mudam `current_step` com UPDATE direto. Corrigir no trigger `calculate_next_step_due`: `IF TG_OP = 'UPDATE' AND NEW.current_step IS DISTINCT FROM OLD.current_step THEN NEW.snooze_count := 0`. Cobre tudo; migrations ainda não aplicadas, custo zero.
- **REL-002 (medium) — `ActivityLogView` não passa `onSwitchCadence` ao sheet.** "Trocar cadência" do diálogo de limite não faz nada na aba Registro. Uma linha.
- **REL-003 (medium) — `SkipStepReasonDialog` reabre com o motivo anterior marcado.** Reset só acontece em `handleOpenChange`, e os pais fecham por prop. Resetar em `handleConfirm` ou usar `key`.
- SEC-001, MNT-001, TEST-001, DOC-001 (low) — ver gate file.

### Gate Status

Gate: FAIL → docs/qa/gates/activity-skip-guardrails.yml

**Motivo:** AC 3 e AC 2 não valem em todos os caminhos. As três correções somam ~25 linhas; depois disso o veredito tende a PASS. Recomendação: `@dev *apply-qa-fixes` → re-review.

### Re-review (2ª rodada): 2026-09-05

### Reviewed By: Quinn (Test Architect)

Cada achado da 1ª rodada foi conferido no código, não no relato:

| ID | Status | Evidência |
|----|--------|-----------|
| REL-001 | ✅ resolvido | `20260905150100`: `IF TG_OP = 'UPDATE' AND NEW.current_step IS DISTINCT FROM OLD.current_step THEN NEW.snooze_count := 0` no trigger `calculate_next_step_due` (última definição da função no repo). Cobre RPC, `reportWhatsAppInvalid`, ligação externa e editor. `150000` cria a coluna antes. AC 3 vale em todos os caminhos. |
| REL-002 | ✅ resolvido | `ActivityLogView.tsx:424` passa `onSwitchCadence={handleSwitchCadence}`. AC 2 vale nas duas abas. |
| REL-003 | ✅ resolvido | `SkipStepReasonDialog.handleConfirm` reseta `reason`/`note`; teste RTL reabre e confirma desmarcado. |
| SEC-001 | ✅ resolvido | `switchOptionsSchema` (enum + max 140) antes do auth; teste de motivo inválido. |
| TEST-001 | ✅ resolvido | +7 testes; suíte 1870 verdes. |
| MNT-001 | ⏳ dívida | Documentada em Dev Notes. Não bloqueia. |
| DOC-001 | ⏳ pendente | CodeRabbit (login) e types (regenerar após migrations). |

typecheck ✅ · lint ✅ · 578 testes das features tocadas ✅ · build ✅ (rodado pelo @dev após os fixes).

### Gate Status

Gate: CONCERNS → docs/qa/gates/activity-skip-guardrails.yml

**Aprovado para seguir.** O que resta é ambiente, não código: aplicar as migrations em prod, rodar o roteiro manual (AC 5 e 7 ponta a ponta), CodeRabbit após login, regenerar types. Ordem obrigatória: migrations → teste manual → commit/PR.
