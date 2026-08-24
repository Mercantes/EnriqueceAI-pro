# 2026-08-23 — Telefone do Apollo não aparece no lead (dessincronização lead_contacts)

## Contexto

Relato: leads importados do Apollo vindo sem telefone — logo após o import e no painel "Contatos" do detalhe do lead.

## Diagnóstico

- O telefone do Apollo chega **assíncrono via webhook** (`/api/webhooks/apollo`), segundos/minutos após o import. Em produção o webhook **está funcionando** (imports de agosto todos receberam telefone em `leads.telefone/phones`).
- **Bug real:** o webhook atualizava só as colunas do lead; o painel "Contatos" lê `lead_contacts`, que nunca recebia o telefone (o `trg_create_primary_contact` cria o contato no INSERT do lead, antes do webhook, com `phones=[]`; não existe espelhamento leads→contacts em UPDATE).
- **Agravante:** editar o contato dessincronizado disparava `trg_sync_primary_contact`, que sobrescrevia `leads.phones` com `[]` — apagando o telefone revelado.
- Caso confirmado: lead **Romanha Alimentos** (20/ago) — telefone no lead, contato vazio.
- Bugs secundários no mesmo caminho: fallback de match por e-mail filtrava `lead_source='apollo'` (import grava `'Outbound'`/canal `'Apollo'` → nunca casava); idempotência do webhook sem org (`phone_{person_id}`) podia descartar webhook de 2ª org; `mobile_phone` virava "fixo" em `enrich-lead-apollo.ts`/`backfill-apollo-source-id.ts`.

## O que foi feito (branch `fix/apollo-phone-contact-sync`, a partir de origin/main)

- `src/app/api/webhooks/apollo/route.ts` — webhook agora grava o merge de phones no **contato principal** (`lead_contacts`); o `trg_sync_primary_contact` espelha para o lead. Fallback para `UPDATE leads` só quando não há contato (preservando `telefone` existente). Merge une contato + lead + payload (dedupe por número). Fallback por e-mail corrigido para `canal='Apollo'`. Idempotência por org (`phone_{orgId}_{personId}`) e `markEventProcessed` com `orgId`.
- `src/features/leads/services/apollo.service.ts` — helper `apolloPhoneTipo()` (mobile/mobile_phone → celular) usado nos 4 pontos de mapeamento.
- `src/features/leads/actions/backfill-apollo-source-id.ts` — filtro morto `lead_source='apollo'` → `canal='Apollo'`; usa o helper.
- `src/features/leads/actions/enrich-lead-apollo.ts` e `import-apollo-leads.ts` — usam o helper.
- `src/features/leads/components/ApolloImportView.tsx` — aviso na tela de conclusão: telefones chegam de forma assíncrona.
- `src/app/api/webhooks/apollo/route.test.ts` — **novo**, 6 testes (auth, gravação no contato, fallback no lead, filtro canal, idempotência por org, skip de evento processado).

Verificação: `pnpm typecheck` ✅, `pnpm lint` ✅, `vitest src/features/leads` 250 ✅, `vitest src/app/api/webhooks/apollo` 6 ✅.

## Pendências

1. **Backfill em produção** — o classificador do MCP bloqueou o UPDATE; rodar no SQL Editor (1 linha afetada, Romanha):
   ```sql
   UPDATE lead_contacts c
   SET phones = l.phones
   FROM leads l
   WHERE l.id = c.lead_id
     AND c.is_primary
     AND l.deleted_at IS NULL
     AND jsonb_array_length(COALESCE(l.phones,'[]'::jsonb)) > 0
     AND jsonb_array_length(COALESCE(c.phones,'[]'::jsonb)) = 0;
   ```
2. Commit/push/PR — aguardando pedido explícito do usuário.
3. Pós-deploy: importar 1 lead do Apollo e conferir telefone no painel Contatos; SELECT de dessincronização deve retornar 0.

## Follow-ups (fora de escopo)

- Corrida import×webhook (webhook antes do INSERT → telefone perdido; Apollo não reenvia).
- Rate limit na rota pública do webhook.
- `raw_number` vs `sanitized_number` na normalização.
- Aviso na UI quando `APOLLO_WEBHOOK_SECRET` ausente (degrada em silêncio).
