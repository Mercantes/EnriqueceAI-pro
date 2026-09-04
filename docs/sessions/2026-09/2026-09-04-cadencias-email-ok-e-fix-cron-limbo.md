# 2026-09-04 — Cadências de e-mail OK + cron `cadence-limbo-alert` nunca tinha rodado

## Pergunta
"As cadências de e-mail do EnriqueceAI estão funcionando certinho? Exemplo a de inbound."

## Resposta: SIM, funcionando
Verificado direto em produção (04/set ~13:30 BRT):

| Item | Evidência |
|---|---|
| Motor | cron `execute-cadence-steps` (jobid 12) `*/5 11-20 * * 1-5`, 0 falhas em 7 dias |
| Gmail | 7 contas conectadas, tokens renovados no dia |
| Inbound — E-mail (auto) | 29 envios hoje (6 aberturas), 12 ontem, 43 em 02/set, 45 em 31/ago; zeros só em fim de semana |
| Enrollments ativos | 27, nenhum atrasado; próximos vencem hoje à tarde e seg-feira |
| Falhas/bounces (30d) | 0 nessa cadência; 59 bounces gerais, último 23/ago (Recomendação) |
| Recovery (e-mail) | 9 hoje, 12 ontem |
| Qualquer cadência ativa | nenhum passo de e-mail atrasado >1 dia |

Lembrete: **"Inbound" e "Inbound 2.0" não têm passo de e-mail** (só phone/WA manuais). O e-mail automático do inbound sai pela "Inbound — E-mail (auto)".

## Achado colateral: `cadence-limbo-alert` falhava desde a criação
- Cron jobid 58 (migration `20260812120100`) usava `current_setting('app.settings.app_url')` sem `missing_ok`. Supabase hospedado não permite `ALTER DATABASE SET` → parâmetro nunca existe → **16/16 execuções (14/ago → 04/set) falharam** com `unrecognized configuration parameter "app.settings.app_url"`. Alerta nunca chegou aos gestores.
- Mesmo bug já corrigido em maio (`20260511180000_fix_cron_jobs_url_pattern.sql`) para `sdr-overdue-summary` e `expire-inactive-leads`.

### Correção ✅
1. Prod: `cron.unschedule` + `cron.schedule` com URL fixa `https://app.enriqueceai.com.br/api/cron/cadence-limbo-alert` + token (padrão dos demais crons). Novo jobid **59**, `0 12 * * 1-5`.
2. Disparo manual de teste: `net._http_response` → **200** `{"orgs":1,"alerted":1,"total":299}`.
3. Migration `20260904140000_fix_cadence_limbo_alert_cron_url.sql` (idempotente, sem token no git) → PR [#354](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/354) → squash `e94f740b` → deploy Coolify confirmado via `/api/version`.

### O que o 1º disparo real encontrou: 299 leads em limbo (era 42 em 13/ago)

| Última cadência | Situação | Leads |
|---|---|---|
| Recovery | paused | 189 |
| Inbound — E-mail (auto) | completed | 70 |
| Recovery | completed | 16 |
| Prospecção Agro — Contato (SDR) | paused (proposital) | 13 |
| Outros | — | 11 |

Por SDR: Guilherme 207, Ismael 71, sem dono 13, João Fogaça 7, Giovanni 1.

Os 189 da Recovery foram **pausados pelo Guilherme em massa** (19 em 21/ago, 170 em 25/ago) e nunca retomados.

## Comunicação
- E-mail enviado (Gmail do Vini) para Guilherme em 04/set: 189 leads pausados, 3 opções (retomar Recovery / "Novo sem cadência" / Perdido), como filtrar na tela Leads. **Aguardando resposta** para ajuste em massa com backup.

## Lições
- ⭐⭐ Cron novo SEMPRE com URL fixa; **nunca** `current_setting('app.settings.app_url')`. Só `cron_secret` pode usar `current_setting(..., true)` com fallback.
- ⭐ `"1 row"` em `cron.job_run_details` NÃO prova que a rota respondeu (só que o `net.http_post` foi enfileirado). Conferir `net._http_response` (status_code / error_msg).
- Timeouts de 5000 ms no `net._http_response` de outros crons são normais: o app continua processando; a resposta só não volta ao banco.

## Pendências
- [ ] Resposta do Guilherme → ajuste em massa dos 189 (com backup `_bkp_*`).
- [ ] Política de fim de cadência: 70 leads da "Inbound — E-mail (auto)" concluída ficam "Contatado" sem próximo passo (residual conhecido desde 13/ago).
- [ ] 13 leads "sem dono" em limbo.

## Arquivos
- `supabase/migrations/20260904140000_fix_cadence_limbo_alert_cron_url.sql` (novo, mergeado)
- Memória: `cadence-limbo-triage.md`, `MEMORY.md` atualizados.
