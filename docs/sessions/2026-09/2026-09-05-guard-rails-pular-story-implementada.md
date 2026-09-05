# 2026-09-05 — Guard-rails do "Pular" na fila: story criada, validada e implementada

## Pergunta do Vini
Print do menu `Executar ▾` da fila (Pular esta atividade / Trocar cadência / Visualizar / Lead ganho / Lead perdido): "está correto? Estamos dando muita liberdade para o SDR não executar a tarefa?"

## Diagnóstico
- Havia **dois "Pular" com efeitos diferentes**: o botão dentro da execução (`skipActivity`) adiava a MESMA tarefa em 2h; o item do menu (`skipStep`) pulava o PASSO inteiro (cadência avança). Nenhum pedia motivo, nenhum tinha limite, nenhum aparecia para o gestor.
- "Trocar cadência" listava todas as cadências e não pedia motivo.
- Em 05/set, 59/102 vencidas do Matheus e 46/103 do Giovanni tinham "Pular" como último evento (ver handoff `2026-09-05-atrasadas-vencimento-9h.md`).

## Opções apresentadas → Vini escolheu a **2** (atrito + visibilidade + limite)
1. Só atrito e visibilidade (motivo de 1 clique, adiar → amanhã 9h, contador do gestor).
2. **Opção 1 + limite:** 2 adiamentos por passo; no 3º, saída obrigatória (executar / perdido / trocar). Trocar cadência restrita a lista do gestor.
3. Opção 2 + tirar "Pular passo" do SDR.

## Story
`docs/stories/activity-skip-guardrails.story.md` — criada, validada pelo @po (GO 9/10, Draft → Ready), implementada pelo @dev → **Ready for Review**.

## O que foi implementado (branch `feat/activity-skip-guardrails`, base `origin/main` ef352b99, NADA commitado)
- **Adiar p/ amanhã** (botão do sheet): `next_step_due` = 09:00 BRT do próximo dia útil (`nextBusinessDayAt9hBRT`), coluna nova `cadence_enrollments.snooze_count` com optimistic lock, limite 2/passo (`SNOOZE_LIMIT`), no 3º o servidor recusa (`code: SNOOZE_LIMIT`) e a UI abre `SnoozeLimitDialog` (Executar agora / Trocar cadência / Lead perdido). Botão mostra "(1 restante)".
- **Pular este passo** (menu): `SkipStepReasonDialog` com 4 motivos fixos (`constants/skip-reasons.ts`); `skipStep` exige `reason`; "contato inválido" em passo WhatsApp desvia para `reportWhatsAppInvalid`.
- **Trocar cadência**: motivo obrigatório no diálogo; coluna nova `cadences.sdr_switch_allowed` (default true); `fetchActiveCadences({ forSwitch })` filtra para SDR; `switchLeadsCadence` recusa `FORBIDDEN` server-side; switch "Troca pelo SDR" no `CadenceBuilder` (só manager consegue salvar a flag).
- **Gestor**: card "Meu progresso hoje" ganhou linha "Adiadas · Puladas · Trocadas · Perdidos" (hoje, por SDR do filtro) com tooltip dos motivos (`utils/daily-guardrails.ts`).
- **RPC** `advance_enrollment_after_step` recriada zerando `snooze_count` ao avançar.

## Validação
`pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test:run` ✅ 1864 (+23 novos) · `pnpm build` ✅. CodeRabbit não rodou (CLI pede `coderabbit auth login` interativo). Sem teste no browser: migrations ainda não aplicadas em lugar nenhum.

## ✅ Migrations aplicadas em prod (05/set 16:48 UTC)
Ensaio `BEGIN … ROLLBACK` num enrollment ativo: adiar mantém `snooze_count`; `status` igual mantém; `current_step` muda → zera. Aplicadas como `20260905164819 skip_guardrails_columns` e `20260905164906 advance_enrollment_reset_snooze` (versões atribuídas pelo MCP; arquivos do repo são `150000`/`150100`). Pós-check: colunas presentes, 1160 ativos com contador 0, 0 cadências bloqueadas, trigger e RPC com o reset. A função de prod antes era idêntica à versão 9h BRT do repo.

## Commit + PR (05/set, autorizado pelo Vini)
- Outra sessão tinha deixado o checkout na `main` de novo; a branch `feat/activity-skip-guardrails` foi reapontada para a `main` atual (`cbcc4b36`, só #363 de docs) antes de commitar — nada da story tocou a `main`.
- Commit `ebc3d3e4` (46 arquivos; WIP alheio `create-checkout.ts`/`next-env.d.ts` e handoffs de agosto ficaram de fora).
- PR [#364](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/364) aberto para `main`. CI da `main` verde em `cbcc4b36`.

## Restante
1. ~~Migrations~~ ✅ · ~~Commit/PR~~ ✅
2. Merge do #364 quando o CI passar (Vini). Deploy automático no Coolify; confirmar via `/api/version`.
3. Regenerar `src/lib/supabase/types.ts` via MCP (foi editado à mão).
4. Avisar Matheus e Giovanni; reescrever o item 1 do rascunho "melhorias da semana" (a dica "Pular adia 2h" fica desatualizada).

## Incidente de sessão paralela
Durante a implementação, outra sessão do Claude trocou a branch do repositório para `docs/handoff-05set-email-time-sdr` e commitou `11a08d51` (só o handoff dela). As alterações desta story ficaram no working tree e foram carregadas de volta para `feat/activity-skip-guardrails` no fim. Nada da story entrou no commit da outra sessão. ⭐ Duas sessões no mesmo checkout trocando de branch é risco; usar worktree para a próxima story paralela.

## QA gate (1ª rodada): FAIL → fixes aplicados
Quinn achou 3 medium: `snooze_count` não zerava fora da RPC (WhatsApp inválido, ligação externa, editor); aba Registro sem `onSwitchCadence` no sheet; diálogo de motivo reabria com o motivo anterior marcado. Mais 4 low (validação do motivo da troca, helper importado de rota, sem teste de componente, CodeRabbit/types).
Dex aplicou: reset no **trigger** `calculate_next_step_due` (migration `20260905150100` reescrita), prop no LogView, reset no confirm, zod no `switchLeadsCadence`, +7 testes. Suíte 1870 ✅, build ✅. Gate file: `docs/qa/gates/activity-skip-guardrails.yml`.

## QA gate (2ª rodada): CONCERNS — aprovado
Todos os medium resolvidos e verificados no código. Restam só itens de ambiente (low): migrations em prod, teste manual, CodeRabbit após login, regenerar types, dívida MNT-001.

## Próximos passos
- CodeRabbit ainda depende de `coderabbit auth login`.
- Vini: aplicar migrations (item 1 acima — a `150100` agora mexe no trigger E na RPC) e decidir quando commitar.
