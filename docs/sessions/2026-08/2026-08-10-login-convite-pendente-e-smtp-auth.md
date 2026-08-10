# Sessão 2026-08-10 — Convite pendente no login + pendência de SMTP do Supabase Auth

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Chamado: `joao.fogaca@v4company.com` não conseguia logar ("credenciais inválidas"). Diagnóstico: a conta estava como **convite pendente** (`organization_members.status = 'invited'`, `auth.users.encrypted_password` vazio, e-mail não confirmado, nunca logou) — criada no mesmo dia às 13:53. O usuário tentava logar sem nunca ter aceitado o convite/definido senha.

Reenviei o convite via Auth Admin API (mesmo `inviteUserByEmail` do botão da UI) → João aceitou, definiu senha e **logou às 14:07** (`status='active'`). Caso resolvido.

A causa **sistêmica** é que os e-mails de **Auth** (convite de membro, reset de senha) saem pelo **SMTP do Supabase Auth**, que **não está configurado com provedor próprio** → cai no SMTP padrão do Supabase (rate limit baixo + entrega ruim/spam, marcado "não use em produção"). É diferente dos e-mails do app (Resend + Gmail), que funcionam bem.

Entregue nesta sessão: a **rede de segurança de UX** (aviso de convite pendente no login). A **correção de raiz (SMTP)** ficou como pendência do dono do produto (config de painel).

## O que entrou na `main` (PRs)

| PR | Commit | Conteúdo |
|----|--------|----------|
| #255 | `845a737` | aviso de convite pendente no login + reenvio de convite na tela |

## Mudança (#255)

Quando um convidado (`status='invited'`, sem senha) tenta logar, em vez do genérico "Invalid login credentials" o login mostra **"Você tem um convite pendente…"** com botão **"Reenviar convite"**.

- **Migration `20260810143000_find_pending_invite_by_email.sql`** — função `SECURITY DEFINER` **read-only** que localiza convite `invited` por e-mail (`auth.users` × `organization_members`), retornando só `member_id`/`user_id`. `REVOKE` de `anon`/`authenticated`, `GRANT EXECUTE` só a `service_role`. **Já aplicada no banco de produção via MCP** e versionada no PR (em sincronia).
- **`src/features/auth/services/pending-invite.ts`** — `findPendingInviteByEmail()`; degradação graciosa (nunca lança; retorna `null` em qualquer falha, inclusive se a função não existir).
- **`src/features/auth/actions/sign-in.ts`** — em falha de credencial, checa convite pendente e retorna código `INVITE_PENDING` (novo `ERR_INVITE_PENDING` em `error-codes.ts`).
- **`src/features/auth/actions/resend-invite-by-email.ts`** — reenvio **público** (sem sessão de manager), com **rate limit por IP** (`RESEND_LIMIT`/`RESEND_WINDOW_MS`) e **resposta neutra** (anti-enumeração de usuários). Reseta `invited_expires_at` (+7d).
- **`src/features/auth/components/LoginForm.tsx`** — painel condicional de convite pendente + botão de reenvio; input de e-mail passou a ser controlado.

⭐ **Lição:** arquivo `'use server'` **só pode exportar funções async** — um `export` de string constante derrubava a página inteira com error boundary. Peguei na verificação de browser (não aparece no typecheck). Ver também `src/lib/auth/user-directory.ts`: helper análogo que lê `auth.users` via admin client **sem** `import 'server-only'` (esse import quebra o Vitest).

## Verificação / merge

`pnpm typecheck` ✅ · `pnpm lint` ✅ · **58 testes de auth** ✅. Função validada via SQL (sem falso positivo; JOIN e filtro `status='invited'` corretos; case-insensitive/trim). Browser: login sem convite + senha errada → erro genérico, sem falso painel e sem quebra. CI (`Lint · Typecheck · Test · Build`) **verde** → squash-merge, branch apagada.

## Pendência principal — configurar SMTP próprio no Supabase Auth (correção de raiz)

**Por quê:** sem SMTP próprio, todo convite/reset depende do SMTP padrão do Supabase (rate limit + spam). O aviso no login apenas mitiga o sintoma.

**Como (painel do Supabase, projeto `dhkmonctyoaenejemkrt`):** reaproveitar o **Resend** (domínio `enriqueceai.com.br` já verificado e enviando `noreply@enriqueceai.com.br`).

1. **Authentication → Emails → SMTP Settings → Enable Custom SMTP:**
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: a **mesma `RESEND_API_KEY`** que já está no Coolify
   - Sender email: `noreply@enriqueceai.com.br`
   - Sender name: `EnriqueceAI`
2. **Authentication → Rate Limits:** elevar "Emails per hour" (ex.: 100/h).
3. **Authentication → URL Configuration → Redirect URLs:** garantir `https://app.enriqueceai.com.br/**` (ou ao menos `/api/auth/confirm`).
4. (opcional) **Email Templates → "Invite user":** revisar copy/CTA de criação de senha.
5. **Validar:** convidar um e-mail de teste e conferir no painel do Resend se o e-mail saiu.

## Dívida técnica pequena (não bloqueante)

- `INVITE_EXPIRY_DAYS` está **duplicado**: definido localmente em `src/features/auth/actions/resend-invite.ts:12` em vez de importar de `@/lib/constants/limits` (como fazem `invite-member.ts` e a nova `resend-invite-by-email.ts`).

## Fluxo de convite (referência)

`inviteMember`/`resendInvite` → `admin.auth.admin.inviteUserByEmail(email, { redirectTo: .../api/auth/confirm })` → link no e-mail → `src/app/api/auth/confirm/route.ts` (cria sessão + `acceptPendingInvite` → `status='active'`) → redirect `/setup-password` → `updateUser({ password })` → logável.
