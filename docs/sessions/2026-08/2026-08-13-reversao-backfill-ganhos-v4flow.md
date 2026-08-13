<!-- Sessão: reversão do backfill de "Ganhos" no V4 Flow (propagação do incidente Kommo) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Projetos: Kommo (amoCRM) + V4 Sales Hub (ejxlbbbjyexsoltsxiqq) + V4 Flow (rpxulrvqknplgybbvqdl) -->

## Contexto

Continuação do incidente do dia: um **backfill** de "Ganhos" do Enriquece para o
Kommo (10:38–10:56 UTC) moveu **303 deals** para "Venda ganha" (142) no funil
ATIVAÇÃO — incluindo deals **abertos e perdidos**. A causa-raiz é conceitual:
**`status='won'` no Enriquece ("reunião aconteceu") ≠ "venda ganha" no Kommo.**
Kommo e Sales Hub já haviam sido restaurados em etapas anteriores. Esta sessão
tratou a **terceira propagação, ainda não corrigida: o V4 Flow.**

## Sintoma relatado

No V4 Flow, a coluna **"Novo Cliente"** (funil Saber) apareceu com **60 cards** de
clientes que não são clientes (MMPNet Telecom, Máquinas Serotom, etc.), todos com
data 13/08. O menu **Faturamento** também inflado. Pedido: investigar, criar plano,
corrigir.

## Diagnóstico

⭐⭐ **V4 Flow ≠ V4 Sales Hub — são dois bancos Supabase distintos.**
- V4 Flow = `rpxulrvqknplgybbvqdl` (CRM de operação/CS: funis Saber/Executar/Ter/Potencializar/Downsell/Churn).
- Sales Hub = `ejxlbbbjyexsoltsxiqq` (BI espelho do Kommo).

**Como o dano chega:** sync **Kommo→V4 Flow** (n8n `V4FLOW-04.02 Ativação` /
`04.03 Expansão`, webhook → tabela `kommo_sync_log`). Cada deal que entra em **142
(ganho)** materializa um "novo cliente": cria `leads` (cards), `customers`,
`customer_contracts`, `lead_events`, `customer_lifecycle_events`. ⭐ **O sync é
create-only: NÃO reverte** quando o deal sai de ganho — por isso restaurar o Kommo
não desfez nada aqui (0 leads deletados automaticamente).

**Dano medido (janela 10:48–10:56 UTC):**
| Objeto | Qtd hoje |
|---|---|
| Cards (leads) | 117 — Saber/Novo Cliente 60 · Executar/Entrada 52 · Ter/Entrada 5 |
| Deals distintos | 96 (ponte via `kommo_sync_log.lead_id`; `leads.kommo_deal_id` vem nulo) |
| Customers | 85 (todos `is_active=true`) |
| Contratos | 48 (R$330.736 em `valor_mrr`) |
| lead_events / lifecycle / contatos | 131 / 170 / 74 |

**Classificação** (fonte = Sales Hub já restaurado, `deals.status_id`): dos 96 deals,
**87 falsos** (restaurados p/ 143 ou aberto) e **9 "legítimos"** — mas todos ganhos
de **abril**, com customer pré-existente → reentradas duplicadas, **não vendas novas**.

## Decisões (aprovadas pelo usuário)

1. **Método:** soft-delete reversível primeiro; depois **hard-delete** definitivo.
2. **Escopo:** os 3 funis inteiros (117 cards), não só "Novo Cliente".

## Correção aplicada

**Blindagem central:** filtro **`created_at::date = '2026-08-13'`**. Todos os 9
legítimos e as 4 vendas reais de agosto têm customer **pré-existente** → não entram
no filtro. Confirmado: falsos com 0 ad_accounts e 0 investimentos.

**Backups (no próprio banco V4 Flow, não dropar):**
`_bkp_v4flow_leads_20260813` (117) · `_bkp_v4flow_customers_20260813` (85) ·
`_bkp_v4flow_contracts_20260813` (48) · `_bkp_v4flow_lead_events_20260813` (131) ·
`_bkp_v4flow_lifecycle_20260813` (170).

