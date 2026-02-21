# Epic 3: Clone Funcional Meetime

**Status:** Draft (PO Validated — GO Condicional → Ajustes Aplicados)
**Created:** 2026-02-21
**Author:** @pm (Morgan)
**Validated by:** @po (Pax) — 2026-02-21
**Priority:** HIGH
**Total Stories:** 17 (4 Waves)

---

## Epic Goal

Replicar 100% dos fluxos e layout do Meetime Flow no Flux, com design system próprio (cores Flux), transformando o Flux em uma plataforma de Sales Engagement equivalente ao Meetime para equipes B2B brasileiras.

## Existing System Context

- **Tech Stack:** Next.js 16 (App Router), React 19, Supabase (PostgreSQL 17 + Auth + Realtime), Tailwind CSS v4 + shadcn/ui, TypeScript strict
- **Current State:** MVP funcional com auth, leads, cadências básicas, templates, atividades (split-view), dashboard, billing, integrações CRM/Gmail/WhatsApp
- **Pattern:** Feature modules verticais (`src/features/{name}/`), Server Actions com `ActionResult<T>`, RLS multi-tenant

## Reference

- **Source:** 20 screenshots do Meetime Flow (capturadas 2026-02-21)
- **Videos:** https://www.youtube.com/watch?v=RF-uwkaamYA, https://www.youtube.com/watch?v=tRfQhq0wncM

## Quality Gate Standard

Todas as stories seguem o padrão CodeRabbit self-healing:
- **Dev phase:** max 2 iterations, CRITICAL/HIGH auto-fix, MEDIUM → tech debt
- **QA phase:** max 3 iterations, full review
- **Gate:** Lint + Typecheck + Tests + Build passando antes de PR

---

## Wave Structure

| Wave | Foco | Stories | Complexidade | Points |
|------|------|---------|-------------|--------|
| **Wave 1** | Dashboard + Metas + Navegação | 3.1 — 3.5 | Média | 26 |
| **Wave 2** | Cadências + Execução de Atividades | 3.6 — 3.9 | Alta | 26 |
| **Wave 3** | Settings + Fit Score + Leads | 3.10 — 3.14 | Média-Alta | 26 |
| **Wave 4** | Ligações + Estatísticas | 3.15 — 3.17 | Média | 16 |
| | | **Total** | | **94** |

---

## Wave 1: Dashboard + Metas + Navegação

### Story 3.1: Reestruturar Navegação (Meetime-style)

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 8

**Objetivo:** Trocar a navegação lateral (sidebar) do Flux para uma **top bar** horizontal idêntica ao Meetime.

**Meetime Reference:** Screenshots 1-2

**Layout da Top Bar:**
- Logo Flux (esquerda)
- Menu principal: **Dashboard** | **Prospecção** ▼ | **Ligações** ▼ | **Estatísticas** ▼
- Direita: Notificações (bell), Help (?), Avatar do usuário ▼
- Sub-bar: "Ligar" button, "Usuário" link

**Dropdown Prospecção:**
- Execução
- Atividades
- Cadências
- Leads
- Ajustes

**Scope IN:**
- Top bar horizontal com dropdowns
- Menu mobile (hamburger)
- Breadcrumbs contextuais
- Sub-bar com ações rápidas
- Remoção da sidebar atual

**Scope OUT:**
- Conteúdo das páginas de destino (outras stories)
- Módulo de Ligações (Wave 4)
- Módulo de Estatísticas (Wave 4)
- Animações/transições avançadas

**Acceptance Criteria:**
- [ ] Top bar horizontal substitui a sidebar
- [ ] Dropdowns com submenus funcionais
- [ ] Responsivo (hamburger mobile)
- [ ] Breadcrumbs contextuais abaixo da top bar
- [ ] Sub-bar com ações rápidas (Ligar, Usuário)
- [ ] Rota `/settings` acessível via Prospecção > Ajustes
- [ ] Nenhuma rota existente quebrada

**Files impactados:**
- `src/shared/components/AppSidebar.tsx` → remover/refazer
- `src/shared/components/AppHeader.tsx` → refazer como top bar
- `src/app/(app)/layout.tsx` → layout sem sidebar
- `src/lib/auth/permissions.ts` → adaptar canAccessPath

---

### Story 3.2: Dashboard — Layout + Filtros + KPI Visão Geral

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Criar a estrutura base do novo dashboard com filtros e card hero de KPI de oportunidades.

**Meetime Reference:** Screenshots 1, 11

