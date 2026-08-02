# Relatório técnico à API4COM — comportamento de webhook e classificação de chamadas

**De:** Equipe de engenharia EnriqueceAI (integração da conta V4 Amaral)
**Para:** Suporte técnico / Engenharia API4COM
**Data:** 01/08/2026
**Período analisado:** julho/2026
**Assunto:** 3 pontos que precisamos esclarecer/corrigir para fechar nossa métrica de conexão de chamadas

---

## Contexto da integração

Consumimos a API4COM por dois caminhos:

1. **Webhook** — recebemos os eventos `channel-answer` e `channel-hangup` no nosso endpoint. Os campos que lemos do payload são: `id`, `eventType`, `caller`, `called`, `startedAt`, `answeredAt`, `hangupCause`, `duration`, `recordUrl`.
2. **REST** (`GET /calls`) — usado por uma rotina de reconciliação para complementar chamadas que porventura não chegam pelo webhook.

Originamos chamadas via `POST /dialer` informando `extension` (o ramal do SDR), `phone` e `metadata`.

Cada SDR tem um ramal numérico dedicado. Na conta da V4 Amaral, em julho/2026:

| SDR | Ramal | Chamadas | Com evento de webhook | Com `answeredAt` |
|-----|-------|----------|-----------------------|------------------|
| Matheus | 1028 | 3.164 | 3.068 (97%) | 1.357 |
| Ismael | 1024 | 1.921 | 1.917 (99%) | 723 |
| Guilherme | 1033 | 1.868 | 1.835 (98%) | 661 |
| **Giovanni** | **1042** | **2.486** | **0 (0%)** | **0** |

---

## Solicitação 1 — Webhook não é entregue para o ramal 1042 (BLOQUEANTE)

**Sintoma:** para o ramal **1042**, **nenhum** evento `channel-answer`/`channel-hangup` chega ao nosso endpoint. Em 100% das 2.486 chamadas de julho, os campos `answeredAt` e `hangupCause` estão vazios e não há registro de atendimento — enquanto os demais ramais da **mesma conta** (1024, 1028, 1033) recebem eventos normalmente (97–99%).

Observações que ajudam o diagnóstico:
- A rotina REST (`GET /calls`) **enxerga** algumas chamadas do 1042 (recuperamos gravação de 25 delas por esse caminho). Ou seja, a chamada existe na sua base — o que não chega é o **webhook de eventos**.
- Do nosso lado, a configuração do 1042 é idêntica à dos ramais que funcionam (mesma `base_url`, credencial válida, ramal ativo).
- O ramal 1042 entrou em operação recentemente (config criada em 02/07/2026).

**Perguntas:**
1. O webhook de eventos está **registrado e ativo** para o ramal/subconta do 1042? Ele aponta para o mesmo endpoint dos demais ramais?
2. O ramal 1042 pertence a uma **subconta, gateway ou tronco diferente** dos ramais 1024/1028/1033? Se sim, a configuração de webhook é por subconta?
3. Por que os eventos desse ramal não são disparados, sendo que a chamada existe na base REST?
4. Como validamos/reprovisionamos o registro de webhook para esse ramal?
5. **Backfill:** a API4COM **retém os eventos históricos** (`channel-answer`/`channel-hangup`) desse ramal? Desde quando? É possível **reenviar/replay** dos eventos de julho/2026? Isso é decisivo — o campo `answeredAt` só existe no evento de webhook (o REST não o expõe), então sem replay não conseguimos recuperar o histórico de atendimento desse SDR.

---

## Solicitação 2 — `answeredAt` chega como string vazia (`""`) em chamadas não atendidas

**Comportamento observado:** no payload do webhook, chamadas que **não** foram atendidas trazem `answeredAt` como **string vazia (`""`)** — e não como `null` ou campo ausente. Confirmamos isso indiretamente: causas de não-atendimento (`NO_ANSWER`, `USER_BUSY`, `ORIGINATOR_CANCEL`, `NUMBER_CHANGED`, entre outras) chegam com um `answeredAt` que passa por qualquer checagem de "campo presente", mas que não é um timestamp válido.

