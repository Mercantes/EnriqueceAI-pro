# 2026-08-28 — Recuperação automática de inbound perdido (redistribuição + Recovery)

## Pedido
Quando o Ismael der perdido em lead de **inbound** (Leadbroker/Blackbox) com motivo
**Nunca respondeu**, **Sem interesse** ou **Sem timing**:
1. Redistribuir o lead entre **Matheus, Guilherme, Giovanni e João Fogaça**.
2. Inscrever na cadência **Recovery** começando em **10 dias**.

## O que foi feito
- **Novo serviço** `src/features/leads/services/inbound-recovery.service.ts`
  (`scheduleInboundRecovery`): valida flag + regra da org + motivo + origem inbound,
  escolhe o SDR com menor carga (enrollments abertos na Recovery por dono do lead,
  round-robin dentro do lote), reatribui `leads.assigned_to`, cria enrollment
  `paused` com `scheduled_start_at = +10 dias` na Recovery, grava evento na timeline
  (`inbound_recovery_scheduled`) e notifica o SDR que recebeu (`lead_inbound`).
  Nunca lança — falha não quebra o "dar perdido".
- **Ganchos**: `markLeadAsLost` (lead-lifecycle.ts, passo 3c) e `bulkMarkLeadsLost`
  (bulk-mark-lost.ts, passo 2b).
- **Nenhuma infra nova de ativação**: o motor (`execute-cadence.ts:212-251`) já ativa
  enrollments agendados e volta o lead de `unqualified` → `new` com registro na timeline.
- **Flag** `inbound_recovery_enabled` em `app_flags` (liga/desliga sem deploy):
  migration `20260828100000_inbound_recovery_flag.sql`, **já aplicada em produção via
  MCP** (enabled=true; inofensivo até o código ir ao ar).
- **Teste** `inbound-recovery.service.test.ts` (8 testes: motivos, origens, distribuição).

## IDs usados (org V4 Amaral `c2727473-…`)
- Cadência Recovery: `15a05299-1627-40d1-be81-80150a4f1308` (active, origin=inbound_active)
- Matheus `edd824ed-…`, Guilherme `e2f24cd5-…`, Giovanni `5769812d-…`, João Fogaça `3e0deabd-…`
- Motivos (grafia do banco): `Nunca respondeu`, `Sem interesse`, `Sem timing`

## Validação
`pnpm typecheck` ✅ · `pnpm lint` ✅ · `vitest src/features/leads` 258/258 ✅

## Pendências
- Commit/PR/deploy (não versionado — regra de git manual).
- Config da regra (SDRs/cadência/dias) está hardcoded no serviço por org; se mudar o
  time, editar `RULES` em `inbound-recovery.service.ts`.
- SDR desativado na org é ignorado automaticamente na distribuição.
