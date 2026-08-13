<!-- Sessão: confirmação em prod da conexão por SDR após a Opção B -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Complementa: 2026-08-13-conexao-sdr-opcao-b-remove-fallback-duracao.md -->

## Objetivo

Confirmar, com dado de produção, que o card "% de Conectadas" caiu para o valor
correto para **todos os SDRs** após a Opção B (#277) — não só o Matheus.

## Método

O card é determinístico: `fetchCallDashboardData`
(`src/features/statistics/services/call-dashboard.service.ts`) busca todas as
ligações do período (SEM filtro de tipo) e conta `connected` via `isConnectedCall`
(Opção B). `% = connected / total`. Repliquei essa conta exata contra o banco vivo,
mês corrente BRT (`started_at >= '2026-08-01T03:00:00Z'`).

Regra Opção B replicada:
```
connected = sdr_disposition <> 'voicemail' AND (
  answered_at IS NOT NULL
  OR status = 'significant'
  OR (hangup_cause = 'NORMAL_CLEARING' AND recording_url IS NOT NULL AND duration_seconds >= 30))
```

Código confirmado no ar: `/api/version` → `e1de8df` (= HEAD da main, inclui #277).

## Resultado — % de Conectadas por SDR (agosto/2026)

| SDR (ramal) | Ligações | Conectadas | % agora (Opção B) | % antigo (inflado) |
|---|---|---|---|---|
| Guilherme (1033) | 822 | 222 | **27,0%** | 55,5% |
| Ismael (1024) | 817 | 226 | **27,7%** | 36,0% |
| Matheus (1028) | 694 | 194 | **28,0%** | 51,2% |
| João (1045) | 249 | 57 | **22,9%** | 40,2% |
| Giovanni (1042) | 689 | 11 | **1,6%** ⚠️ | 32,7% |
| Vinícius | 20 | 7 | **35,0%** | 35,0% |

## Leitura

- Os 4 SDRs com telefonia saudável caíram para a faixa **23–28%** — o número
  honesto (falou com o lead). A queda maior (Guilherme 55%→27%, Matheus 51%→28%)
  é o lixo saindo: ~metade das "conexões" eram fallback de duração crua
  (gravação de aviso da operadora tocando 30-500s em não-atendimentos).
- **Vinícius: 35% → 35% (sem mudança)** — as 20 ligações dele não tinham nenhuma
  "conexão por duração crua". Prova de que a regra só mexe onde havia lixo
  (não é um corte cego).
- **Giovanni: 1,6%** — caso conhecido e ISOLADO: a API4COM não emite
  `channel-answer` no ramal 1042, então as conversas reais dele ficam invisíveis.
  É defeito de telefonia na ORIGEM (ver `api4com-webhook-report-2026-08.md`), não
  a métrica errada. Enquanto a API4COM não religar, ou ele migra pro Callface como
  o João fez.

## Estado

Confirmado de ponta a ponta: **regra corrigida (#277) → app no ar (`e1de8df`) →
BI recomputado (Abr-Ago) → card por SDR batendo em prod**. Os números do app, do
BI (Sales Hub) e desta replicação coincidem.

Pendência externa (única): API4COM religar `channel-answer` dos ramais 1042/1045.

## Referências

- [[calls-connected-metric-unified]] — regra Opção B, fonte única.
- [[api4com-connected-empty-answered-at-bug]] — ramais 1042/1045 sem channel-answer.
- [[callface-integration]] — João conta certo pelo Callface.
- Handoff da correção: `2026-08-13-conexao-sdr-opcao-b-remove-fallback-duracao.md`.
- Handoff do endpoint de deploy: `2026-08-13-api-version-endpoint-e-confirmacao-deploy.md`.
