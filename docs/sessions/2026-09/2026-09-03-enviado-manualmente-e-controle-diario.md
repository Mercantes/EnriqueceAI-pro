# 2026-09-03 — Botão "Enviado manualmente" (WhatsApp + e-mail) e fix do Controle Diário

## Contexto

WhatsApp está restringindo contatos novos, então os SDRs estão mandando as
mensagens pelo celular. O fluxo que usavam (nota + "Pular") não contava como
atividade realizada em nenhum painel: o "Pular" da tela de composição só adia
o passo em 2h (não grava interaction) e notas são filtradas pelos contadores.

## O que foi feito

### 1. Botão "Enviado manualmente"

Aparece nas telas **Compor WhatsApp** e **Compor Email** (preview e edição),
entre "Pular" e "Enviar". Reaproveita o fluxo do "Marcar como feita" que já
existia para LinkedIn/Pesquisa.

Comportamento:
- Grava `interactions` com `channel` do passo, `type='sent'`,
  `message_content` = mensagem do preview e `metadata.manual_send = true`.
- Avança a cadência via `advance_enrollment_after_step` (mesmo caminho do envio
  normal, idempotente).
- **Não** dispara pela Meta/Evolution/Gmail e **não** debita crédito WhatsApp.
- Não exige telefone/e-mail preenchido (o SDR pode ter mandado para outro
  número); exige só que haja mensagem.
- Conta no Progresso diário, Dashboard ("Atividades Realizadas") e
  Estatísticas, igual a um envio normal.
- Funciona também para atividades agendadas (`executeScheduledActivity`).

`metadata.manual_send` permite, no futuro, separar "WhatsApp (manual)" de
"WhatsApp (automático)" em relatórios sem nova migração.

### 2. Divergência do Controle Diário (Estatísticas)

`performance-analytics.service.ts` buscava todas as interactions do período,
incluindo `channel='system'` (auditoria de "Pular esta atividade", "Encerrar
cadência" e avanço automático, gravadas como `type='sent'`). Resultado: o
Controle Diário contava skip como atividade concluída, enquanto Dashboard e
Progresso diário não. Fix: `.neq('channel', 'system')` na query. `calendar`
fica, porque `completed` conta `meeting_scheduled` de propósito.

## Arquivos

- `src/features/activities/types/index.ts` — `manualSend?: boolean` em `ExecuteActivityInput`
- `src/features/activities/actions/execute-activity.ts` — pula envio/crédito quando `manualSend`; `metadata.manual_send`
- `src/features/activities/actions/execute-scheduled-activity.ts` — idem
- `src/features/activities/components/ActivityExecutionSheet.tsx` — `handleManualSend`
- `src/features/activities/components/ActivityExecutionSheetContent.tsx` — prop `onManualSend` repassada
- `src/features/activities/components/ActivityWhatsAppCompose.tsx` — botão
- `src/features/activities/components/ActivityEmailCompose.tsx` — botão nas duas barras (limpa rascunho)
- `src/features/statistics/services/performance-analytics.service.ts` — `.neq('channel','system')`
- Testes: `execute-activity.test.ts` (+3), `ActivityExecutionSheetContent.test.tsx` (+3)

## Verificação

- `pnpm typecheck` ✅
- `eslint` nos arquivos alterados ✅
- `vitest run src/features/activities src/features/statistics` → 23 arquivos, 158 testes ✅
- Visual no browser: **não feito** (tela exige login + fila com atividade de WhatsApp pendente).

## Como testar em produção

1. Abrir uma atividade de WhatsApp na fila → botão "Enviado manualmente" ao lado de "Enviar WhatsApp".
2. Clicar → toast "WhatsApp registrado como enviado", fila avança.
3. Timeline do lead mostra a mensagem como enviada; card "Progresso diário" soma +1.
4. Estatísticas → Controle Diário: "Pular esta atividade" (menu da linha) não deve mais somar em Concluídas.

## Status

- PR [#351](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/351) mergeado (squash `638d5340`) e **no ar** em 03/set ~18:03 UTC (`/api/version` confirmado).

## 3. Selo "Manual" na timeline (follow-up, mesma sessão)

Interações com `metadata.manual_send = true` mostram um badge "Manual" ao lado
do título, nas duas timelines:
- `src/features/cadences/components/LeadTimeline.tsx` (página `/leads/[id]`)
- `src/features/leads/components/LeadTimelineTab.tsx` (aba do painel do lead e
  contexto do lead na execução de atividades)

Teste: `LeadTimeline.test.tsx` (+2). Typecheck/lint/vitest ✅.

## Pendente
- Commit/PR do selo "Manual" (aguarda pedido).