**Seções:**
1. **Filtros** (topo): Seletor de mês, filtro de cadências, filtro de vendedores, botão "Editar metas"
2. **Visão Geral** (hero card):
   - KPI grande: "X Oportunidades em {mês}"
   - Card meta: "Meta de oportunidades para {mês}: Y"
   - Indicador progresso: "Z% abaixo/acima do previsto até hoje (dia)"
   - Gráfico de linha: Oportunidades vs Meta ao longo do mês

**Scope IN:**
- Novo layout do dashboard (substituir DashboardView atual)
- Filtros funcionais (mês, cadências, vendedores)
- Card KPI de oportunidades com gráfico de linha
- Migration para tabelas `goals` e `goals_per_user`

**Scope OUT:**
- Ranking cards (Story 3.3)
- Insights charts (Story 3.4)
- Modal de metas (Story 3.5)
- O botão "Editar metas" é renderizado mas abre modal da Story 3.5

**Acceptance Criteria:**
- [ ] Filtros de mês, cadências e vendedores funcionais
- [ ] KPI de oportunidades com valor real do banco
- [ ] Gráfico de linha Oportunidades vs Meta mensal
- [ ] Indicador de % acima/abaixo do previsto
- [ ] Dados reais (não mock)
- [ ] Responsivo
- [ ] Migration criada: tabelas `goals`, `goals_per_user`

**Novas tabelas:**
- `goals` — metas mensais por org (opportunity_target, conversion_target, month, org_id)
- `goals_per_user` — meta individual por SDR/mês (user_id, org_id, month, opportunity_target)

**Files impactados:**
- `src/features/dashboard/` → refazer completamente
- `src/app/(app)/dashboard/page.tsx` → novo layout
- Nova migration Supabase

---

### Story 3.3: Dashboard — Ranking Cards

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Implementar os 3 cards de ranking do dashboard com breakdown por SDR.

**Meetime Reference:** Screenshot 1

**Dependência:** Story 3.2 (layout base + tabelas goals)

**Layout (3 cards lado a lado):**
1. **Leads Finalizados**: número, % do previsto, meta mês, breakdown por SDR (prospectando/finalizados), média/vendedor
2. **Atividades Realizadas**: número, % do previsto, meta mês, breakdown por SDR (média diária), média/vendedor
3. **Taxa de Conversão**: percentual, acima/abaixo meta, meta mês, breakdown por SDR (oportunidades %), média/vendedor

**Scope IN:**
- 3 cards de ranking com dados reais
- Breakdown por SDR dentro de cada card
- Indicadores de % previsto vs realizado
- Média por vendedor

**Scope OUT:**
- Filtros (já implementados em 3.2)
- Insights charts (Story 3.4)

**Acceptance Criteria:**
- [ ] Card "Leads Finalizados" com breakdown por SDR
- [ ] Card "Atividades Realizadas" com breakdown por SDR
- [ ] Card "Taxa de Conversão" com breakdown por SDR
- [ ] Média por vendedor calculada corretamente
- [ ] % do previsto baseado nas metas do período
- [ ] Responsivo (stack vertical em mobile)

---

### Story 3.4: Dashboard — Insights Charts

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Implementar os 2 cards de insights do dashboard com gráficos de motivos de perda e conversão por origem.

**Meetime Reference:** Screenshot 1

**Dependência:** Story 3.2 (layout base), Story 3.10 (tabela `loss_reasons`)

**Layout (2 cards):**
1. **Motivos de Perda**: bar chart horizontal (motivo + %)
2. **Conversão por Origem**: stacked bar chart por canal/landing page

**Scope IN:**
- Chart horizontal de motivos de perda
- Chart stacked de conversão por origem
- Dados reais do banco
- Coluna `loss_reason_id` em `cadence_enrollments`

**Scope OUT:**
- CRUD de motivos de perda (Story 3.10)
- Relatórios avançados (Wave 4)

**Acceptance Criteria:**
- [ ] Bar chart horizontal de motivos de perda com percentuais
- [ ] Stacked bar chart de conversão por origem
- [ ] Dados reais (queries agregadas)
- [ ] Responsivo
- [ ] Migration: coluna `loss_reason_id` em `cadence_enrollments`

**Nota de dependência:** Se Wave 3 (Story 3.10) ainda não tiver sido implementada, os motivos de perda podem usar dados seed iniciais. O chart deve funcionar com dados vazios (empty state).

---

### Story 3.5: Modal de Metas Mensais

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 3

**Objetivo:** Implementar modal de edição de metas mensais idêntico ao Meetime.

**Meetime Reference:** Screenshot 11

**Dependência:** Story 3.2 (tabelas goals + goals_per_user)

