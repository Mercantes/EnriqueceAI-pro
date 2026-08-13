<!-- Sessão: gráfico dos cards KPI não batia com o número grande (reuniões marcadas/realizadas) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Projeto: Enriquece (Supabase dhkmonctyoaenejemkrt) — Coolify -->
<!-- Branch: fix/dashboard-kpi-chart-total-mismatch — commit 51305fb3 -->
<!-- PR #304: alinha série ao total (mergeado 17:59 BRT — squash; NO AR 7c4ef450) -->
<!-- PR #308: rótulo "esperado até ontem" (mergeado 18:34 — squash; NO AR 47c073ff, 15:41) -->
<!-- PR #310: DECISÃO FINAL — TODO o dashboard conta até ONTEM (mergeado 20:45 — squash; NO AR 50b50cce, 17:48) -->

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

## Resolução final: TODO o dashboard conta até ONTEM (PR #310)

O usuário reparou que o gráfico ainda mostrava **56/44** (Meta do dia corrente) — o #308
só arrumou o rótulo, não o gráfico. Ao confrontar as opções, ficou claro que **não dá para
ter "47 no número" e "50 na meta" no mesmo ponto** do gráfico: no dia em que se chegou a 47
(hoje), a meta é 56; para a meta ser 50, o ponto tem que ser ontem — e ontem eram 43 marcadas.

**Decisão do usuário** (AskUserQuestion, ciente de que reverte o "47→43" e que reunião de
hoje só aparece amanhã): **contar TUDO até o último dia fechado (ontem)** — número grande,
série, `%`, ranking por SDR e cards de taxa. Efeito em produção (hoje d13 → conta até d12):
marcadas 47→**43**, realizadas 38→**32**; some o 56/44 do tooltip; card e gráfico param no
mesmo dia.

**Correção (`81294d21`, PR #310 — só backend):**
- **`getMonthRange`** (`ranking-metrics.service.ts` + `dashboard-metrics.service.ts`): no mês
  corrente o `end` recua p/ **fim de ONTEM** (`currentDayOfMonthBrt`); mês passado = mês inteiro;
  dia 1 → janela vazia. Propaga sozinho p/ `total`, `percentOfTarget`, `averagePerSdr`,
  `sdrBreakdown` e os cards de taxa (derivados).
- **`maxDay`** das séries (3 pontos) alinhado ao mesmo dia fechado.
- **Frontend revertido** ao estado #304+#308 — o backend é a fonte única; sem lógica duplicada.
- **Não muda:** snapshots "Leads a abrir" / "Atividades atrasadas" (estado *agora*, sem janela).
- **Fora do escopo:** gráficos de Insights ("Conversão por Origem", "Motivos de Perda",
  `insights-metrics.service.ts`) ainda contam o mês inteiro.
- Verificado: `pnpm typecheck` ✅, **142 testes** ✅ (inclui teste determinístico com data
  mockada: janela termina em `2026-08-12T23:59:59-03:00`, `currentDay=12`, série `null` do d13).
  ⚠️ `/demo` NÃO valida (dados mockados não passam pelos services) → validar por unitário.

## Estado / próximos passos

- **PR #304** (série=`null` na fonte) — NO AR `7c4ef450`.
- **PR #308** (rótulo "esperado até ontem") — NO AR `47c073ff`.
- **PR #310** (TODO conta até ontem) — mergeado 20:45 BRT, **NO AR** `50b50cce` (publicado 17:48).
- Nenhuma migration; tudo frontend/serviço (sem schema).
- **Em aberto (opcional):** alinhar os gráficos de Insights à mesma régua (edição trivial em
  `insights-metrics.service.ts`, mesmo `getMonthRange`).

## ⚠️ ATUALIZAÇÃO (fim do dia 13/ago): #310 foi REVERTIDO — dashboard conta até HOJE

A "resolução final #310" acima (contar até ONTEM) **não vingou**. Comparando com o **Sales Hub**
(referência da operação), o time viu que o SH conta o **realizado até HOJE** (marcadas 51, realizadas
39) e paceia a **meta até o dia fechado** (ontem, 50/39) — uma **régua dupla intencional**. O #310
unificou tudo em "ontem" (43/32) e desalinhou do SH.

Desfecho real (tudo NO AR):
- **#313** (`2091a5de`) — reverte o #310: contagem (nº grande + série) volta a **HOJE**
  (`getMonthRange.end` = fim do mês; `maxDay` = hoje); pacing segue em ontem (`currentDayOfMonthBrt`).
  Handoff dedicado: `docs/sessions/2026-08/2026-08-13-dashboard-kpi-conta-ate-hoje-e-meta-ponto-hoje.md`.
- **#315** (`3ef3b9bf`) — a Meta do gráfico no ponto de HOJE usa a régua do dia fechado (helper
  `seriesTargetForDay`), então o tooltip do dia corrente mostra 50/39 = card (antes 56/44).
- **#314 → #316** (`85d79892`, esta sessão) — aliei os gráficos de **Insights** à régua ONTEM (#314)
  por premissa desatualizada; como os cards já estavam em HOJE (#313), isso os desalinhou.
  **#316 corrigiu** — Insights voltam a contar até HOJE. Agora cards + ranking + Insights usam a
  mesma régua de contagem.

⭐ **Régua vigente do dashboard = CONTAGEM até HOJE, PACING até ONTEM** (espelha o Sales Hub). As
lições abaixo escritas na fase #310 ("contar tudo até ontem") ficam como registro histórico — a
decisão final foi a régua dupla, não a régua única de ontem.

## ⭐ Lições

- **A régua de dia de um dashboard é decisão de PRODUTO, não de código.** O ponto de controle
  certo é a **janela de contagem** (`getMonthRange.end`), não recortes espalhados no componente:
  mude lá e `total`/`%`/`sdrBreakdown`/séries/cards-de-taxa se alinham sozinhos. Backend = fonte
  única — não duplicar a régua no front (foi o que o #310 desfez do paliativo).
- **`currentDayOfMonthBrt` (= ontem, último dia CONCLUÍDO) é a régua do PACING** ("esperado"/%/
  ideal-dia). ⚠️ **Correção pós-#313:** a CONTAGEM (nº grande + série) NÃO usa ontem — usa HOJE,
  espelhando o Sales Hub (régua dupla intencional). O #310 tentou unificar em ontem e desalinhou.
- **Dia futuro/em-andamento numa série acumulada = `null`, não `0`** (`0` é ambíguo com começo de
  mês sem eventos; recharts `connectNulls={false}` já não plota null).
- **Contar até "ontem" esconde o dia corrente do card até fechar** — comunicar o trade-off (uma
  reunião marcada hoje só aparece amanhã) ANTES de aplicar.
- **`/demo` usa dados mockados que não passam pelos services** — mudanças de backend de métrica
  se validam por teste unitário (com data mockada), não pela rota de demonstração.
- **Rótulo tem que bater com a régua do cálculo.** "esperado até hoje" enquanto o valor
  é paceado por `currentDay` = ontem = mentira sutil que só apareceu quando a série do
  gráfico passou a ir até hoje. Ao mudar o corte de uma métrica, revise os textos que a
  descrevem. Fix escolhido = corrigir o rótulo, não os números.
