# Sessão 2026-08-11 — Tarefa de feedback da reunião na fila do SDR ao dar Ganho

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Nova feature pedida pelo Vinicius: quando o SDR marca um lead como **"Ganho"**, criar automaticamente uma **tarefa de ligação (API4COM)** na fila do SDR (aba **"Retornos"**) para ele **ligar ao próprio lead e coletar como foi a reunião com o closer**. Convive com o feedback automático do closer que já existia (são coisas distintas: um é o closer avaliando o lead; o outro é o SDR ouvindo o cliente). Planejado, implementado, testado e mergeado (#261).

## O que entrou na `main` (PRs)

| PR | Commit | Conteúdo |
|----|--------|----------|
| #261 | `c2a1a33` | Tarefa de ligação de feedback da reunião na fila do SDR ao dar Ganho |

## Contexto

Hoje, ao dar Ganho (`markLeadAsWon`, `src/features/leads/actions/lead-crm.ts`), o único feedback disparado é o **do closer** — link tokenizado que o closer responde num form público (ver handoff `2026-08-09-closer-feedback-qualificacao-aderencia.md`). Isso mede a qualidade pelo lado do closer, mas **nada levava o SDR a ligar ao cliente** e ouvir a percepção dele sobre a reunião. Esta feature preenche essa lacuna.

### Decisões (alinhadas com o usuário)
- **Gatilho:** cria no clique de "Ganho", mas **some se o lead reabrir** (closer marca no-show/remarcada → status volta a `qualified`).
- **Formato:** tarefa de **ligação via API4COM** na aba "Retornos", com o texto destacando que é o feedback da reunião.
- **Prazo:** vence no **próximo dia útil às 9h BRT**.

## Implementação (#261)

**`src/features/leads/actions/lead-crm.ts`** — em `markLeadAsWon`, logo **após** o bloco que cancela pendências (`scheduled_activities` pending → `cancelled`), chama o novo helper `scheduleWonFeedbackCall(orgId, leadId, sdrUserId)`:
- Cria `scheduled_activities` `channel='phone'` + **`call_provider=null`** → o painel de execução é sempre o `ActivityPhonePanel` (**API4COM**), não a ligação WhatsApp WebRTC.
- `scheduled_at = nextBusinessDayAt9hBRT(new Date())` (helper **importado** de `src/app/api/cron/meeting-outcome-check/route.ts` — a única cópia exportada; evita 4ª duplicação).
- `notes` = "Feedback da reunião: ligar para o lead e ouvir como foi a reunião com o closer {nome}" → vira o roteiro no painel de ligação e o subtítulo na linha da fila.
- Só na **transição real** `qualified→won` (guard `wasAlreadyWon`) + **guard anti-duplicata** (não empilha se já há retorno pending).
- Insert via **service role**: o dono (`user_id = assigned_to ?? userId`) pode ser um SDR ≠ de quem clicou Ganho (ex.: manager marcando pelo SDR), o que a RLS de INSERT barraria.
- Auditoria em `interactions` com `metadata.source='won_feedback_call'`.

**`src/app/api/feedback/route.ts`** — no branch `no_show`/`rescheduled` (reabre o lead), logo após o `update` de reabertura, cancela as `scheduled_activities` pending do lead. **Ordem importa:** precisa vir **antes** de `scheduleReopenFollowUp`, cujo guard pula a criação se já houver qualquer atividade pendente — sem esse cancel, o follow-up de reabertura seria silenciosamente ignorado. `meeting_done` **não** cancela (a reunião aconteceu → o SDR deve mesmo ligar).

Sem migration — `scheduled_activities` já tinha todas as colunas.

## Comportamento

| Evento | Resultado |
|--------|-----------|
| SDR marca **Ganho** (qualified→won) | Cria tarefa de ligação na aba "Retornos", vence próximo dia útil 9h |
| Closer marca **Realizada** (meeting_done) | Tarefa **permanece** (SDR liga ao lead) |
| Closer marca **no-show/remarcada** | Tarefa **some**; entra o follow-up de reabertura |
| Re-marcar Ganho em lead já `won` | Não duplica (guards `wasAlreadyWon` + anti-duplicata) |

## Verificação

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm build` ✅ (o build confirmou que importar o helper de um route handler não quebra o bundling).
- **240 testes** ✅ (inclui os 11 de `nextBusinessDayAt9hBRT`, agora consumido por outro módulo).
- CI da `main` (Lint·Typecheck·Test·Build) verde em 3m48s antes do merge.

## ⭐ Lições

- **Um "Retorno" de ligação API4COM** = `scheduled_activities` `channel='phone'` + `call_provider=null`. `call_provider='whatsapp'` seria a ligação WebRTC. A aba "Retornos" (`ActivityQueueView`) separa por `enrollmentId` prefixado com `scheduled:`; o `notes` vira o roteiro no `ActivityPhonePanel`.
- **`nextBusinessDayAt9hBRT` está triplicado** no repo (feedback route, meeting-outcome-check, lead-noshow) — só a cópia de `meeting-outcome-check/route.ts` é exportada. Candidato a extrair p/ um util compartilhado (`src/lib/utils/brt-date.ts`) numa próxima limpeza.
- **`scheduleReopenFollowUp` tem guard "não empilha se há pending"** — qualquer nova atividade criada no won-time precisa ser cancelada no reabrir, senão o follow-up de reabertura some sem aviso.

## Pendências / próximos passos possíveis

- **Sem teste unitário novo:** `markLeadAsWon` não tem harness de teste existente (seria criar do zero) e `scheduleWonFeedbackCall` não deve ser exportado por segurança. Cobrir criação + cancelamento com teste de integração ficou como follow-up opcional.
- Validar em produção com um lead + closer de teste (marcar Ganho dispara e-mail/WhatsApp reais ao closer): conferir a tarefa na aba "Retornos", o painel API4COM e o desaparecimento no no-show.