**Passos (via MCP `apply_migration` + SQL Editor no final):**
1. `leads.deleted_at=now()` nos 117 → "Novo Cliente" volta a 0 cards.
2. `customers.is_active=false` nos 85.
3. `customer_contracts.status='encerrado'` nos 48 (saem do MRR ativo).
4. `customers.fee_inicial=0` nos criados hoje → saem do Faturamento.
5. **Hard-delete final (SQL Editor):** nular FKs `kommo_sync_log.customer_id/lead_id`
   (NO ACTION bloqueia), depois `DELETE leads` + `DELETE customers` por
   `created_at=hoje` — **CASCADE** varreu contracts/lifecycle/contatos/teams/roles/
   lead_events/comments; e limpeza de contatos órfãos.

## Antes × Depois (V4 Flow)

| Métrica | Antes | Depois |
|---|---|---|
| Cards "Novo Cliente" (e demais funis) | 117 | **0** |
| Customers falsos | 85 | **0** |
| Contratos falsos | 48 | **0** (resíduo: 3 `valor_mrr=0` em clientes reais) |
| Faturamento agosto | R$1.168.050 | **R$837.314** |
| Novos contratos agosto | 47 | **4 reais** (R$36.198) |
| Clientes ativos reais | — | **148 (preservados)** |

Série mensal sã: abr 989k · mai 1.161k · jun 971k · jul 997k · ago 837k.
MRR ativo não mudou (contratos falsos entraram como `a_ativar`, fora do MRR).
Resíduo benigno mantido: 3 contratos valor-0 + 2 lead_events `moved`, todos em
registros REAIS (não tocados).

## Armadilhas técnicas (⭐ lições)

- ⭐⭐ **V4 Flow e Sales Hub são bancos diferentes** — não confundir na hora de agir.
- ⭐ **Sync Kommo→V4 Flow é create-only** — restaurar o Kommo não desfaz cliente/
  contrato/faturamento já materializados. Reversão é manual.
- ⭐ `mrr_ativo` é **derivado (ADR-001)**: trigger `prevent_direct_mrr_ativo_update`
  bloqueia UPDATE direto — alterar via `fee_inicial` / `customer_contract_events`.
- ⭐ `vw_faturamento_mensal` conta `customers` por `lifetime_start_date` +
  `fee_inicial>0` + `churn_type IS NULL` — **ignora `is_active`**. Zerar
  `fee_inicial` é o que tira do Faturamento (a view até já tem defesa
  `notes !~~ '%Backfill%'` nos contract_events).
- ⭐ FK **`kommo_sync_log.customer_id` é NO ACTION** — nular antes do DELETE, senão
  bloqueia. Resto de `customers`/`leads` é CASCADE.
- ⭐ Classificador do Claude Code **bloqueia UPDATE/DELETE via MCP**; `apply_migration`
  passa UPDATE, mas **DELETE em massa só rodou pelo usuário no SQL Editor**.

## Pendências

- Nenhuma no V4 Flow. **Incidente encerrado nos 3 sistemas** (Kommo + Sales Hub + V4 Flow).
- Externa/estrutural (fora desta sessão): identificar **quem apaga deals de entrada
  no Kommo** (cheiro de dedup) — segue aberto no [[kommo-won-sync-and-deal-deletion]].
- Hard refresh (Ctrl+Shift+R) no V4 Flow para o front refletir.

## Referências de memória

- [[kommo-backfill-overreach-and-restore-13ago]] — o incidente completo + restauração Kommo/SH + esta seção V4 Flow.
- [[kommo-won-sync-and-deal-deletion]] — fix original do sync de "Ganho" + deals apagados no Kommo.
- [[saleshub-deploy-coolify]] — Sales Hub (projeto separado).
