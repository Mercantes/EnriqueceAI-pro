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

## Entrega 2 — fix da `/demo` + cor vermelha V4 no gráfico
- Branch `fix/demo-page-org-context`: commits `7026259d` (fix `/demo`) e
  `2696130d` (RM em `var(--primary)`, RR `#059669`).
- PR [#349](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/349): CI verde,
  merge por squash → `98f48afa` na main. Branch apagada, main local alinhada.
- Deploy automático confirmado ~3 min após o merge: `/api/version` = `98f48afa`;
  `https://app.enriqueceai.com.br/demo` responde HTTP 200 deslogado, sem
  redirecionar para `/login`.

## Validação em produção (03/set, ~14h BRT)
Dashboard real lido pelo Chrome logado do usuário + recálculo no banco com as
regras dos cards (RM = `meeting_scheduled_at`, RR = `won_at` + `status='won'`,
dias em America/Sao_Paulo, SDRs ativos/convidados):

| Dia   | RM | RR |
|-------|----|----|
| 01/09 | 4  | 3  |
| 02/09 | 9  | 3  |
| 03/09 | 1  | 1  |
| Total | 14 | 7  |

Cards: RM 14, RR 7. Barras: 4+9+1 e 3+3+1. Banco: idêntico. ✅

Observação: um print do usuário mais cedo mostrava RM 2 em 03/09; no momento
da validação havia só 1 lead com marcação hoje (`aec054d0…`, 11:55). Nenhum
lead perdido/arquivado/excluído hoje tinha marcação em 03/09, então o segundo
registro sumiu ou mudou de data entre o print e a validação — não identificado.
Não é bug do gráfico (reflete o dado atual). Investigar por nome/CNPJ se o
usuário lembrar qual reunião era.

### Filtro de SDR (`?userIds=<uuid>`) — testado em produção
| SDR | Card RM | Barras RM | Card RR | Barras RR | Banco |
|---|---|---|---|---|---|
| Ismael | 6 | 2+3+1 = 6 | 3 | 0+2+1 = 3 | igual |
| Guilherme | 2 | 0+2+0 = 2 | 2 | 2+0+0 = 2 | igual |

✅ O gráfico acompanha o filtro e bate com os cards KPI e com o banco.

⚠️ Divergência PRÉ-EXISTENTE que o filtro expõe: o card KPI "Reuniões
realizadas" atribui por `won_by ?? assigned_to` (`fetchOpportunityKpi`),
enquanto o ranking "Reuniões Realizadas" atribui por `assigned_to`
(`fetchMeetingsHeldRanking`). Com o filtro no Ismael: KPI = 3, ranking = 4.
Sem filtro os dois dão 7. O gráfico segue o KPI (3). Decidir uma regra única
se incomodar — não faz parte deste trabalho.

## Entrega 3 — atribuição de RR unificada
`fetchOpportunityKpi` (card KPI "Reuniões realizadas") passa a atribuir por
`assigned_to` sob filtro de vendedor, igual ao ranking, ao card RM, ao guia e
ao Sales Hub. `won_by` deixou de ser lido. Sem filtro nada muda (total do mês).
Teste novo em `dashboard-metrics.service.test.ts`; tooltip do card e
`docs/guides/dashboard-cards.md` atualizados.

## Pendências / próximos passos
- Nenhuma.
- Se aparecer de novo RM "sumindo" no mesmo dia, ver quem altera
  `meeting_scheduled_at` fora do fluxo de agendamento.
- Ideias não pedidas (não implementar sem pedido): quebra por SDR no gráfico,
  meta diária como linha de referência.

## Lições
- Verificação visual sem login: página temporária sob `/docs/` (prefixo público
  no middleware), apagar depois. Dark mode é por classe `dark` no `<html>`.
- Validador de paleta do skill dataviz: o verde `#22c55e` dos cards falha na
  banda de luminosidade no tema escuro; `#16a34a` passa nos dois temas.
- `noUncheckedIndexedAccess`: em testes, `trend[0]` é `number | undefined` —
  usar `?? 0` antes de `toBeCloseTo`.
