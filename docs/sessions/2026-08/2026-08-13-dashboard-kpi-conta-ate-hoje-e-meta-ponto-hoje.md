# Handoff — Dashboard KPI: cards voltam a contar até HOJE + meta do ponto de hoje alinhada ao card

**Data:** 2026-08-13
**Contexto:** continuação de `2026-08-13-dashboard-kpi-grafico-total-vs-ultimo-ponto.md` (#304/#308/#310)
**PRs desta sessão:** #313 (contagem até hoje) e #315 (meta do ponto de hoje). Ambos mergeados e no ar.

---

## Problema relatado

O usuário comparou os cards **Reuniões marcadas** e **Reuniões realizadas** do dashboard do
Enriquece com o **Sales Hub** (referência da operação, PDF anexado) e viu que **não batia**:

- **Sales Hub** (conta até HOJE): marcadas **51**, realizadas **39**; "esperado até **hoje** 50/39"; +3%/0%.
- **Enriquece** (print do usuário): número **51/39**, mas o gráfico terminava um dia atrás — tooltip
  do último ponto em **43/32** (dia fechado, ontem).

Causa: o **#310** (aprovado de manhã) recuou a janela de contagem para "ontem", divergindo do
Sales Hub. O print do usuário era o estado pré-#310 (número até hoje × série até ontem) — browser
com bundle antigo em cache (deployment skew do Coolify).

## Diagnóstico (confirmado por SQL na prod, org V4 Amaral, ago/2026)

| Métrica | até ontem (12) | até hoje (13) |
|---|---|---|
| Marcadas | 43 | **51** |
| Realizadas | 32 | **39** |

Decisão do usuário (AskUserQuestion): **contar até HOJE, alinhado ao Sales Hub** (reverte o #310).

## Correção 1 — #313: contagem até HOJE (régua dupla)

Régua **dupla**, idêntica ao Sales Hub (assimetria intencional):

| | Régua | Resultado |
|---|---|---|
| Número grande + série do gráfico | até **hoje** | 51 / 39 |
| "esperado" / % ritmo / ideal-dia | dia fechado (**ontem**) | esperado 50/39; +3%/0% |

- `getMonthRange.end` → volta ao **fim do mês** nos 2 services (`dashboard-metrics.service.ts`,
  `ranking-metrics.service.ts`). Como `won_at`/`meeting_scheduled_at` nunca são futuros, "mês
  inteiro" == "até hoje".
- `maxDay` das 3 séries → volta a `nowBrt.getUTCDate()` (hoje) → último ponto = número grande.
- `currentDayOfMonthBrt` (=ontem) mantido **só** no pacing.
- Rótulo do card → **"esperado até hoje"** (texto igual ao Sales Hub), em `OpportunityKpiCard.tsx`.
- Comentários fortes nos `getMonthRange` avisam **NÃO recuar para ontem**.
- Teste do #310 reescrito: lead ganho **hoje** aparece no número grande E no último ponto da série.

## Correção 2 — #315: meta do gráfico no ponto de HOJE = "esperado até hoje" do card

Follow-up: o tooltip do dia corrente mostrava a **Meta do dia cheio** (marcadas **56**, realizadas
**44**), divergindo do card ("esperado até hoje" 50/39). A linha de Meta usava `expected(dia
corrente)`; o card usa `currentDay` (ontem).

- Nova helper **`seriesTargetForDay`** (`utils/pacing.ts`): o ponto do **dia em andamento (hoje)**
  usa a meta do último dia **FECHADO (ontem)** — mesma régua do card. Dias passados e futuros
  seguem a projeção normal (a linha ainda chega ao total no fim do mês). Cria um platô de 1 dia
  (ontem = hoje) na linha de Meta, o que é o comportamento correto ("o dia em andamento usa a
  meta de ontem").
- Aplicada nas **3 séries**: realizadas (`computeDailyData`), marcadas
  (`fetchMeetingsScheduledRanking`), leads abertos (`fetchLeadsOpenedDaily`).
- Teste: `dailyData[hoje].target == dailyData[ontem].target == expected(ontem)`; dia futuro segue
  a projeção do próprio dia.

Resultado: no ponto de hoje, **card e tooltip mostram a mesma meta** (50 marcadas, 39 realizadas).

## Deploy

- #313 → main `2091a5de` → Coolify → `/api/version` = `2091a5d` (confirmado).
- #315 → main `3ef3b9bf` → Coolify → `/api/version` = `3ef3b9b` (confirmado).
- **Deployment skew:** o browser do usuário serviu bundle antigo entre os deploys — sempre pedir
  **hard refresh** (`Cmd+Shift+R`) para validar.

## Validação

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · **143 testes** ✅ (em ambos os PRs).
- Totais confirmados por SQL real (não pelo `/demo`, que mocka e não passa pelos services).

## ⚠️ Sessões concorrentes (importante)

Durante esta sessão, **outra sessão do usuário trabalhava no MESMO repositório em paralelo** e
trocou a branch do working directory várias vezes (para `fix/insights-conta-ate-hoje`,
`fix/phones-string-contact-format`). Ela abriu/mergeou o **#314** (Insights contam até ontem) e o
**#316** (reverte: Insights voltam a contar até hoje). Meu trabalho ficou isolado nas branches de
PR (#313, #315) e não conflitou (arquivos disjuntos: meus = `dashboard-metrics`/`ranking-metrics`/
`pacing`; Insights = `insights-metrics`). **Lição: rodar duas sessões no mesmo working directory
é arriscado — elas disputam o checkout.** Operar merges via `gh` (remoto) evita colisão local.

## Lições

- **Contagem e pacing podem ser réguas DIFERENTES de propósito.** O Sales Hub conta o realizado
  até **hoje** mas paceia a meta até o dia fechado (**ontem**). A assimetria nº-hoje × meta-ontem
  é INTENCIONAL — antes de "consertar" divergência de dia, cheque contra o Sales Hub.
- A **linha de Meta** do gráfico é uma projeção do mês; mas o **ponto do dia corrente** deve usar
  a régua do card (dia fechado), senão card × tooltip divergem (56 vs 50).
- Coolify serve bundle antigo em cache entre deploys → validar sempre com hard refresh + `/api/version`.
