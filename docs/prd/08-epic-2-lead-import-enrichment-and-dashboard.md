# Epic 2: Lead Import, Enrichment & Dashboard

**Goal:** Permitir que o usuário importe leads em massa via CSV/CNPJ, enriqueça automaticamente com dados firmográficos e de contato via Lemit, e visualize tudo em um dashboard inteligente com filtros avançados. Este é o primeiro momento de valor real da plataforma.

## Story 2.1 — Lead Database Schema & Data Model

> As a **developer**,
> I want to have the lead schema structured in Supabase,
> so that all lead features have a solid data foundation.

**Acceptance Criteria:**

1. Tabela `leads` criada (id, org_id, cnpj, status, razao_social, nome_fantasia, endereco, porte, cnae, situacao_cadastral, email, telefone, socios, faturamento_estimado, enrichment_status, enriched_at, created_by, created_at, updated_at)
2. Tabela `lead_imports` (id, org_id, file_name, total_rows, processed_rows, success_count, error_count, status, created_by, created_at)
3. Tabela `lead_import_errors` (id, import_id, row_number, cnpj, error_message)
4. Índices para consultas frequentes: org_id, cnpj, status, enrichment_status, cnae, porte
5. RLS policies: leads isolados por organização
6. Enum types para status e enrichment_status
7. Constraint de unicidade: CNPJ único por organização
8. Migrations versionadas em `supabase/migrations/`
9. Seed data com 20 leads de exemplo para desenvolvimento
10. Testes de RLS e constraints

## Story 2.2 — CSV Import & CNPJ Parsing

> As a **SDR**,
> I want to import a CSV file with prospect CNPJs,
> so that I can register leads in bulk without manual entry.

**Acceptance Criteria:**

1. Página `/leads/import` com drag-and-drop zone para upload de CSV
2. Parser que aceita CSV com coluna CNPJ (detecta automaticamente)
3. Validação de CNPJ (dígitos verificadores) antes de criar o lead
4. Preview dos dados parseados antes da confirmação (primeiras 10 linhas)
5. Indicador de progresso durante o processamento
6. Relatório pós-importação: total importados, duplicados ignorados, CNPJs inválidos
7. Leads criados com status `new` e enrichment_status `pending`
8. Registro na tabela `lead_imports` com estatísticas
9. Erros registrados em `lead_import_errors` com número da linha e motivo
10. Limite de 1.000 leads por importação
11. Testes unitários para parser CSV e validação de CNPJ

## Story 2.3 — CNPJ Enrichment Service

> As a **SDR**,
> I want imported leads to be automatically enriched with company data,
> so that I have complete information without manual research.

**Acceptance Criteria:**

1. Service layer `EnrichmentService` com abstração para múltiplos providers e estratégia em camadas: Camada Básica (CNPJ.ws/ReceitaWS — dados cadastrais gratuitos) e Camada Contato (Lemit — emails, telefones, sócios, faturamento — plano Pro+)
2. Integração com CNPJ.ws (gratuito, rate limited 3 req/min) como provider default e Lemit como provider premium
3. Enriquecimento automático disparado após importação (batch via Edge Function)
4. Rate limiting respeitando limites da API do provider
5. Retry com backoff exponencial (max 3 tentativas)
6. Atualização do lead com dados retornados
7. Status do lead atualizado para `enriched` ou `enrichment_failed`
8. Tempo de enriquecimento individual < 5 segundos (NFR2)
9. Progresso do batch visível em real-time via Supabase Realtime
10. Log de consumo de créditos de API por organização
11. Testes unitários com mock da API Lemit

## Story 2.4 — Lead List with Filters & Bulk Actions

> As a **SDR**,
> I want to view all my leads in a table with advanced filters,
> so that I can quickly find the most relevant prospects.

**Acceptance Criteria:**

1. Página `/leads` com tabela de dados
2. Colunas: nome fantasia, CNPJ, porte, CNAE/segmento, cidade/estado, status, enrichment_status, data de importação
3. Filtros por: porte, segmento/CNAE, estado/cidade, status, enrichment_status
4. Busca textual por razão social, nome fantasia ou CNPJ
5. Ordenação por qualquer coluna
6. Paginação server-side (20 leads por página)
7. Bulk actions: selecionar múltiplos → enriquecer novamente, arquivar, exportar CSV
8. Badge visual para enrichment_status
9. Click na linha navega para o perfil do lead
10. Estado dos filtros persistido na URL (query params)
11. Empty state com CTA para importar primeiro CSV
12. Testes para filtros, paginação e bulk actions

## Story 2.5 — Lead Profile Detail

> As a **SDR**,
> I want to see the complete profile of a lead with all enriched data,
> so that I have full context before starting an approach.

**Acceptance Criteria:**

1. Página `/leads/[id]` com layout em seções organizadas
2. Seção Dados da Empresa: razão social, nome fantasia, CNPJ, endereço, porte, CNAE, situação cadastral, faturamento
3. Seção Contatos: emails, telefones, lista de sócios com CPF parcial (LGPD)
4. Seção Status: status atual, badge de enrichment, datas
5. Seção Timeline de Atividades: placeholder para futuras interações
6. Botão "Re-enriquecer" para forçar novo enriquecimento
7. Botão "Editar" para correção manual
8. Botão "Arquivar" com confirmação
9. Breadcrumb: Leads → [Nome do Lead]
10. Testes para renderização do perfil

## Story 2.6 — Dashboard & Import Metrics

> As a **manager**,
> I want to see a dashboard with lead and import metrics,
> so that I have visibility into my team's prospect base.

**Acceptance Criteria:**

1. Página `/dashboard` substituindo o placeholder do Epic 1
2. Card Total de Leads — contagem por status
3. Card Importações Recentes — últimas 5 com status e taxa de sucesso
4. Card Enriquecimento — taxa de sucesso, leads pendentes, créditos consumidos
5. Card Leads por Porte — gráfico de barras ou donut
6. Card Leads por Estado — distribuição geográfica
7. Filtro de período (7d, 30d, 90d, custom)
8. Dados atualizados em real-time via Supabase Realtime
9. Responsivo — cards reorganizam em grid no mobile
10. Skeleton loaders durante carregamento
11. Testes para cálculos de métricas
