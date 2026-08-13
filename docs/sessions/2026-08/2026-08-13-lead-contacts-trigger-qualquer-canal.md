<!-- Título do PR: fix(leads): cria contato principal em lead_contacts para qualquer canal (trigger) -->
<!-- Branch: fix/lead-contacts-trigger-all-channels → main -->
<!-- PR #306 — mergeado (squash fa8c0d2f) — trigger já em prod via MCP, deploy confirmado -->
<!-- Contexto: sequência do PR #296 (fix inbound app-level), que este PR generaliza e substitui -->

## Problema

O contato em `lead_contacts` só era criado no caminho **inbound** (fix anterior
#296, app-level). Os demais caminhos de criação de lead inseriam direto em
`leads` **sem** criar contato, deixando o painel **"Contatos"** vazio.

Caso relatado: lead **William Oliveira** (`b3300c7a-53e8-4cc4-97a4-ec718fca4ce5`,
`is_inbound=false`, `lead_source='Outbound'`, criação manual) — dados nas colunas
de `leads`, mas card de Contatos vazio.

Mapa dos caminhos que inserem em `leads` (agente de investigação):

| Caminho | Arquivo | Criava contato antes? |
|---|---|---|
| Criação manual | `src/features/leads/actions/create-lead.ts:142` (`createLead`) | ❌ |
| Import CSV | `src/features/leads/actions/import-leads.ts:252` (`importLeads`) | ❌ |
| Import Apollo | `src/features/leads/actions/import-apollo-leads.ts:251` (`importApolloLeads`) | ❌ |
| Inbound API | `src/features/inbound-api/services/inbound-lead.service.ts` | ✅ (#296) |

Causa-raiz: ⭐⭐ a trigger `sync_primary_contact_to_lead` só espelha
**`lead_contacts → leads`** (nunca o inverso), e o backfill da migration
`20260811130000` rodou **uma única vez**.

## Solução — padroniza no banco (qualquer canal)

Migration `20260813190000_create_primary_contact_from_lead_trigger.sql`:
trigger **`trg_create_primary_contact AFTER INSERT ON leads`** (função
`create_primary_contact_from_lead`) cria o contato principal a partir das colunas
do lead:

- `emails`: usa o array estruturado se houver; senão converte `email` →
  `[{tipo:'corporativo', email}]`
- `phones`: usa o array; senão converte `telefone` → `[{tipo:'celular', numero}]`
- Guarda de idempotência (`IF EXISTS` → não duplica) e **skip** quando não há
  nenhum dado de contato (mesma regra do backfill original)
- **Sem loop:** o insert em `lead_contacts` dispara a `sync_primary_contact_to_lead`
  (que faz `UPDATE` em `leads`, não `INSERT`), então não re-dispara esta trigger
  `AFTER INSERT`.

Cobre **todos os canais — presentes e futuros — num único ponto**, em vez de
replicar a lógica em cada action. Validada antes de aplicar com teste em
`ROLLBACK` (insere lead fake → confere contato + espelhamento → desfaz).

## Limpeza de código

Com a trigger, o helper app-level `createPrimaryContact()` do #296 ficou
**redundante** e causaria `23505` (dois `is_primary` no mesmo lead) →
**removido** de `inbound-lead.service.ts`. Teste `inbound-lead.service.test.ts`
revertido para **3 chamadas** a `from` (a criação do contato agora é do banco,
não do app).

## Operação em produção (executada via Supabase MCP — `dhkmonctyoaenejemkrt`)

- Migration **aplicada em produção via MCP** (antes do merge — a correção
  funcional já estava valendo; o merge apenas versiona a migration + limpeza no
  runtime).
- **Backfill** dos leads órfãos existentes (qualquer canal): **72 contatos
  criados** (William + 71 de import manual/CSV/Apollo). **0 órfãos com dado
  restantes.**
- **Backup (NÃO dropar):** `public._bkp_lead_contacts_backfill_allchannels_20260813`.
  Reversão:
  ```sql
  DELETE FROM public.lead_contacts
  WHERE id IN (SELECT contact_id FROM public._bkp_lead_contacts_backfill_allchannels_20260813);
  ```
  (Existe também o backup do 1º backfill inbound: `_bkp_lead_contacts_inbound_backfill_20260813`, 24 linhas.)

## Verificação

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm exec vitest run` do service ✅ (2/2)
- CI **Lint · Typecheck · Test · Build** ✅ `pass` (4m29s) antes do merge
- Trigger `trg_create_primary_contact` (AFTER INSERT) confirmada ativa em prod
- William confirmado com 1 contato principal (Sócio · e-mail corporativo · celular)
- **Deploy confirmado:** `GET app.enriqueceai.com.br/api/version` → `fa8c0d2f`
  (== head da `main`), ~2 min após o merge.

## Status

- PR **#306** mergeado na `main` (squash `fa8c0d2f`, branch deletada)
- **No ar em produção** (trigger via MCP + deploy confirmado)
- A partir de agora, **todo lead novo de qualquer canal** cria o contato
  principal automaticamente — sem intervenção manual no painel.