**Impacto do nosso lado:** tratávamos "houve atendimento" como `answeredAt` não-nulo — e `"" != null`. Isso fez 100% das chamadas processadas por webhook serem marcadas como atendidas, inclusive as claramente não atendidas. **Já corrigimos internamente** (passamos a exigir um timestamp válido), então não precisamos de ação urgente. Mas o comportamento no payload é, no mínimo, ambíguo.

**Pedido:** confirmar se `answeredAt: ""` em chamada não atendida é o comportamento **esperado**. Se possível, enviar **`null`** (ou omitir o campo) quando não houve `channel-answer` — semanticamente mais correto e menos propenso a induzir erro em quem consome o payload.

**Perguntas:**
1. `answeredAt` é preenchido **somente** quando houve atendimento humano real (evento `channel-answer`), ou também em outros casos (ex.: atendimento por gravação/URA da operadora)?
2. Há diferença de formato/timezone do `answeredAt` entre o webhook e o REST?

---

## Solicitação 3 — Semântica e volume de `hangupCause = NUMBER_CHANGED` (BLOQUEANTE)

**Sintoma:** `NUMBER_CHANGED` aparece num volume alto e implausível para o significado literal ("o número mudou"), com duração ~0s e sem nenhum atendimento:

| Ramal | % das chamadas com telemetria | Duração média | Com atendimento |
|-------|-------------------------------|---------------|-----------------|
| Guilherme (1033) | 36,9% | ~1s | 0 |
| Matheus (1028) | 31,7% | ~2s | 0 |
| Ismael (1024) | 17,2% | ~0s | 0 |

Repassamos o valor de `hangupCause` **cru**, sem tradução. Como não temos o mapeamento entre os códigos da operadora e os rótulos que vocês gravam, não conseguimos interpretar corretamente. A leitura de negócio muda radicalmente conforme a resposta: 30–40% de "lista ruim" (números inválidos/portados) é um problema de aquisição de dados; 30–40% de "tocou e não atenderam" é comportamento normal de outbound. **Não vamos avaliar a qualidade da operação sobre esse dado sem a confirmação de vocês.**

**Perguntas:**
1. Qual é o **mapeamento exato** entre os códigos de retorno da operadora (SIP/ISUP cause codes) e os valores gravados em `hangupCause`?
2. Especificamente, o que gera **`NUMBER_CHANGED`**? É literal (número portado/alterado) ou esse código é usado **também** para número inexistente, não atendido, rejeitado ou bloqueado?
3. Podem enviar a **lista completa** dos possíveis valores de `hangupCause` e o significado de cada um? (Já observamos: `NORMAL_CLEARING`, `NO_ANSWER`, `NO_USER_RESPONSE`, `USER_BUSY`, `CALL_REJECTED`, `UNALLOCATED_NUMBER`, `INVALID_NUMBER_FORMAT`, `ORIGINATOR_CANCEL`, `NORMAL_TEMPORARY_FAILURE`, `RECOVERY_ON_TIMER_EXPIRE`, `NUMBER_CHANGED`.)

---

## O que precisamos de retorno

| Item | Prioridade | Precisamos de |
|------|-----------|---------------|
| 1 — Webhook do ramal 1042 | Alta | Causa da não-entrega + correção + viabilidade/prazo de replay do histórico |
| 2 — `answeredAt = ""` | Média | Confirmação do comportamento; idealmente `null` quando sem atendimento |
| 3 — Mapa de `hangupCause` | Alta | Documentação do mapeamento causa-operadora → valor; significado de `NUMBER_CHANGED` |

Ficamos à disposição para uma call técnica ou para fornecer amostras de `id` de chamadas específicas (com data/hora) que ajudem no diagnóstico.