**Layout do Modal:**
- Título: "Metas {Mês}"
- Campo: Meta de Oportunidades (número)
- Campo: Meta de Taxa de Conversão (percentual %)
- Seção Vendedores: lista de SDRs com meta individual por vendedor (mês anterior + meta atual)
- **Estimativa de esforço automática**: "Será necessário finalizar X leads e realizar uma média de Y atividades diárias por vendedor"
- Botões: Fechar / Salvar metas

**Scope IN:**
- Modal acessível via botão "Editar metas" do dashboard
- Campos de meta org-level + individual por SDR
- Cálculo automático de estimativa
- Persistência em banco

**Scope OUT:**
- Histórico de metas
- Metas por cadência específica
- Notificações quando meta é atingida

**Acceptance Criteria:**
- [ ] Modal acessível via botão "Editar metas" no dashboard
- [ ] Campos de meta de oportunidades e taxa de conversão
- [ ] Metas individuais por vendedor editáveis
- [ ] Cálculo automático de estimativa de esforço
- [ ] Persistência em banco (tabelas `goals` e `goals_per_user`)
- [ ] Apenas managers podem editar metas (`requireManager()`)

---

## Wave 2: Cadências + Execução de Atividades

### Story 3.6: Cadências — Lista Refatorada

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Refazer a lista de cadências para replicar layout Meetime com tabs, filtros e prioridade.

**Meetime Reference:** Screenshots 3-4

**Layout:**
- Header: ícone + "Cadências" + descrição
- Filtros: Status ▼, Prioridade ▼, Foco ▼, Participantes ▼ + busca por nome
- Contagem: "Exibindo todas as X cadências"
- Tabs: **Padrão** (badge count) | **E-mail Automático** (badge count)
- Botão: "+ Criar nova" (verde)
- Tabela: ícone prioridade (seta), Nome, Descrição, menu ações (≡▼)

**Scope IN:**
- Tabs Padrão / E-mail Automático
- Filtros (status, prioridade, foco, participantes)
- Ícone de prioridade por cadência
- Menu de ações por cadência
- Migration: novas colunas em `cadences`

**Scope OUT:**
- Timeline builder dentro da cadência (Story 3.7)
- Criação de cadência (fluxo existente, adaptar depois)
- E-mail automático engine (só UI de tab)

**Acceptance Criteria:**
- [ ] Tabs Padrão / E-mail Automático com contagem
- [ ] Filtros funcionais (status, prioridade, foco, participantes)
- [ ] Busca por nome
- [ ] Ícone de prioridade por cadência
- [ ] Menu de ações por cadência
- [ ] Contagem dinâmica de cadências

**Novas colunas em `cadences`:**
- `priority` (enum: high, medium, low — default: medium)
- `origin` (enum: inbound_active, inbound_passive, outbound — default: outbound)
- `type` (enum: standard, auto_email — default: standard)

---

### Story 3.7: Cadência — Timeline Builder (Drag & Drop)

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 8

**Objetivo:** Refazer o builder de cadência com timeline por dia e sidebar de atividades draggable.

**Meetime Reference:** Screenshot 5

**Layout:**
- **Sidebar esquerda**: tipos de atividade disponíveis, expandíveis
  - \+ E-mail ▼ (E-mail 1, E-mail 2, ...)
  - \+ Ligação ▼ (Ligação)
  - \+ Social Point ▼ (LinkedIn, WhatsApp)
  - \+ Pesquisa ▼ (Pesquisa)
- **Área principal**: timeline por dia
  - Dia 1 ▼: atividades numeradas (1. E-mail, 2. Ligação, ...)
  - Dia 2 ▼: 5. Ligação, 6. WhatsApp
  - Cada atividade com ícone do tipo + nome + cor por tipo
- **Bottom bar**: nome da cadência, "Envio de leads via integração", Voltar, "Editar Cadência" (verde)

**Scope IN:**
- Sidebar com tipos de atividade expandíveis
- Drag & drop para timeline (usar dnd-kit)
- Numeração automática
- Ícones e cores por tipo
- Collapsible por dia
- Tipo "Pesquisa" como novo step type
- Persistência no banco

**Scope OUT:**
- Templates de e-mail inline (usa templates existentes)
- Configuração de delay automático entre dias
- A/B testing de steps
- Automação de envio (engine)

**Acceptance Criteria (GWT):**

