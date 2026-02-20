# Epic 1: Foundation & Authentication

**Goal:** Estabelecer a infraestrutura completa do projeto (Next.js + Supabase), implementar autenticação segura, multi-tenancy com RLS e gestão de usuários com o modelo 3 SDRs + 1 gerente. Ao final deste épico, um time pode criar conta, acessar a plataforma e gerenciar seus membros.

## Story 1.1 — Project Setup & Base Configuration

> As a **developer**,
> I want to have the project configured with Next.js, Supabase, Tailwind and shadcn/ui,
> so that we have the technical foundation ready for development.

**Acceptance Criteria:**

1. Projeto Next.js (App Router) inicializado com TypeScript strict mode
2. Supabase configurado (projeto local via CLI + projeto cloud linkado)
3. Tailwind CSS + shadcn/ui instalados e configurados com tema base
4. Estrutura de pastas conforme definido na arquitetura
5. ESLint + Prettier configurados com regras do preset nextjs-react
6. Vitest configurado com um teste placeholder passando
7. Variáveis de ambiente configuradas (`.env.local` + `.env.example`)
8. Sentry configurado para error tracking (básico)
9. `README.md` com instruções de setup local

## Story 1.2 — Authentication & User Registration

> As a **user**,
> I want to sign up and log in with email/password or Google,
> so that I can access the platform securely.

**Acceptance Criteria:**

1. Página de cadastro com formulário (nome, email, senha) usando Supabase Auth
2. Página de login com email/senha
3. Botão "Entrar com Google" funcional (OAuth2 via Supabase)
4. Página de recuperação de senha (forgot password flow)
5. Middleware de proteção de rotas — usuários não autenticados redirecionados para `/login`
6. Sessão persistente com refresh token automático
7. Botão de logout funcional com limpeza de sessão
8. Validação de campos no formulário (email válido, senha mínima 8 caracteres)
9. Testes unitários para validações e testes de integração para o fluxo auth

## Story 1.3 — Multi-tenant Organization System

> As a **newly registered user**,
> I want an organization to be created automatically upon signup,
> so that my team has an isolated and secure space on the platform.

**Acceptance Criteria:**

1. Tabela `organizations` criada no Supabase (id, name, slug, created_at, owner_id)
2. Tabela `organization_members` (org_id, user_id, role, invited_at, accepted_at)
3. Organização criada automaticamente no signup via database trigger ou server action
4. RLS policies implementadas: usuários só acessam dados da própria organização
5. Context provider `OrganizationContext` disponível em toda a aplicação
6. Tela de configuração básica da organização (editar nome)
7. Migration files versionados em `supabase/migrations/`
8. Testes para RLS policies (usuário A não acessa dados da org B)

## Story 1.4 — User Management & Roles

> As a **manager**,
> I want to invite SDRs to my organization and manage their access,
> so that my team can use the platform with appropriate permissions.

**Acceptance Criteria:**

1. Dois roles implementados: `manager` (gerente) e `sdr` (vendedor)
2. O criador da organização recebe automaticamente o role `manager`
3. Tela de gestão de usuários acessível apenas por `manager`
4. Funcionalidade de convite por email (envio de invite link via Supabase)
5. Modelo base: 3 SDRs + 1 gerente incluídos — validação de limite no backend
6. Ao exceder o limite, exibir mensagem informando necessidade de upgrade (placeholder para billing)
7. Lista de membros com status (ativo, pendente, desativado)
8. Manager pode desativar/reativar um membro
9. RLS policies para role-based access (manager vê tudo da org, SDR vê apenas seus dados)
10. Testes para permissões por role

## Story 1.5 — Application Shell & Navigation

> As an **authenticated user**,
> I want to see a professional layout with clear navigation,
> so that I can access all platform features easily.

**Acceptance Criteria:**

1. Layout principal com sidebar colapsável (ícones + labels)
2. Itens de navegação: Dashboard, Leads, Cadências, Templates, Integrações, Configurações
3. Header com nome do usuário, org ativa e menu dropdown (perfil, configurações, logout)
4. Layout responsivo — sidebar vira drawer em mobile
5. Breadcrumbs para navegação contextual
6. Página Dashboard com cards placeholder (métricas vazias, call-to-action para importar leads)
7. Skeleton loaders para transições de página
8. Tema visual aplicado: paleta azul/roxo, tipografia Inter, ícones Lucide
9. Dark mode toggle (opcional mas preparado no tema)
10. Testes de snapshot para componentes do shell
