<!-- Validação (sem mudança de código) — sequência dos PRs #296 e #306 -->
<!-- Pergunta: os contatos criados são "pegos" nas tarefas de ligação? -->
<!-- Resposta: SIM — validado com dados reais da fila (100% cobertura) -->

## Contexto

Sequência da correção "contato para qualquer canal" (PRs #296 inbound + #306
trigger `trg_create_primary_contact`). Pergunta do usuário: **os contatos criados
em `lead_contacts` são efetivamente usados nas tarefas de ligação?** Esta sessão é
de **validação** — nenhuma mudança de código.

## Como o contato entra na tarefa de ligação (caminho no código)

No sheet de execução da atividade (canais `phone`/`whatsapp`),
`src/features/activities/components/ActivityExecutionSheetContent.tsx:72` carrega
os contatos via `listLeadContacts(lead.id)` e monta a lista de telefones com
`buildContactPhones(contacts, lead)`
(`src/features/activities/utils/resolve-whatsapp-phone.ts:169`):

- **Com contato:** cada número aparece **atribuído** — rótulo
  `Nome · Cargo — Tipo <numero>` — com `contactId` preenchido. Ao discar, a
  ligação grava `contact_id` (FK em `calls`/`interactions`), alimentando histórico
  e métrica por contato.
- **Sem contato (fallback):** cai em `getAllLeadPhones` (lê `lead.telefone`,
  `lead.phones`, sócios) — comportamento legado.

⭐ Nuance importante: o número **já era discável antes** do contato existir (via o
fallback `lead.telefone`). O que a criação do contato **adiciona** é a
**atribuição** (número nomeado + `contact_id` na ligação), não o desbloqueio da
discagem. O ganho que faltava era a atribuição correta.

## Validação com dados reais (produção `dhkmonctyoaenejemkrt`)

Fila real = enrollments `active` cujo `cadence_steps.channel = 'phone'` no
`current_step`.

| Métrica | Valor |
|---|---|
| Leads com passo de telefone ativo (fila) | **555** |
| Com contato principal **com telefone** | **555 (100%)** |
| Sem nenhum contato | **0** |
| Contato sem telefone, mas lead tem telefone | **0** |

Rastreio item a item no topo da fila (amostra): Fox Conect → Gregori
(Sócio-Administrador) `555496125101` = `lead.telefone`; J.C.Martins → Jean Carlos
(CEO) `67992396181`; Pedrinho Veículos → Pedro Almeida (Decisor) `43 9857-8614`.
Todos batem; o `lead.telefone` deduplica contra o número do contato (não duplica).

## Conclusão

Resolvido de ponta a ponta: os contatos criados são pegos nas tarefas de ligação,
**atribuídos corretamente**, em **100%** da fila de telefone via cadência.
Nenhuma ação de código necessária.

## Escopo / pendências

- Validado a fila de **telefone via cadência** (555 leads). Tarefas de ligação
  avulsas/manuais ou de outra origem não foram cobertas nesta checagem — estender
  se necessário.
- Backfills anteriores mantêm a cobertura dos leads já existentes; a trigger
  garante os novos de qualquer canal.
