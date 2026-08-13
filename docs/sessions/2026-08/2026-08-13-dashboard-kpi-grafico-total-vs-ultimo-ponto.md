<!-- Sessão: gráfico dos cards KPI não batia com o número grande (reuniões marcadas/realizadas) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Projeto: Enriquece (Supabase dhkmonctyoaenejemkrt) — Coolify -->
<!-- Branch: fix/dashboard-kpi-chart-total-mismatch — commit 51305fb3 -->
<!-- PR #304: alinha série ao total (mergeado 17:59 BRT — squash; NO AR 7c4ef450) -->
<!-- PR #308: rótulo "esperado até ontem" (mergeado 18:34 — squash; NO AR 47c073ff, 15:41) -->

## Sintoma relatado

Nos cards do dashboard **Reuniões marcadas em Agosto** e **Reuniões realizadas
em Agosto**, o número grande divergia do último ponto do gráfico/tooltip:

- Marcadas: card **47**, gráfico parava em **43** (tooltip "Dia 12 → 43").
- Realizadas: card **37**, gráfico parava em **32** (tooltip "Dia 12 → 32").

## Diagnóstico

⭐ **Causa raiz: duplo corte com réguas de dias diferentes.** O número grande e a
série do gráfico saem da MESMA query, mas são agregados até dias diferentes:

- **Número grande** (`totalOpportunities` / `RankingCardData.total`) = conta o mês
  todo até **hoje** (janela `[start, end)`; como `won_at`/`meeting_scheduled_at`
  são fatos passados, na prática = acumulado até hoje).
- **Série do gráfico** era re-cortada no componente em `kpi.currentDay`, que é
  **ONTEM** no mês corrente (`currentDayOfMonthBrt` → `now.day - 1`). Esse "ontem"
  é a régua do **pacing** ("esperado até hoje" não penalizar o dia em andamento) —
  foi reaproveitada indevidamente para cortar a série, deixando o gráfico sempre
  **um dia atrás** do número grande.

Os services já preenchiam `dailyData` corretamente até hoje (`maxDay = hoje`); o
corte no componente só existia para transformar os **dias futuros** (que vinham
como `actual: 0`) em `null`, evitando a linha desabar até zero — mas usava o dia
errado (ontem em vez de hoje).

Como os dois cards são renderizados pelo mesmo componente `OpportunityKpiCard`,
o mesmo bug afetava ambos.

### Fontes (para referência futura)

- **Marcadas** → `ranking.meetingsScheduled` de
  `src/features/dashboard/services/ranking-metrics.service.ts`
  (`fetchMeetingsScheduledRanking`).
- **Realizadas** → `data.kpi` de
  `src/features/dashboard/services/dashboard-metrics.service.ts`
  (`fetchOpportunityKpi`). ⚠️ **NÃO** vem de `fetchMeetingsHeldRanking` (esse nem
  retorna `dailyData`).
- **Leads abertos** (mesmo componente) → `fetchLeadsOpenedDaily` no ranking-service.

## Correção aplicada (commit `51305fb3`, PR #304)

Dias que ainda não aconteceram passam a ser **`actual: null` na fonte**
(semanticamente correto: "dia ainda não aconteceu"), e o componente plota a série
**direto**, sem re-cortar por `currentDay`. O último ponto do gráfico vira
**hoje = número grande**. O pacing ("esperado até hoje" / % do ritmo) continua
usando `currentDay` (ontem), **inalterado**.

**4 arquivos, +11 / −7:**

1. `src/features/dashboard/types/index.ts` — `DailyDataPoint.actual: number | null`.
2. `src/features/dashboard/services/dashboard-metrics.service.ts:67` — dias futuros
   `: 0` → `: null` (realizadas).
3. `src/features/dashboard/services/ranking-metrics.service.ts` — mesmo ajuste em
   `fetchLeadsOpenedDaily` (~496) e `fetchMeetingsScheduledRanking` (~587), incluindo
   o tipo inline do array (`actual: number | null`).
4. `src/features/dashboard/components/OpportunityKpiCard.tsx` — `chartData` plota
   `point.actual` direto (removido `point.day <= kpi.currentDay ? … : null`) e
   `maxActual = Math.max(...map(d => d.actual ?? 0))`.

## Verificação

- `pnpm typecheck` ✅ (o `number | null` propaga sem quebrar componente legado,
  `demo-data.ts` nem demais consumidores).
