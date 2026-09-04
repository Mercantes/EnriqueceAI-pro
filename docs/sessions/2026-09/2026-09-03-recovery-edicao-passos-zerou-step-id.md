# 2026-09-03 — Edição da cadência Recovery inflou a fila de atrasadas dos SDRs

## Sintoma
Giovanni (e os demais SDRs de outbound) viram "uma porrada" de tarefas atrasadas, algumas com data de 2 dias atrás ou mais, a partir das ~14:30 BRT.

## Causa-raiz
- 14:24 BRT: Vinicius editou os passos da **Recovery** pelo editor de timeline (pausou → salvou → reativou).
- `saveTimelineSteps` (`src/features/cadences/actions/save-timeline-steps.ts`) faz **DELETE de todos os `cadence_steps` + INSERT** (IDs novos).
- FK `interactions.step_id → cadence_steps ON DELETE SET NULL` zerou o `step_id` de ~2.000 interações históricas da Recovery. A supressão "passo já executado" (`get_executed_steps` na fila; `NOT EXISTS` nas RPCs `list_overdue_*_brt`) depende desse vínculo → tarefas já feitas voltaram.
- `current_step` é posicional. Estrutura antiga: 8 passos em pares Ligação/WhatsApp (delays 0,0,1,1,2,2,3,3). Nova: 11 passos com e-mails (1 phone, 2 WA, 3 e-mail, 4 phone 1d, 5 WA 1d, 6 e-mail 1d, 7 phone 3d, 8 e-mail 3d, 9 phone 6d, 10 e-mail 6d, 11 WA 6d). Passo 4 era WhatsApp (oculto em lead com `whatsapp_invalid_at`) e virou Ligação → 49 ligações "vencidas desde 24–31/ago" pra Giovanni e Guilherme. Passos de e-mail manuais surgiram do nada.

| SDR | Resumo 08:00 | Fila 15:00 (antes do fix) | Já feitas antes da edição |
|---|---|---|---|
| Giovanni | 1 | 64 | 49 |
| Guilherme | 28 | 85 | 49 |
| João Fogaça | 67 | 101 | 31 |
| Matheus | 0 | 66 | 66 |
| Ismael | 28 | 37 | 0 (não usa Recovery) |

Rastro de quem editou: `query_logs` (edge_logs, `request.sb.auth_user`). `audit_log` não registra cadências.

## Remediação (opção 1) — piloto Giovanni ✅
DO-block idempotente via MCP (ver memória `cadence-step-edit-nulls-interactions-step-id`):
1. Remap posicional do `current_step` (1→1, 2→2, 3→4, 4→5, 5→7, 6→11, 7→9, 8→12) só p/ inscrições pré-edição sem execução na estrutura nova.
2. Religa interações antigas aos passos novos (ronda = dia distinto por canal, limitada ao cs antigo; 1 por lead/passo — índice único `uq_interactions_sent_step_lead`).
3. E-mails 3 e 6 marcados como "não aplicados" via interação `system` com `step_id`, **retrodatada** (auto-loss usa `max(created_at)`).
4. Trigger `set_next_step_due` recalcula o vencimento → restaurado o original em 2º UPDATE.

Resultado: 145 enrollments, 128 remapeados, 203 interações religadas, 160 e-mails suprimidos; atrasadas do Giovanni **64 → 0** (fila 0h e painel 4h); vencimentos 100% preservados. 5 leads já executados na estrutura nova estavam travados em cs=6 (e-mail suprimido) → avançados p/ 7.

Backups: `_bkp_recovery_relink_enr_20260903`, `_bkp_recovery_relink_ix_20260903`.

## Rollout ✅ (após validação do Giovanni pelo Vini)
Mesmo DO-block com `v_sdrs` array (Guilherme, João Fogaça, Matheus) + destrava automático de leads já na estrutura nova parados em e-mail suprimido (cs 3/6 → +1).

| SDR | Enrollments | Remapeados | Religadas | E-mails suprimidos | Atrasadas fila antes → depois |
|---|---|---|---|---|---|
| Giovanni | 145 | 139 | 203 | 160 | 64 → 0 |
| Guilherme | 95 | 95 | 164 | 164 | 85 → 28 (= resumo 08:00) |
| João Fogaça | 121 | 95 | 355 | 108 | 101 → 50 (08:00 dizia 67; trabalhou de manhã) |
| Matheus | 266 | 236 | 457 | 364 | 66 → 41 WA vencidos <4h (painel 4h: 0) |

## Hardening do editor ✅ NO AR — PR [#353](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/353) (squash `87d9d7ad`, CI verde, deploy confirmado via `/api/version` às 16:29 BRT)
- `save-timeline-steps.ts`: recebe `id` por passo; passo existente é **atualizado no lugar (upsert por id)**, só os removidos são apagados; renumeração passa por ordem temporária (+10000) por causa do UNIQUE `(cadence_id, step_order)`. Mudança **estrutural** (inserir/remover/reordenar) com inscrições `active/paused` devolve `code = ACTIVE_ENROLLMENTS` sem gravar; só grava com `confirmActiveEnrollments: true`. Mudança só de conteúdo/delay passa direto.
- `save-auto-email-steps.ts`: mesma ideia por posição (o motor usa `interactions.step_id` como trava de idempotência — recriar IDs podia **reenviar e-mails**). Guarda quando muda o número de passos; `confirm_active_enrollments` no schema.
- UI: `ActiveEnrollmentsConfirmDialog` (novo) + aviso `Alert` no `CadenceBuilder` e `AutoEmailBuilder` quando a cadência tem inscrições; `daysToStepInputs` passa `id`. Constante `ACTIVE_ENROLLMENTS_CODE` em `types/index.ts` (arquivo `'use server'` não pode exportar const).
- Testes: `save-timeline-steps.test.ts` reescrito (8 casos: preserva IDs, guarda, confirmação, fase temporária). `pnpm typecheck`, `eslint src/features/cadences`, `vitest run` verdes.
- Não verificado no browser (precisa de login; ação de salvar grava em produção).

## Pendente
- Achado colateral: 118/145 leads do Giovanni na Recovery têm WhatsApp inválido e param em passo de WA (oculto, não pulado) → invisíveis até o auto-loss 14d. Motor deveria pular o passo.
- Cadência **Reativação** ficou pausada às 14:24 (mesma sessão de edição).
