# 2026-09-03 — Dashboard: gráfico "RM e RR por dia"

## Pedido
Gráfico de barras diário com Reuniões Marcadas (RM) e Realizadas (RR) no
Dashboard, no estilo do Sales Hub (barras lado a lado + tendência tracejada).

## Decisões (com o usuário)
- **Posição:** logo abaixo dos 3 cards KPI, antes dos rankings.
- **Dia da RR:** dia em que virou Ganho (`won_at`) — igual ao card e ao Sales Hub.
- **Tendência:** sim, regressão linear por série sobre os dias já ocorridos.

## Como foi feito (zero query nova)
As séries acumuladas que os cards "Reuniões marcadas"
(`ranking.meetingsScheduled.dailyData`) e "Reuniões realizadas"
(`data.kpi.dailyData`) já recebem são diferenciadas dia a dia em
`src/features/dashboard/utils/meetings-by-day.ts`. Assim a soma das barras
bate com o número grande dos cards, com o mesmo filtro e a mesma régua BRT.

Cores validadas (claro e escuro) com o validador do skill dataviz:
RM `#6366f1` (indigo), RR `#16a34a` (verde-600).

## Arquivos
- `src/features/dashboard/utils/meetings-by-day.ts` (+ `.test.ts`)
- `src/features/dashboard/components/MeetingsByDayChart.tsx` (+ `.test.tsx`)
- `src/features/dashboard/components/DashboardView.tsx` (slot `meetings-by-day`)
- `src/features/dashboard/components/DashboardSkeleton.tsx`, `index.ts`
- `src/features/dashboard/components/DashboardView.test.tsx` (mock `LabelList` + 2 testes)
- `src/app/demo/{page,demo-data}.tsx` (showcase com dados fictícios)
- `docs/guides/dashboard-cards.md`

## Verificação
- `pnpm typecheck`, `pnpm lint`, `vitest run src/features/dashboard` verdes.
- Visual em página temporária pública (apagada depois): barras, rótulos,
  tendência, tooltip, modal expandido com tabela, dark mode.
- `/demo` já estava quebrada antes (LeadTable usa `useOrganization` sem
  provider → cai no login). Não faz parte deste trabalho.

## Pendências
- Nada de commit/push/PR — aguardando pedido explícito.
