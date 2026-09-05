# 2026-09-05 — "Zera a fila e aparecem atrasadas": vencimento passa a ser 9h BRT

## Pergunta
"Por que nossos SDRs têm tanta atividade atrasada assim que finalizam as que tinham?"

## Diagnóstico (foto de sáb 05/set)

| SDR | Vencidas | < 1 dia | Último evento = "Pular" | Passo imediato |
|---|---|---|---|---|
| Giovanni | 103 | 64 | 46 | 2 |
| Matheus | 102 | 102 | 59 | 2 |
| Ismael | 67 | 25 | 0 | 11 |
| João Fogaça | 55 | 55 | 0 | 14 |
| Guilherme | 24 | 15 | 1 | 13 |

**3 causas:**
1. **Vencimento copiava a hora da execução.** `calculate_next_step_due` = `now() + delay`. Executou 16h → próxima vence amanhã 16h. A fila (`fetch-pending-activities.ts`) só mostra `next_step_due <= now()`, então o SDR zera às 9h e as tarefas chegam hora a hora, ficando vermelhas 4h depois (`OVERDUE_THRESHOLD_HOURS = 4`). Seg 07/set: 187 tarefas venciam entre 16h e 17h.
2. **"Pular" adia só 2h** (`skip-activity.ts`). Matheus 62×/dia, Giovanni 45×/dia. Volta 2h depois já vencida. É uso, não código.
3. **Passos com delay 0 em sequência** (Recovery 1→2, Inbound 2.0, Fria, Recomendação). ~15/dia por SDR. Desenho de cadência.

Backlog real (> 1 dia): só Giovanni (39) e Ismael (42).

## Decisão do Vini: opção 1
Vencimento às 9h do dia alvo. "Pular" e delay 0 ficam como estão (Pular = conversa com Matheus/Giovanni).

Pergunta do Vini: "não seria ideal um botão de manhã pra preparar a lista do dia?" → Não para gerar a lista (ela já nasce pronta às 9h, sem depender do SDR lembrar). Faria sentido só como tela de organização/priorização do dia. Ideia futura.

## Implementação ✅
- Migration `20260905120000_next_step_due_at_9h_brt.sql`: cadência manual com `delay_days >= 1` → `09:00 BRT` de (hoje + delay) → `skip_weekend_brt`. Delay 0 e `auto_email` seguem `now() + delay` (auto_email de propósito: espalhar envios, limites Gmail).
- Aplicada em prod via MCP. Testada em `BEGIN … ROLLBACK`: manual 1d → seg 09:00; 6d → sex 09:00; 0d no sábado → seg 09:00; auto_email 2d → mesma hora.
- Backfill dos vencimentos futuros (manuais, delay ≥ 1): 410 de 652 estavam fora das 9h → todos às 09:00 da mesma data. Backup `_bkp_next_step_due_9h_20260905`.
- PR [#360](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/360) mergeado (squash) na main em 05/set; CI verde. A migration já estava aplicada em prod via MCP, o deploy do Coolify não muda comportamento.

## Fila de segunda 07/set (às 9h, tudo de uma vez)

| SDR | Vence seg | Já vencidas antes |
|---|---|---|
| Matheus | 209 | 102 |
| Guilherme | 134 | 24 |
| João Fogaça | 69 | 55 |
| Giovanni | 58 | 103 |
| Ismael | 25 | 67 |

⚠️ Segunda vai parecer cheia (tudo às 9h + o que já estava vencido). É o esperado: agora o dia começa com a lista inteira.

## Lições
- ⭐ Trigger `set_next_step_due` é `OF current_step, status` — UPDATE só em `next_step_due` não recalcula (é assim que backfill/espalhamento preservam datas).
- ⭐ Testar trigger em prod com `BEGIN … ROLLBACK` + temp table.

## Pendências
- [x] PR #360 mergeado.
- [ ] Conversar com Matheus e Giovanni sobre o "Pular" (45–60/dia).
- [ ] Ideia futura: tela "meu dia" (priorizar/reordenar), não botão de gerar lista.
- [ ] Se "Pular" continuar inflando: "Pular" → amanhã 9h.
