<!-- Handoff de encerramento de sessão — 13/ago/2026 -->
<!-- Dois arcos: (1) remove dualidade No-show; (2) resolve probe /api/version -->

# Encerramento — 13/ago/2026

Sessão com dois arcos independentes, ambos concluídos e validados em produção.

## Arco 1 — Remove dualidade "Reunião não aconteceu" (PR #278) ✅ NO AR

**Problema:** no header do lead (`LeadDetailHeader`), o item de menu **"Reunião
não aconteceu"** disparava o mesmo `handleNoShow` → `markMeetingNoShow` que o
botão **"No-show"** do topo — duas entradas de UI para a mesma ação.

**Mudança:** removido o `DropdownMenuItem` duplicado
(`src/features/leads/components/LeadDetailHeader.tsx`, 6 linhas). Botão No-show
permanece como ponto único. `CalendarX`/`handleNoShow` seguem em uso — sem
import órfão.

**Colateral aceito:** no-show deixa de ser acessível em lead já "Ganho" (o
botão some via `isClosed`). Se precisar voltar, reintroduzir o item só sob `isWon`.

**Status:** PR #278 mergeado (squash `173b103`), CI verde, deploy Coolify
disparado. Handoff detalhado no PR #281 (`7592d9a2`).

## Arco 2 — Probe /api/version passa a reportar o SHA real ✅ RESOLVIDO

**Contexto:** ao confirmar o deploy do #278, o endpoint `/api/version` (criado
no #280) retornava `commit:"unknown"`.

**Causa raiz:** não era falta de env var. O Coolify só passa `SOURCE_COMMIT`
como `--build-arg` quando o toggle **`Include Source Commit in Build`**
(Configuration → **Advanced**) está ligado — e ele vem **desligado por padrão**
(para preservar o cache de build). O `ARG SOURCE_COMMIT=unknown` do Dockerfile
(estágio `runner`, L26) caía no default.

**Fix aplicado:** toggle ligado no Coolify + PR #284 (endpoint passou a ler
`SOURCE_COMMIT` também no runtime). Redeploy.

**Validação:** `curl -s https://app.enriqueceai.com.br/api/version` →
`{"commit":"e1de8dfc...","commitShort":"e1de8df","source":"SOURCE_COMMIT",...}`.
`e1de8df` = HEAD da `main` (#284). Probe agora cumpre o propósito de "CI verde
≠ deploy no ar". Trade-off de cache ~nulo (ARG só no estágio `runner`, depois
de `pnpm install`/`pnpm build`).

## Como checar qualquer deploy daqui pra frente

```bash
curl -s https://app.enriqueceai.com.br/api/version
```

## Estado ao encerrar

- Working tree do arco 1 e arco 2: mergeados na `main`; nada pendente de commit
  desta sessão.
- Memória atualizada: pendência do SOURCE_COMMIT marcada ✅ ENCERRADO;
  arquivo-tópico `api-version-probe-app-commit` com causa raiz e fix.
- Sem ações abertas remanescentes desta sessão.