```gherkin
Given que estou na tela de edição de uma cadência
When eu arrasto um tipo "E-mail" da sidebar para o Dia 1
Then a atividade aparece no Dia 1 com numeração automática e ícone de e-mail

Given que existem 3 atividades no Dia 1
When eu arrasto a atividade 3 para o Dia 2
Then ela se move para o Dia 2 e a numeração é recalculada

Given que estou visualizando o timeline
When eu clico no header "Dia 2"
Then o conteúdo do Dia 2 colapsa/expande

Given que eu adicionei atividades e clico "Editar Cadência"
Then as alterações são salvas no banco com step_order correto

Given que o tipo "Pesquisa" não existia
When eu expando "+ Pesquisa" na sidebar
Then posso arrastar um step de pesquisa para a timeline
```

- [ ] Tipo `research` adicionado ao enum de `cadence_steps.channel`

---

### Story 3.8: Execução de Atividades — Tela Principal

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 8

**Objetivo:** Refazer a tela de execução (`/atividades`) para replicar o layout Meetime com progresso do dia, objetivo diário e modo execução rápida.

**Meetime Reference:** Screenshots 6, 7, 8

**Layout:**

1. **Breadcrumb**: "Execução de cadência / Atividades"
2. **Meu Progresso Hoje** (card esquerda): número grande "X / Y ATIVIDADES", legenda finalizado/pendente
3. **Objetivo Diário** (card direita): ícone troféu + "Objetivo diário (N)", texto motivacional, link "Iniciar novas prospecções"
4. **Tabs**: Execução | Power Dialer
5. **Toggle**: "Modo Execução rápida" (switch)
6. **Leads Aguardando Primeira Ligação** (seção): cards horizontais com checkbox + avatar + nome + badge tempo
7. **Atividades** (seção): filtros + tabela com botão "Executar"

**Scope IN:**
- Card "Meu progresso hoje"
- Card "Objetivo diário" com meta configurável
- Tab Execução funcional
- Toggle modo execução rápida
- Seção "Leads Aguardando Primeira Ligação"
- Lista de atividades com filtros e botão Executar
- Indicador de tempo desde última atividade
- Migration: tabela `daily_activity_goals`

**Scope OUT:**
- Tab Power Dialer (Story 3.17 — placeholder "Em breve")
- Modal de execução split view (Story 3.9)
- VoIP/click-to-call real

**Acceptance Criteria:**
- [ ] Card "Meu progresso hoje" com contagem finalizado/pendente
- [ ] Card "Objetivo diário" com meta de `daily_activity_goals`
- [ ] Tab "Execução" funcional (Power Dialer placeholder)
- [ ] Toggle "Modo Execução rápida" agrupa por tipo de atividade
- [ ] Seção "Leads Aguardando Primeira Ligação" com cards
- [ ] Lista de atividades com filtros e botão Executar
- [ ] Indicador de tempo desde última atividade (vermelho se > 1h)

**Nova tabela:**
- `daily_activity_goals` — objetivo diário por org/user (org_id, user_id, target, created_at)

---

### Story 3.9: Execução — Modal de Atividade (Split View)

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Evoluir o modal de execução de atividade para replicar o split view completo do Meetime.

**Meetime Reference:** Screenshots 9, 10

**Nota:** O Flux já possui `ActivityExecutionSheet.tsx` com split view parcial. Esta story evolui o existente.

**Painel Esquerdo (Lead Info):**
- Avatar + nome do lead + empresa
- Ícone pin + dropdown
- Info da cadência: "X de Y atividades completadas"
- 4 tabs ícone: Contato | Timeline | Notas | Configurações
- Timeline: lista de atividades (AGORA, HOJE, datas) com ícone tipo, nome, instruções

**Painel Direito (Modal Atividade):**
- Navegação: "< X de Y >" + menu 3 pontos
- Ícone do tipo de atividade (grande, colorido)
- Título do tipo: "Social Point", "Pesquisa", "E-mail", "Ligação"
- Link contextual: "Procurar {lead} no LinkedIn →"
- Instruções da atividade
- Campo "Anotações:" (textarea)
- Botão "Marcar como feita ✓" (verde)

**Scope IN:**
- Evolução do ActivityExecutionSheet existente
- 4 tabs no painel esquerdo (Contato, Timeline, Notas, Configurações)
- Navegação entre atividades (anterior/próxima)
- Modal adapta por tipo (Social Point, Pesquisa, E-mail, Ligação)
- Link contextual LinkedIn/WhatsApp
- Campo de anotações
- "Marcar como feita" avança para próxima

**Scope OUT:**
- Click-to-call VoIP real (placeholder)
- Envio de email real (já existe no compose atual)
- Integração direta com LinkedIn API

**Acceptance Criteria (GWT):**

