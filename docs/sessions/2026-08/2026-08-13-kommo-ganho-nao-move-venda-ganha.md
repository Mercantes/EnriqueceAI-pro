<!-- Sessão: "Ganho"/reunião não deve mover deal para "Venda ganha" no Kommo (reverte #279) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Projeto: Enriquece (Supabase dhkmonctyoaenejemkrt) + Kommo (amoCRM) -->
<!-- PR: #302 (mergeado + deployado) -->

## Sintoma relatado

O usuário reparou que "algum PR que subimos" fazia o **Kommo dar Ganho em todo
lead** enviado do Enriquece que **realizou reunião** — ou seja, toda reunião
realizada virava **"Venda ganha"** no Kommo, inflando a coluna de vendas fechadas.

## Diagnóstico

⭐⭐ **Causa conceitual (a mesma lição do incidente do backfill):** no fluxo
Meetime-style do app, o botão **"Ganho" = o SDR fez a reunião acontecer (um SAL)**,
NÃO uma venda fechada. **Nunca mapear `won` do Enriquece 1:1 para "Venda ganha"
(status 142) do Kommo.**

**Origem exata:** PR **#279** (`32a8487a` — *"propaga Ganho do Enriquece para a
coluna venda ganha no Kommo"*). Ele fez o "Ganho" chamar `markDealWonInCrm`, que
move o deal para `KOMMO_WON_STATUS_ID = 142`.

**Cadeia de código:**
- `markLeadAsWon` (`src/features/leads/actions/lead-crm.ts`) roda quando o SDR marca
  "Ganho" (botão no lead, fila de atividades `ActivityQueueView`/`ActivityLogView`).
- Chamava `markDealWonInCrm` (`src/features/leads/services/crm-push.service.ts`),
  que garante o deal E o move para 142.

**Confirmação em produção** (interactions `crm_synced` / `metadata.event='deal_won'`):
- Burst 07:52–07:56 BRT = **143 deals** → é o backfill do #279 (já revertido no
  incidente anterior via `restore-kommo-baseline`).
- **09:06 e 11:17 BRT = 2 deals individuais** → **caminho ao vivo ainda ativo**:
  cada "Ganho" seguia empurrando o deal para 142.

## Decisões (aprovadas pelo usuário, via AskUserQuestion)

1. **Destino no Kommo ao marcar "Ganho":** *"Só garantir que o deal existe"*
   (create-only, comportamento pré-#279). O closer move para venda ganha no Kommo.
2. **Deals já movidos ao vivo:** *"Primeiro levantar a lista"* → depois *"reverter"*.
3. **Ulian Motors (26328991):** *"deixar onde está"* (já não estava em ganho).
4. Confirmado ao final: **comportamento correto é reunião NÃO marcar ganho no Kommo**
   (o closer marca).

## Correção aplicada (PR #302 — `3794a03`, no ar)

**2 arquivos, −155 / +36 linhas:**

1. **`src/features/leads/actions/lead-crm.ts`** — `markLeadAsWon` voltou ao
   **create-only**. Trocado `markDealWonInCrm(orgId, leadId, crmOptions)` por
   ensure-exists:
   ```ts
   const pushResult = crmOptions
     ? await pushLeadToCrm(orgId, leadId, crmOptions)
     : await pushLeadToCrmWithDefaults(orgId, leadId);
   ```
   Com formulário de CRM usa o pipeline/estágio escolhido; pela fila usa os defaults
   da conexão. **Não move mais para 142.**

2. **`src/app/api/workers/backfill-kommo-won/route.ts`** — **neutralizado** (stub
   `410 Gone`, sem o import de `markDealWonInCrm` nem a lógica de move). Era o mesmo
   worker que causou o backfill-overreach de 13/ago; fica inerte para não repetir.

`/api/feedback` já era só ensure-exists — sem alteração.

**Verificações:** `pnpm typecheck` ✅ · `eslint` (arquivos) ✅ · `vitest` 229 ✅ ·
`markDealWonInCrm` sem nenhum caller vivo restante.

## Limpeza dos 2 deals ao vivo

Dry-run do worker **`revert-kommo-won`** (`since=2026-08-13T11:30:00Z`, org V4
Amaral) — janela isola só os 2 (backfill está ≤10:56 UTC). Consultando o **log ao
vivo de eventos do Kommo**, ambos **já não estavam em 142**:

| Deal | Lead | Status atual | Ação |
|---|---|---|---|
| `26329571` | ANTUARTE Comércio de Plásticos | 103287655 | já no estágio anterior — nada a fazer |
| `26328991` | Ulian Motors | 103287971 | movido adiante pelo time — **deixar onde está** (decisão) |

**Nada mutado no Kommo.** Marcadores `deal_won` **não drenados** (rastro histórico
mantido). ⭐ o worker só reverte se o deal AINDA está em 142 — seguro por construção.

## Entrega

- PR **#302** criado, CI verde, **squash-merge** na `main` (merge commit `3794a03`),
  branch remoto/local removidos.
- **Deploy confirmado em produção** ~14:17 BRT: `curl /api/version` → `3794a03`
  (= HEAD da `main`). ⚠️ `commitShort` tem 7 chars — comparar com 7, não 8.

## Pendências / follow-ups

- ⚠️ **`markDealWonInCrm` continua definida** em `crm-push.service.ts`, agora código
  morto (nenhum caller vivo). Deixada intacta para não ampliar o escopo — removível
  num PR separado.
- ⚠️ **Em aberto (fora do escopo):** quem apaga os deals de entrada no Kommo (contato
  sobrevive → cheiro de dedup). Ver `kommo-won-sync-and-deal-deletion`.
- Observabilidade: falhas de CRM sync ainda são só `console.error` (sem Sentry/tabela).
