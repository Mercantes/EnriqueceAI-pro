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
RM = vermelho da V4 via `var(--primary)` (#d8151e claro / #e6443d escuro),
RR = verde `#059669`. (Primeira versão usava indigo `#6366f1` + `#16a34a`;
trocada a pedido do usuário para o vermelho da marca. Vermelho × verde é o
par crítico para deutan: `#16a34a`/`#15803d`/`#047857` falham no escuro,
`#059669` passa nos dois temas.)

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

## Entrega
- Branch `feat/dashboard-rm-rr-por-dia`, commit `2c66b795`.
- PR [#348](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/348): CI verde,
  merge por squash → `46361fdd` na main. Branch apagada.
- Deploy automático (Coolify) confirmado ~2 min depois: `/api/version` = `46361fdd`.
- Ficaram FORA do commit, de propósito, alterações pré-existentes na árvore:
  `next-env.d.ts`, `src/features/billing/actions/create-checkout.ts`,
  `.aios/handoffs/`, `.claude/launch.json` e os handoffs de agosto não versionados.

## Fix da `/demo` (mesma sessão, depois do merge)
Causas: (1) `LeadTable` chama `useOrganization()` e a `/demo` não tem
`OrganizationProvider` → hook lança no render do servidor; (2) a seção de
contatos do `LeadInfoPanel` chama `listLeadContacts('demo-lead-1')` ao montar →
`requireAuth` redireciona a página pública para `/login`.
Correção: `OrgContext.Provider` com `demoOrgContext` fictício em
`src/app/demo/page.tsx` (+ `demo-data.ts`), e guarda `isUuid(leadId)` em
`LeadContactsSection.refresh` (sem UUID não há fetch — regra que já vale para
qualquer `.eq` com id vindo de fora). Teste: `LeadContactsSection.test.tsx`.
Conferido no navegador: dashboard, cadência, lead enriquecido e lista de leads
renderizam; sem redirecionamento.

## Pendências / próximos passos
- Validar em produção: soma das barras RM = total do card "Reuniões marcadas";
  soma das barras RR = total de "Reuniões realizadas"; trocar filtro de SDR.
- Ideias não pedidas (não implementar sem pedido): quebra por SDR no gráfico,
  meta diária como linha de referência.

## Lições
- Verificação visual sem login: página temporária sob `/docs/` (prefixo público
  no middleware), apagar depois. Dark mode é por classe `dark` no `<html>`.
- Validador de paleta do skill dataviz: o verde `#22c55e` dos cards falha na
  banda de luminosidade no tema escuro; `#16a34a` passa nos dois temas.
- `noUncheckedIndexedAccess`: em testes, `trend[0]` é `number | undefined` —
  usar `?? 0` antes de `toBeCloseTo`.