```gherkin
Given que clico "Executar" em uma atividade do tipo Social Point
When o modal split view abre
Then o painel esquerdo mostra info do lead e o painel direito mostra "Procurar {lead} no LinkedIn →"

Given que estou no modal com atividade 3 de 8
When clico na seta ">"
Then navego para atividade 4 de 8 sem fechar o modal

Given que estou no painel esquerdo
When clico na tab "Timeline"
Then vejo o histórico de atividades do lead com ícones por tipo e datas

Given que preencho anotações e clico "Marcar como feita"
Then a atividade é marcada como concluída e o modal avança para a próxima
```

---

## Wave 3: Settings + Fit Score + Leads

### Story 3.10: Ajustes de Prospecção — Skeleton + Atividades Diárias + Motivos de Perda

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Criar a estrutura da tela de ajustes de prospecção com sidebar menu e implementar as 2 primeiras subpáginas.

**Meetime Reference:** Screenshots 12, 13

**Sidebar Menu (renderizar todas, implementar 2):**
1. **Atividades Diárias** ← implementar
2. **Motivos de Perda** ← implementar
3. Vendas Baseadas em Contas ← placeholder "Em breve"
4. Acesso aos Leads ← placeholder
5. Campos Personalizados ← placeholder
6. Blacklist de E-mails ← placeholder
7. Fit Score ← placeholder (Story 3.11)

**Subpágina Atividades Diárias:**
- Ícone troféu + "Objetivo Diário de Atividades"
- Objetivo Padrão: input numérico
- Por vendedor: tabela nome + input individual

**Subpágina Motivos de Perda:**
- Lista de motivos configuráveis
- CRUD: adicionar, editar, remover motivo
- Motivos padrão seed (Sem interesse, Sem budget, Timing ruim, Concorrente, Outros)

**Scope IN:**
- Rota `/settings/prospecting` com sidebar menu
- Subpágina Atividades Diárias funcional
- Subpágina Motivos de Perda com CRUD
- Migration: tabela `loss_reasons`
- Apenas managers acessam (`requireManager()`)

**Scope OUT:**
- Fit Score config (Story 3.11)
- Campos Personalizados, Blacklist, ABM, Acesso (Story 3.12)

**Acceptance Criteria:**
- [ ] Rota `/settings/prospecting` com sidebar menu de 7 itens
- [ ] Subpágina Atividades Diárias salva objetivo padrão + por vendedor
- [ ] Subpágina Motivos de Perda com CRUD completo
- [ ] Apenas managers acessam
- [ ] Placeholders para subpáginas não implementadas
- [ ] Migration: tabela `loss_reasons` (org_id, name, is_default, created_at)

---

### Story 3.11: Ajustes — Fit Score Config

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Implementar a subpágina de configuração do Fit Score dentro dos ajustes de prospecção.

**Meetime Reference:** Screenshot 13

**Dependência:** Story 3.10 (skeleton da tela de ajustes)

**Layout:**
- Ícone estrela + "Fit Score"
- Explicação de como funciona
- Tabela de regras: Pontos (+/-) | Campo (dropdown) | Critério (dropdown: Contém, É igual a, Não é vazio, Começa com) | Valor (input) | Delete
- Botão "+ Adicionar regra"

**Scope IN:**
- Subpágina Fit Score dentro de `/settings/prospecting`
- CRUD de regras de scoring
- Migration: tabela `fit_score_rules`
- Validação de regras (pontos obrigatórios, campo obrigatório)

**Scope OUT:**
- Cálculo do score em leads (Story 3.13 — Engine)
- Exibição visual do score na lista (Story 3.14)

**Acceptance Criteria:**
- [ ] Subpágina Fit Score acessível via sidebar de ajustes
- [ ] Tabela de regras com colunas: Pontos, Campo, Critério, Valor, Delete
- [ ] Dropdown de campos baseado nos campos reais de `leads`
- [ ] Dropdown de operadores: Contém, É igual a, Não é vazio, Começa com
- [ ] Adicionar e remover regras
- [ ] Persistência no banco
- [ ] Migration: tabela `fit_score_rules` (org_id, points, field, operator, value)

---

### Story 3.12: Ajustes — Campos Personalizados + Blacklist + ABM + Acesso

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Implementar as 4 subpáginas restantes dos ajustes de prospecção.

**Meetime Reference:** Screenshots 12, 13

**Dependência:** Story 3.10 (skeleton)

**Subpáginas:**

1. **Campos Personalizados**: CRUD de custom fields para leads (field_name, field_type: text/number/date/select)
2. **Blacklist de E-mails**: CRUD de domínios bloqueados
3. **Vendas Baseadas em Contas (ABM)**: toggle on/off + configurações de agrupamento por empresa
4. **Acesso aos Leads**: config de visibilidade (todos veem todos, só seus leads, por equipe)

