<!-- Sessão: correção da taxa de conexão dos SDRs (Opção B) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Projetos: Enriquece (dhkmonctyoaenejemkrt) + Sales Hub (ejxlbbbjyexsoltsxiqq) -->

## Sintoma relatado

Dashboard do Enriquece ("Detalhamento por SDR") mostrava **conexão altíssima e
errada** para todos os SDRs — Matheus 43% (meta 17%), Guilherme 38%, etc.
Conexão = falar com o lead. "Corrigir de vez."

## Causa-raiz

Fonte única `isConnectedCall` (`src/features/calls/connection.ts`) tinha a regra
answered-first (correta) MAIS um fallback `duration_seconds >= 30` **cru**. Esse
fallback conta **fracasso de discagem** como conexão: a operadora deixa a gravação
de aviso ("número alterado…") tocando 30-500s em não-atendimentos
(`NUMBER_CHANGED`, `ORIGINATOR_CANCEL`, `UNALLOCATED_NUMBER`), todos com
`answered_at` nulo e `status='not_connected'`. Em agosto: ~570 falsas conexões na
org. E nem "salvava" o ramal sem webhook — Giovanni/1042 tinha 197 dessas,
`not_connected`, só 7 com gravação. Ou seja, o fallback estava furado em todos os
cenários.

## Decisão (aprovada pelo usuário)

**Opção B** (das duas regras limpas apresentadas) + **recomputar o BI**.

Regra nova, na fonte única:
```
conectada = answered_at válido
         OU status='significant'
         OU (hangup_cause='NORMAL_CLEARING' E tem gravação E duração>=30)   ← proxy
         E  sdr_disposition <> 'voicemail'
```
O proxy resgata conversa genuína de ramal sem webhook exigindo **prova positiva**
(encerramento normal + gravação + duração), sem readmitir o lixo. `NORMAL_CLEARING`
é o separador — fracasso de discagem tem outra causa.

## Antes × Depois por SDR (agosto, outbound)

| SDR (ramal) | Atual (inflado) | Opção B |
|---|---|---|
| Guilherme (1033) | 316 · 38% | **222 · 27%** |
| Ismael (1024) | 294 · 36% | **226 · 28%** |
| Matheus (1028) | 206 · 30% | **194 · 28%** |
| Giovanni (1042) | 181 · 26% | **11 · 1,6%** * |
| João (1045) | 76 · 31% | **57 · 23%** |

\* Giovanni fica baixo porque a API4COM não emite `channel-answer` no ramal dele
(defeito na origem, já documentado em `api4com-webhook-report-2026-08.md`). A
métrica honesta expõe, não esconde. João migrou pro Callface, onde conta certo.

## Mudanças

### App (git — nesta branch, ainda NÃO commitado)
- `src/features/calls/connection.ts` — `isConnectedCall` = Opção B; `CallConnectionSignals` ganha `hangup_cause`/`recording_url`; `CALL_CONNECTION_COLUMNS` atualizado.
- Consumidores (select + tipo) receberam as 2 colunas novas:
  `src/features/calls/services/extrato.service.ts`,
  `src/features/statistics/services/call-dashboard.service.ts`,
  `src/features/statistics/services/call-statistics.service.ts`.
- Testes: `connection.test.ts`, `call-dashboard.service.test.ts`, `extrato.service.test.ts` — cobrem o proxy e a exclusão do lixo (NUMBER_CHANGED com gravação NÃO conecta).
- Migration `supabase/migrations/20260813061500_get_calls_for_v4sales_option_b_connection.sql` — export RPC leva `hangup_cause`+`sdr_disposition`; overload de métricas usa Opção B. **Já aplicada em prod via MCP.**
- Validação: `pnpm typecheck` ✅, lint ✅, 187 testes (calls+statistics) ✅, `pnpm build` ✅.

### Sales Hub (projeto separado — via MCP, fora do git; doc é o registro)
- `sync_calls_from_enriquece` → `v_connected` passa à Opção B (usa `hangup_cause`/`recording_url`/`sdr_disposition` do payload).
- **Recompute Abr-Ago:** `raw_payload` histórico não tinha `answered_at`/`hangup_cause`, então re-puxei do Enriquece via `net.http_post` → RPC temporária `apply_conn_fix_v1` (gated por segredo, granted a anon, **removida ao final**). **2.451 linhas corrigidas** (Abr 100, Mai 393, Jun 823, Jul 832, Ago 303). `pdi_monthly_goals.ligacoes_conectadas` recalculado.
- Connected/mês antes→depois: Mai 1.869→1.486, Jun 2.503→1.680, Jul 3.636→2.804, Ago 994→714. (Abr 182→282: subiu, estava sub-contado por falta de `answered_at` no payload.)
- Paridade SH ↔ Enriquece Opção B (agosto): Guilherme/Ismael/Matheus/João/Vinicius batem exato; Giovanni 8≈11.

Doc detalhado: `docs/integrations/saleshub-connected-metric-fix-2026-08.md` (seção "Atualização 13/08").

## Pendências

- **Deploy do app:** as mudanças de `connection.ts` + consumidores estão na branch,
  **não commitadas/deployadas**. O card do dashboard só reflete a Opção B após o
  deploy (Coolify na main). O BI (Sales Hub) **já está corrigido agora**.
- **Externa (não é código nosso):** API4COM religar `channel-answer` dos ramais
  1042 (Giovanni) e 1045 (João). Enquanto isso, Giovanni fica ~1% de conexão.

## Lições

- ⭐ Duração crua NUNCA é sinal de conexão sozinha — a operadora grava e "toca"
  avisos de não-atendimento por minutos. O separador confiável é a **causa de
  encerramento** (`NORMAL_CLEARING`) + gravação.
- ⭐ Recompute de histórico no Sales Hub exige re-puxar do Enriquece quando o
  `raw_payload` não tem o campo discriminador — recompute in-place mente.
- ⭐ Transferência cross-project server-side (`net.http_post` + RPC temp gated por
  segredo, removida no fim) evita trafegar dados/segredos fora do banco.

## Referências de memória

- [[api4com-connected-empty-answered-at-bug]] — bug do answeredAt="", ramais 1042/1045.
- [[calls-connected-metric-unified]] — fonte única `features/calls/connection.ts`.
- [[callface-integration]] — João migrado pro Callface.
- [[calls-bi-sync-path]] — n8n Sync Calls → sync_calls_from_enriquece.
