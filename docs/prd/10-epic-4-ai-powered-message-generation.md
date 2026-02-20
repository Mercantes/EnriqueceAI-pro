# Epic 4: AI-Powered Message Generation

**Goal:** Integrar a Claude API para geração de mensagens personalizadas por canal, utilizando o perfil enriquecido do lead como contexto. O SDR pode gerar, revisar e editar mensagens com IA em segundos.

## Story 4.1 — AI Service Layer & Prompt Engineering

> As a **developer**,
> I want to have an AI service layer with optimized prompts for sales engagement,
> so that message generation is consistent, high-quality and easy to evolve.

**Acceptance Criteria:**

1. Service `AIService` com abstração de provider (Claude API como default)
2. Client Claude API via Edge Function (key não exposta no client)
3. Endpoint `/api/ai/generate-message`
4. Prompt template para email otimizado para outbound B2B
5. Prompt template para WhatsApp (tom direto, limite de caracteres)
6. 4 opções de tom: profissional, consultivo, direto, amigável
7. Context injection com dados enriquecidos do lead
8. Validação e sanitização de output
9. Rate limiting por organização (tabela `ai_usage`)
10. Latência de geração < 3 segundos
11. Testes com mock da Claude API

## Story 4.2 — Lead Message Generation UI

> As a **SDR**,
> I want to generate a personalized message with AI from a lead's profile,
> so that I create relevant approaches in seconds.

**Acceptance Criteria:**

1. Botão "Gerar mensagem com IA" no perfil do lead
2. Modal de geração: seleção de canal, tom, contexto adicional
3. Botão "Gerar" com loading skeleton
4. Mensagem gerada exibida em preview formatado
5. Edição inline da mensagem gerada
6. Botão "Regenerar" para nova versão
7. Botão "Salvar como template"
8. Botão "Copiar" para clipboard
9. Botão "Usar em cadência"
10. Contador de uso de IA visível
11. Testes para fluxo de geração e edição

## Story 4.3 — Cadence AI Personalization (Batch)

> As a **SDR**,
> I want AI to automatically personalize cadence messages for each enrolled lead,
> so that each prospect receives a unique message even from the same base template.

**Acceptance Criteria:**

1. Toggle "Personalizar com IA" em cada step da cadência
2. Execution engine chama AIService antes de enviar quando ativado
3. IA gera versão personalizada mantendo estrutura e CTA do template
4. Mensagem salva com `ai_generated: true` e `original_template_id`
5. Preview de personalização para 3 leads de amostra
6. Fallback para template original se geração falhar
7. Badge visual indicando steps com IA ativada
8. Métricas comparativas (placeholder): taxa resposta IA vs sem IA
9. Respeita rate limit diário — fallback automático se excedido
10. Testes para fluxo batch e fallback