**Scope IN:**
- 4 subpáginas funcionais
- Migrations: tabelas `custom_fields`, `email_blacklist`
- CRUD para cada configuração

**Scope OUT:**
- Aplicação dos campos personalizados no formulário de leads (story futura)
- Aplicação da blacklist no envio de emails (story futura)
- Engine de ABM (apenas toggle/config)

**Acceptance Criteria:**
- [ ] Subpágina Campos Personalizados com CRUD
- [ ] Subpágina Blacklist de E-mails com CRUD
- [ ] Subpágina ABM com toggle e configurações
- [ ] Subpágina Acesso aos Leads com seleção de modo de visibilidade
- [ ] Migrations: `custom_fields` (org_id, field_name, field_type, options), `email_blacklist` (org_id, domain)
- [ ] Apenas managers acessam

---

### Story 3.13: Fit Score Engine

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Implementar motor de cálculo de Fit Score que avalia leads automaticamente baseado nas regras configuradas.

**Meetime Reference:** Screenshots 13, 14

**Dependência:** Story 3.11 (tabela `fit_score_rules` com regras configuradas)

**Lógica:**
- Carregar regras da tabela `fit_score_rules` por org
- Para cada lead, avaliar cada regra (campo + operador + valor)
- Somar/subtrair pontos por regra
- Salvar score calculado no lead
- Recalcular quando: lead criado, lead atualizado, regra alterada

**Exemplos de regras:**
- E-mail contém "gmail" → -1 ponto
- E-mail contém "hotmail" → -1 ponto
- Cargo é igual a "Gestor comercial" → +4 pontos
- Nome completo não é vazio → +2 pontos

**Scope IN:**
- Service de cálculo de score
- Trigger no create/update de lead
- Batch recalc quando regra é alterada
- Coluna `fit_score` na tabela `leads`

**Scope OUT:**
- UI de exibição do score na lista (Story 3.14)
- Score influenciando ordenação de atividades
- Machine learning / score adaptativo

**Acceptance Criteria (GWT):**

```gherkin
Given que existem 3 regras de Fit Score configuradas para minha org
When um novo lead é criado
Then o fit_score é calculado automaticamente baseado nas 3 regras

Given que um lead tem email "joao@gmail.com" e a regra "email contém gmail → -1"
When o score é calculado
Then o lead perde 1 ponto por essa regra

Given que eu altero uma regra de scoring
When salvo a alteração
Then todos os leads da org são recalculados em batch

Given que um lead tem fit_score calculado
When eu atualizo o campo "cargo" do lead
Then o fit_score é recalculado automaticamente
```

- [ ] Migration: coluna `fit_score` (integer, nullable) em `leads`

---

### Story 3.14: Leads — Lista Refatorada com Score

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 3

**Objetivo:** Refazer a lista de leads para incluir Fit Score visual, status Meetime-style e responsável.

**Meetime Reference:** Screenshot 14

**Dependência:** Story 3.13 (Fit Score Engine calculando scores)

**Layout:**
- Tabela: Lead (avatar com score circle + nome + empresa) | Status | Cadência | Responsável | Ações (≡)
- **Status badges**: ATIVO (verde), ESPERANDO INÍCIO (cinza)
- **Avatar com score circle**: anel colorido ao redor do avatar baseado no Fit Score
- Score numérico dentro do circle

**Scope IN:**
- Avatar com score circle visual
- Status badges Meetime-style
- Coluna Responsável (SDR atribuído)
- Menu de ações por lead
- Ordenação por score

**Scope OUT:**
- Página de detalhe do lead (manter existente)
- Importação CSV (manter existente)
- Enriquecimento (manter existente)

**Acceptance Criteria:**
- [ ] Avatar com score circle visual (cor: verde ≥7, amarelo 4-6, vermelho ≤3)
- [ ] Status ATIVO / ESPERANDO INÍCIO como badges
- [ ] Coluna Responsável (SDR atribuído)
- [ ] Menu de ações por lead
- [ ] Leads ordenáveis por fit_score
- [ ] Compatível com busca e filtros existentes

---

## Wave 4: Ligações + Estatísticas

### Story 3.15: Ligações — Lista e Detalhes

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 8

**Objetivo:** Criar módulo de ligações com lista, filtros por status e modal de detalhes.

**Meetime Reference:** Screenshots 15, 16

**Lista de Ligações:**
- Breadcrumb: "Ligações / Lista"
- Filtros: busca, usuário, período (Hoje, Esta Semana, Este Mês, Custom), favoritas, Todas/Importantes
- Status icons: Significativa (verde ↑), Não Significativa (cinza ↓), Sem contato, Cliente Ocupado, Não Conectada
- Tabela: Status | Origem | Destino | Data | Duração | Opções (eye)
- Botão: Exportar CSV