- **141 testes do dashboard** ✅ (`vitest run src/features/dashboard`). Os testes
  usam meses fechados — todos os dias têm valor numérico — então `null` em dias
  futuros não os afeta.
- **Visual no `/demo`** ✅ — a rota reproduzia o cenário (`totalOpportunities: 47`,
  `currentDay: 20`, série com valores até o dia 30). Antes: a linha parava no dia 20
  (~39), com o terço final vazio. Depois: percorre o mês inteiro e fecha em **47**,
  alinhada com o número grande.

## Follow-up: rótulo "esperado até hoje" era enganoso (PR #308)

Ao estender a série até HOJE (fix acima), o tooltip do último ponto passou a mostrar
a **Meta do dia corrente** — marcadas **56**, realizadas **44** no dia 13 — enquanto
o card dizia *"esperado até **hoje**: 50 / 39"*. O usuário estranhou: "por que 56/44
no gráfico se o esperado é 50/39?".

**Não é erro de cálculo — são dias de referência diferentes.** O "esperado" do card é
paceado por `currentDay` = **ontem** (dia fechado, dia 12 = 8 dias úteis); a linha
"Meta" do gráfico sobe a cada dia útil e no dia 13 (9 dias úteis) já vale 56/44.
Cálculo por dia útil (ago/2026 = 21 dias úteis, sem feriado nacional):

| | Até ontem (d12, 8 d.ú.) | Até hoje (d13, 9 d.ú.) |
|---|---|---|
| Marcadas (130) | 49,52 → **50** | 55,71 → **56** |
| Realizadas (102) | 38,86 → **39** | 43,71 → **44** |

⚠️ **Assimetria de fundo (aceita, não corrigida):** o card compara o **realizado até
HOJE** (número grande 47/38) com o **esperado até ONTEM** (50/39) — réguas diferentes,
o que dá o "-5% / -2%". Hoje-vs-hoje seria bem mais duro (**-16% / -13%**).

**Decisão do usuário** (via AskUserQuestion): *"Manter até ONTEM + corrigir rótulo"* —
preservar os números/percentuais e só tornar o rótulo honesto.

**Correção (`ced33a74`, PR #308 — só texto, `OpportunityKpiCard.tsx`):**
- Mês corrente → **"esperado até ontem"**; mês fechado → **"esperado no mês"** (régua =
  mês inteiro). Via `isCurrentMonth = month === currentMonthBrt()`.
- Número grande, série verde, `%` do ritmo e linha de Meta **inalterados**.
- Verificado: `pnpm typecheck` ✅; render no `/demo` (mês fechado → "esperado no mês").

## Estado / próximos passos

- **PR #304 mergeado** (squash) 17:59 BRT — **NO AR** (`7c4ef450`, confirmado via
  `/api/version`).
- **PR #308 mergeado** (squash) 18:34 BRT — **NO AR** (`47c073ff`, publicado 15:41
  após ~6 min de build; `/api/version` == `origin/main`).
- Nenhuma migration; ambas as mudanças puramente frontend/serviço (sem schema).
- **Em aberto (opcional):** se o gestor quiser que card e gráfico comparem no MESMO dia
  (eliminar a assimetria realizado-hoje × esperado-ontem), seria mudar a régua do pacing
  para HOJE — decisão de produto que endurece o `%` e afeta todos os cards + ideal/SDR.

## ⭐ Lições

- **`currentDayOfMonthBrt` (= ontem) é régua de PACING, não de exibição de série.**
  O total de um card conta até hoje; a série do gráfico deve terminar em hoje para
  bater com ele. Separe as duas semânticas — não corte a série pelo dia do pacing.
- **Dia futuro numa série acumulada = `null`, não `0`.** `0` é ambíguo (confunde-se
  com "começo do mês sem eventos") e obriga o consumidor a adivinhar o corte; `null`
  é explícito e o recharts (`connectNulls={false}`) já não plota.
- **Um número e a série que o acompanha devem sair da MESMA janela de dias.** Sempre
  que os dois forem calculados em pontos diferentes do código, confira se a régua
  (intervalo de dias / timezone) é idêntica.
- **Rótulo tem que bater com a régua do cálculo.** "esperado até hoje" enquanto o valor
  é paceado por `currentDay` = ontem = mentira sutil que só apareceu quando a série do
  gráfico passou a ir até hoje. Ao mudar o corte de uma métrica, revise os textos que a
  descrevem. Fix escolhido = corrigir o rótulo, não os números.
