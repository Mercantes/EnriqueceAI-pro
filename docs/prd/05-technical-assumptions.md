# Technical Assumptions

## Repository Structure: Monorepo

Monorepo com Next.js — frontend e API routes no mesmo projeto. Supabase como backend-as-a-service elimina a necessidade de um serviço backend separado.

```
flux/
├── src/
│   ├── app/            # Next.js App Router (pages, layouts)
│   ├── components/     # UI components (shadcn/ui)
│   ├── lib/            # Business logic, utils, API clients
│   ├── services/       # Integrações externas (Lemit, WhatsApp, Gmail, CRM)
│   ├── hooks/          # Custom React hooks
│   └── types/          # TypeScript type definitions
├── supabase/
│   ├── migrations/     # Database migrations
│   ├── functions/      # Edge Functions (webhooks, crons, IA)
│   └── seed/           # Seed data
├── docs/               # PRD, architecture, stories
├── tests/              # Test files
└── public/             # Static assets
```

## Service Architecture

**Monolith com Supabase Edge Functions** — a aplicação principal roda em Next.js (App Router) com server actions e API routes. Processamentos assíncronos (enriquecimento em batch, disparo de cadências, geração de IA) são tratados por Supabase Edge Functions com filas via pg_cron ou Supabase Queues.

**Integrações externas via service layer:**

| Serviço | Propósito | Tipo |
|---------|-----------|------|
| Lemit (ou similar) | Enriquecimento CNPJ | REST API |
| WhatsApp Business API | Envio/recebimento de mensagens | REST API + Webhooks |
| Gmail API | Envio de emails, tracking | OAuth2 + REST API |
| HubSpot/Pipedrive/RD Station | Sync de leads e atividades | REST API + Webhooks |
| Google Calendar API | Agendamento de reuniões | OAuth2 + REST API |
| Claude API | Geração de mensagens com IA | REST API |

## Testing Requirements

- **Unit tests:** Lógica de negócio, services, utils (Vitest)
- **Integration tests:** Fluxos críticos — importação + enriquecimento, criação de cadência, disparo de mensagem (Vitest + Supabase local)
- **E2E:** Apenas para fluxos core do MVP na fase final (Playwright)
- **Coverage goal:** 70% para services/lib, 50% geral no MVP

## Additional Technical Assumptions and Requests

- **Auth:** Supabase Auth com email/password + Google OAuth. Row Level Security (RLS) para isolamento multi-tenant por organização
- **Estado global:** Zustand para estado do cliente, React Query (TanStack Query) para server state e cache
- **UI Components:** shadcn/ui + Tailwind CSS — componentes acessíveis e customizáveis
- **IA Provider:** Claude API (Anthropic) como provider primário para geração de mensagens, com abstração para trocar provider se necessário
- **Filas:** Supabase Edge Functions + pg_cron para jobs agendados (disparo de cadências, batch enrichment)
- **Real-time:** Supabase Realtime para atualizações live no dashboard (status de enriquecimento, respostas de leads)
- **Deploy:** Vercel (Next.js) + Supabase Cloud. CI/CD via GitHub Actions
- **Monitoramento:** Sentry para error tracking, Supabase Dashboard para métricas de banco
- **LGPD:** Consentimento de dados, direito ao esquecimento, logs de acesso a dados pessoais