**Modal Detalhes:**
- Player de áudio com timeline (placeholder sem VoIP real)
- Metadados: Status (badge + dropdown), Origem, Destino, Data, Duração, Tipo, Custo, Anotações
- Seção FEEDBACK: rich text editor com avatar

**Scope IN:**
- Rota `/calls` com lista de ligações
- Filtros completos
- Modal de detalhes
- Status classificáveis
- Exportar CSV
- Seção de feedback
- Feature module `src/features/calls/`
- Migrations: tabelas `calls`, `call_feedback`

**Scope OUT:**
- Integração VoIP real (Twilio/Vonage) — epic separado
- Gravação de áudio real
- Click-to-call funcional
- Power Dialer engine (Story 3.17 é placeholder)

**Acceptance Criteria:**
- [ ] Rota `/calls` com lista de ligações
- [ ] Filtros por período, status, usuário
- [ ] Modal de detalhes com player de áudio placeholder
- [ ] Status classificáveis (Significativa, Não Significativa, etc.)
- [ ] Exportar CSV
- [ ] Seção de feedback com rich text
- [ ] RLS policies em `calls` e `call_feedback`

**Novas tabelas:**
- `calls` — (id, org_id, user_id, lead_id, origin, destination, started_at, duration_seconds, status, type, cost, recording_url, notes, is_important)
- `call_feedback` — (id, call_id, user_id, content, created_at)

---

### Story 3.16: Estatísticas — Insights Avançados

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 5

**Objetivo:** Criar tela de estatísticas com insights de motivos de perda, conversão por origem e tempo de resposta.

**Meetime Reference:** Screenshots 17, 18, 20

**Seções:**

1. **Motivos de Perda** (bar chart horizontal): cada motivo com barra + percentual, expansível fullscreen
2. **Conversão por Origem** (stacked bar chart): filtro de canais, barras verde (convertido) + vermelho (perdido)
3. **Tempo de Resposta**: KPI "X% abordados em até Y", modal de customização de intervalo (1 MIN, 5 MIN, 30 MIN, 1H, 3H, 5H), tabela por cadência

**Scope IN:**
- Rota `/statistics` (ou refatorar `/reports`)
- 3 seções de charts
- Filtros de período e vendedores
- Modal de customização de intervalo
- Tabela de tempo de resposta por cadência

**Scope OUT:**
- Relatórios exportáveis em PDF
- Dashboard executivo (C-level)
- Comparação entre períodos

**Acceptance Criteria:**
- [ ] Rota `/statistics` ou refatorar `/reports`
- [ ] Chart motivos de perda (bar horizontal)
- [ ] Chart conversão por origem (stacked bar)
- [ ] Seção tempo de resposta com customização de intervalo
- [ ] Tabela de tempo de resposta por cadência
- [ ] Filtros de período e vendedores

---

### Story 3.17: Power Dialer (Placeholder + UI)

**Executor:** @dev | **Quality Gate:** @architect + CodeRabbit | **Points:** 3

**Objetivo:** Implementar UI do Power Dialer como tab na tela de execução.

**Meetime Reference:** Screenshot 6 (tab "Power Dialer")

**Dependência:** Story 3.8 (tela de execução com tabs)

**Layout:**
- Tab "Power Dialer" na tela de Execução
- Lista de leads para discagem sequencial
- Controles: Play/Pause/Skip
- Status em tempo real por lead
- Banner "Em breve — integração com provedor VoIP"

**Scope IN:**
- Tab Power Dialer na tela de execução
- UI de fila de discagem com controles visuais
- Empty state / coming soon banner

**Scope OUT:**
- Integração VoIP real (Twilio/Vonage)
- Discagem automática
- Gravação de chamadas
- Transferência de chamadas

**Acceptance Criteria:**
- [ ] Tab Power Dialer visível na tela de execução
- [ ] UI de fila de discagem com controles (visuais, não funcionais)
- [ ] Banner "Em breve" para integração VoIP
- [ ] Pode ser marcado como feature flag desabilitada

---

## Database Migration Summary

### Novas Tabelas

| Tabela | Story | Propósito |
|--------|-------|-----------|
| `goals` | 3.2 | Metas mensais por org |
| `goals_per_user` | 3.2 | Metas por SDR/mês |
| `loss_reasons` | 3.10 | Motivos de perda configuráveis |
| `fit_score_rules` | 3.11 | Regras de Fit Score |
| `custom_fields` | 3.12 | Campos personalizados |
| `email_blacklist` | 3.12 | Domínios bloqueados |
| `daily_activity_goals` | 3.8 | Objetivo diário de atividades |
| `calls` | 3.15 | Registros de ligações |
| `call_feedback` | 3.15 | Feedback por ligação |

