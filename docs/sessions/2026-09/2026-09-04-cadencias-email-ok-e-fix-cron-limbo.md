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

## Tarde: Guilherme pediu "retomar" → descoberta de 2ª edição da Recovery

Antes de retomar, conferi `cadence_steps`: a Recovery tinha **10 passos**, não os 11 do remap de 03/set.
Edge logs (`request.path LIKE '%cadence_steps%'`, `request.sb.auth_user`):

| Quando (BRT) | Quem | O quê |
|---|---|---|
| 03/set 14:24 | Vinicius | 8 → 11 passos (e-mails + cadência maior) |
| 03/set 15:10–15:30 | remap via MCP | mapeou leads para numeração de **11** |
| 03/set 16:51 | **Julio Mendes** (manager) | removeu o passo 3 (e-mail dia 0) → **10 passos**; todo cs≥4 deslocou |
| 04/set 14:13 | Guilherme (SDR) | salvou sem mudar estrutura (SDR consegue editar cadência) |

Estrutura atual: 1 phone0 · 2 WA0 · 3 phone1d · 4 WA1d · 5 email1d · 6 phone3d · 7 email3d · 8 phone6d · 9 email6d · 10 WA6d.

Impacto antes da correção: 217 leads em e-mail (5) no lugar de WA; **175 em cs 11/12 (passos inexistentes, invisíveis)**; 397 skips sintéticos do e-mail 3 com `step_id` NULL.

### Parte A — realinhamento (backup `_bkp_recovery_realign_20260904`) ✅
- 407 enrollments do backup de 03/set que **não se moveram** desde o remap → `cs − 1` (11→10; 12→8 = nova cauda). Vencimento original preservado (trigger é `OF current_step, status`; 2º UPDATE só em `next_step_due`).
- Quem executou algo após 16:51 ficou como está (já coerente com 10 passos).
- "Destrava" iterativo (+1): WA inválido em passo WA (115) e e-mail com skip sintético (130).
- Depois: ninguém em passo inexistente, ninguém em e-mail suprimido. Residual: **66 leads em cs=10 (WA 6d, último) com WA inválido** = invisíveis até auto-loss.

### Parte B — retomada dos 189 do Guilherme (backup `_bkp_recovery_resume_guilherme_20260904`) ✅
- Estavam na numeração **antiga de 8 passos** (nunca remapeados). Mapa 8→10: 1→1, 2→2, 3→3, 4→4, 5→6, 6→10, 7→8, 8→8 (nova cauda, decisão do Vini). WA inválido em passo WA → próximo (2→3, 4→5, 6→8).
- Todos os 60 do passo antigo 8 e os 13 do 2 tinham WhatsApp inválido (por isso travaram e foram pausados).
- Evento `cadence_resumed` na timeline (`performed_by` = Vini, reason "Retomada em massa (limbo 04/set, a pedido do SDR)").
- Vencimentos: 1 hoje · **114 seg 07/set** · 74 qui 10/set.
- Limbo depois: Guilherme 207 → **18**; total 299 → 111 (Ismael 71 = Inbound E-mail concluída).

## Lições
- ⭐⭐ Cron novo SEMPRE com URL fixa; **nunca** `current_setting('app.settings.app_url')`. Só `cron_secret` pode usar `current_setting(..., true)` com fallback.
- ⭐ `"1 row"` em `cron.job_run_details` NÃO prova que a rota respondeu (só que o `net.http_post` foi enfileirado). Conferir `net._http_response` (status_code / error_msg).
- Timeouts de 5000 ms no `net._http_response` de outros crons são normais: o app continua processando; a resposta só não volta ao banco.

- ⭐⭐ **Sempre re-conferir `cadence_steps` antes de remap/retomada** — outra pessoa pode ter editado no meio.
- ⭐ SDR consegue editar passos de cadência (Guilherme salvou a Recovery). Avaliar restringir a manager.

## Pendências
- [x] Resposta do Guilherme → 189 retomados (backup `_bkp_recovery_resume_guilherme_20260904`).
- [ ] Avisar Guilherme: 114 tarefas caem na fila dele segunda 07/set + 74 na quinta 10/set.
- [ ] 66 leads em cs=10 (WA 6d) com WA inválido: invisíveis; motor deveria pular passo WA (pendente antigo) ou dar Perdido/Novo.
- [ ] Falar com Julio Mendes: editar estrutura de cadência ativa desloca leads (mesmo com o hardening).
- [ ] Restringir edição de passos a manager?
- [ ] Política de fim de cadência: 70 leads da "Inbound — E-mail (auto)" concluída ficam "Contatado" sem próximo passo (residual conhecido desde 13/ago).
- [ ] 13 leads "sem dono" em limbo.

## Arquivos
- `supabase/migrations/20260904140000_fix_cadence_limbo_alert_cron_url.sql` (novo, mergeado)
- Memória: `cadence-limbo-triage.md`, `MEMORY.md` atualizados.
