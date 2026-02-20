# Epic 3: Cadences & Messaging Channels

**Goal:** Construir o motor de cadências lineares com suporte a Email (Gmail) e WhatsApp, incluindo sistema de templates com variáveis dinâmicas, engine de execução automatizada e tracking completo de interações.

## Story 3.1 — Cadence & Template Data Model

> As a **developer**,
> I want to have the cadence, steps and templates schema structured,
> so that the cadence engine has a robust data foundation.

**Acceptance Criteria:**

1. Tabela `cadences` (id, org_id, name, description, status, total_steps, created_by, created_at, updated_at)
2. Tabela `cadence_steps` (id, cadence_id, step_order, channel, template_id, delay_days, delay_hours, created_at)
3. Tabela `cadence_enrollments` (id, cadence_id, lead_id, current_step, status, enrolled_at, completed_at, enrolled_by)
4. Tabela `message_templates` (id, org_id, name, channel, subject, body, variables_used[], is_system, created_by, created_at, updated_at)
5. Tabela `interactions` (id, org_id, lead_id, cadence_id, step_id, channel, type, message_content, external_id, metadata, created_at)
6. Índices para consultas frequentes
7. RLS policies: todas as tabelas isoladas por org_id
8. Constraint: lead não pode estar inscrito duas vezes na mesma cadência ativa
9. Migrations versionadas
10. Testes de constraints e RLS

## Story 3.2 — Message Template System

> As a **SDR**,
> I want to create and manage message templates with dynamic variables,
> so that I can reuse personalized messages in my cadences.

**Acceptance Criteria:**

1. Página `/templates` com lista organizada por canal
2. Editor de template com campos: nome, canal, assunto (email), corpo
3. Sistema de variáveis dinâmicas com sintaxe `{{variavel}}`
4. Inserção de variável via dropdown/autocomplete
5. Preview da mensagem renderizada com dados de um lead real
6. CRUD completo: criar, editar, duplicar, deletar
7. Templates de sistema pré-criados: 3 para email, 3 para WhatsApp
8. Validação: email requer subject, WhatsApp respeita limite de caracteres
9. Filtro e busca por nome/canal
10. Testes para renderização de variáveis

## Story 3.3 — Cadence Builder UI

> As a **SDR**,
> I want to create cadences with a visual sequence of steps,
> so that I can easily define the contact flow with my leads.

**Acceptance Criteria:**

1. Página `/cadences` com lista de cadências
2. Página `/cadences/new` com construtor visual linear
3. Cada passo exibe: número, ícone do canal, template, delay
4. Adicionar passo: selecionar canal → template → delay
5. Reordenar passos via drag-and-drop
6. Remover passo com confirmação
7. Preview visual da timeline completa
8. Salvar como draft ou ativar imediatamente
9. Editar cadência existente (somente draft ou pausada)
10. Mínimo de 2 passos para ativar
11. Inscrever leads na cadência (individual ou batch)
12. Testes para criação, reordenação e validações

## Story 3.4 — Gmail Integration (OAuth2)

> As a **SDR**,
> I want to connect my Gmail account to the platform,
> so that cadence emails are sent from my own address.

**Acceptance Criteria:**

1. Página `/settings/integrations` com card "Gmail" e botão "Conectar"
2. Fluxo OAuth2 completo
3. Tokens armazenados criptografados no Supabase
4. Refresh automático do token
5. Service `EmailService` com método `sendEmail()`
6. Suporte a HTML no corpo do email
7. Tracking de abertura via pixel invisível
8. Tracking de cliques via redirect de links
9. Status da conexão visível
10. Botão "Desconectar" com confirmação
11. Tratamento de bounces via Gmail API
12. Testes unitários com mock da Gmail API

## Story 3.5 — WhatsApp Business API Integration

> As a **SDR**,
> I want to connect WhatsApp Business to the platform,
> so that cadence messages are sent via WhatsApp automatically.

**Acceptance Criteria:**

1. Card "WhatsApp Business" na página de integrações
2. Configuração via Meta Cloud API: Phone Number ID, Business Account ID, Access Token
3. Tokens armazenados criptografados
4. Service `WhatsAppService` com método `sendMessage()`
5. Suporte a mensagens de texto livre e template messages
6. Webhook endpoint para status de entrega
7. Atualização automática de `interactions` via webhook
8. Validação de número de telefone (formato brasileiro)
9. Rate limits com queue e retry
10. Status da conexão visível
11. Testes unitários com mock da Meta API

## Story 3.6 — Cadence Execution Engine & Interaction Tracking

> As a **SDR**,
> I want cadences to automatically execute steps at the right time,
> so that I don't need to remember to send each message manually.

**Acceptance Criteria:**

1. Edge Function `execute-cadence-steps` via pg_cron a cada 15 minutos
2. Busca enrollments ativos onde o delay foi atingido
3. Renderiza template com variáveis do lead e despacha via canal correto
4. Registra interação na tabela `interactions`
5. Avança `current_step` após envio bem-sucedido
6. Marca enrollment como `completed` quando todos os passos executados
7. Marca como `replied` se resposta detectada
8. Pausa automática se bounce ou falha
9. Timeline de atividades no perfil do lead (substitui placeholder do Epic 2)
10. Métricas por cadência: leads inscritos, em progresso, completados, responderam, bounce rate
11. Logs de execução para debugging
12. Testes para scheduling, renderização e estado do enrollment