### Colunas Novas em Tabelas Existentes

| Tabela | Coluna | Story |
|--------|--------|-------|
| `cadences` | `priority`, `origin`, `type` | 3.6 |
| `cadence_steps` | tipo `research` no enum de `channel` | 3.7 |
| `leads` | `fit_score` | 3.13 |
| `cadence_enrollments` | `loss_reason_id` | 3.4 |

---

## Dependency Graph

```
Wave 1:
  3.1 (Navegação) ──────────────────────────────┐
  3.2 (Dashboard Layout) → 3.3 (Ranking) ──────│
                         → 3.4 (Insights) ──────│── Todas Wave 1 independentes entre si
                         → 3.5 (Modal Metas) ───│   exceto 3.3/3.4/3.5 dependem de 3.2

Wave 2: (depende de Wave 1 concluída)
  3.6 (Cadências Lista) → 3.7 (Timeline Builder)
  3.8 (Execução Principal) → 3.9 (Modal Split View)

Wave 3: (3.10 pode iniciar paralelo a Wave 2)
  3.10 (Settings Skeleton) → 3.11 (Fit Score Config) → 3.13 (Fit Score Engine) → 3.14 (Leads Score)
                           → 3.12 (Campos/Blacklist/ABM/Acesso)

Wave 4: (depende de Wave 1-2 concluídas)
  3.15 (Ligações)
  3.16 (Estatísticas) — depende de 3.10 (loss_reasons) para chart motivos de perda
  3.17 (Power Dialer) — depende de 3.8 (tela execução)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Navegação top bar quebra layout mobile | Alto | Testar responsividade antes de mergear 3.1 |
| Drag & drop cadence builder complexo | Alto | Usar dnd-kit (lib testada), POC antes de implementar |
| Fit Score recalc pesado em orgs grandes | Médio | Background job, batch processing, debounce |
| VoIP integration scope creep | Alto | Manter como placeholder até epic dedicado |
| Migration com muitas tabelas novas | Médio | Migrations incrementais por story, rollbacks |
| Dashboard charts performance | Médio | Server-side aggregation, não carregar todos os dados client-side |
| Story 3.9 evolui componente existente | Médio | Verificar regressão no ActivityExecutionSheet atual |

## Rollback Plan

- Cada wave é independente — pode ser revertida sem afetar outras
- Migrations possuem rollback em `supabase/rollbacks/`
- Feature flags para desabilitar novas telas se necessário
- Story 3.1 (navegação) é a mais arriscada — testar extensivamente antes de merge

---

## Definition of Done

- [ ] Todas as 17 stories completed com AC met
- [ ] Navegação, dashboard, cadências, execução, leads, ajustes, ligações, estatísticas replicam o Meetime
- [ ] Design system Flux (cores próprias, não verde Meetime)
- [ ] Testes unitários para novas features
- [ ] CodeRabbit: 0 CRITICAL, 0 HIGH em cada story
- [ ] Lint + typecheck + build passando
- [ ] Responsivo (desktop + mobile)
- [ ] RLS policies em todas as novas tabelas
- [ ] Sem regressão em funcionalidades existentes

---

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-02-21 | @pm (Morgan) | Epic criado — 13 stories, 4 waves |
| 2026-02-21 | @po (Pax) | Validação GO Condicional — 7 ajustes identificados |
| 2026-02-21 | @po (Pax) | Ajustes aplicados: 3.2 split (3.2/3.3/3.4), 3.9 split (3.10/3.11/3.12), Wave 3 reordenada, IN/OUT adicionado, story points, GWT em stories complexas, CodeRabbit gate, dependency graph |

---

## Story Manager Handoff

"Please develop detailed user stories for this epic. Key considerations:

- This is a brownfield enhancement to Flux (Next.js 16 + Supabase + Tailwind)
- Integration points: existing auth, leads, cadences, activities, dashboard features
- Follow existing feature module pattern (`src/features/{name}/`)
- Server Actions with `ActionResult<T>` for all mutations
- RLS policies on all new tables
- Each story must verify existing functionality remains intact
- Wave order and dependency graph must be respected
- Stories already have AC, IN/OUT, and points — SM should add technical details and Given/When/Then where still using checkboxes
- Total: 17 stories, 94 story points, 4 waves

The epic should maintain system integrity while transforming Flux into a Meetime-equivalent Sales Engagement platform."

— Pax, equilibrando prioridades 🎯
