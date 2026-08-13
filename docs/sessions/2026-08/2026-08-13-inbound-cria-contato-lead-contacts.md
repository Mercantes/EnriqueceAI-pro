<!-- Título do PR: fix(inbound): cria contato principal em lead_contacts ao ingerir lead inbound -->
<!-- Branch: fix/inbound-lead-primary-contact → main -->
<!-- PR #296 — mergeado (squash b4532d71) — deploy confirmado em prod -->

## Problema

Leads criados via **Inbound** (webhook/API) apareciam com o card **"Contatos"**
vazio (só o formulário "Adicionar"). Exemplo relatado: **Filipe Vaccas**
(`249112a8-8ef0-4f93-b6af-e059081b4271`), origem `Blackbox`.

Causa-raiz: o fluxo inbound (`ingestSingleLead` em
`src/features/inbound-api/services/inbound-lead.service.ts`) grava
nome/e-mail/telefone **direto nas colunas de `leads`**, mas o painel lê de
`lead_contacts`. ⭐ O trigger `trg_sync_primary_contact` só espelha
**`lead_contacts → leads`** (nunca o inverso), e o backfill da migration
`20260811130000_lead_contacts.sql` rodou **uma única vez**. Logo, todo lead
inbound criado depois daquela migration ficava sem linha em `lead_contacts`.

## O que este PR faz

Novo helper `createPrimaryContact()` no mesmo service, chamado **logo após**
inserir o lead. Cria o contato principal em `lead_contacts` no mesmo formato
jsonb que a UI usa:

- `is_primary = true`
- `emails`: usa o array `emails[]` se veio estruturado; senão converte o
  `email` único em `[{tipo:'corporativo', email}]`
- `phones`: converte `telefone` em `[{tipo:'celular', numero}]`
- `first_name/last_name/job_title` com `NULLIF(btrim(...), '')`
- **Awaited e não-fatal**: se a criação do contato falhar, loga e **não**
  derruba a criação do lead (o lead já existe).

Teste `inbound-lead.service.test.ts` atualizado para a chamada extra a `from`
(4 chamadas: limit check + find + insert lead + insert contato).

### Escopo / fora do escopo

- ✅ Caminho `created` (lead inbound novo).
- ❌ Duplicado atualizado (`on_duplicate=update` → `updateExistingLead`) **não**
  cria contato — a maioria dos duplicados já tem contato do backfill original.
  Se necessário no futuro, é outro ponto a tocar.

## Backfill em produção (executado via Supabase MCP — projeto `dhkmonctyoaenejemkrt`)

Regularizou os leads órfãos que já existiam (criados antes do fix):

| Grupo | Contatos criados |
|---|---|
| Inbound órfãos | 13 |
| Outbound órfãos | 11 |
| **Total** | **24** |

- Diagnóstico inicial: 32 leads órfãos; 24 com dado de contato, 8 totalmente
  vazios (sem nome/e-mail/telefone) → **corretamente ficam sem contato**
  (nada a criar), igual aos 8 casos que a migration original também deixou.
- Validação 1→lote: rodei primeiro só o Filipe, conferi o contato + colunas
  espelhadas do lead + `email_bounced_at`/`whatsapp_invalid_at` intactos, depois
  o restante.
- Mesma lógica de construção jsonb do backfill original da migration.

**Backup (NÃO dropar):** `public._bkp_lead_contacts_inbound_backfill_20260813`
(24 linhas `contact_id` + `lead_id`). Reversão:

```sql
DELETE FROM public.lead_contacts
WHERE id IN (SELECT contact_id FROM public._bkp_lead_contacts_inbound_backfill_20260813);
```

## Verificação

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm exec vitest run` do service ✅ (2/2)
- CI **Lint · Typecheck · Test · Build** ✅ `pass` (4m15s) antes do merge
- **Deploy confirmado em prod:** `GET app.enriqueceai.com.br/api/version` →
  `commit=b4532d71` (== head da `main`), ~2 min após o merge.
- Dado do painel confirmado na fonte (query igual à `listLeadContacts`): o
  Filipe retorna 1 contato principal (Decisor · filipe@orkan.com.br · celular).
  Confirmação foi no banco, **não** com print do painel logado.

## Status

- PR **#296** mergeado na `main` (squash `b4532d71`, branch deletada)
- **No ar em produção** (confirmado via `/api/version`)
- A partir de agora todo lead inbound novo cria o contato principal
  automaticamente — sem intervenção manual no painel.
