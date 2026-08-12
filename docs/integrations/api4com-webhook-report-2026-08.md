# Relatório técnico à API4COM — entrega de webhook e evento channel-answer

**De:** Equipe de engenharia EnriqueceAI (integração da conta V4 Amaral)
**Para:** Suporte técnico / Engenharia API4COM
**Data:** 12/08/2026 (atualiza a versão de 01/08)
**Período analisado:** julho e agosto/2026
**Assunto:** 3 pontos — o principal (item 1) foi diagnosticado com precisão cirúrgica e depende de vocês

---

## Contexto da integração

Consumimos a API4COM por dois caminhos:

1. **Webhook** — recebemos `channel-answer` e `channel-hangup` no nosso endpoint. Campos que lemos: `id`, `eventType`, `caller`, `called`, `startedAt`, `answeredAt`, `hangupCause`, `duration`, `recordUrl`.
2. **REST** (`GET /calls`) — rotina de reconciliação que complementa chamadas.

Cada SDR tem uma credencial/ramal. Re-registramos o webhook de **todas** as conexões em 12/08 (`webhook: true`, `webhookTypes: ['channel-hangup','channel-answer']`, `webhookVersion: v1.4`) — **7 de 7 com sucesso**. A configuração do nosso lado é idêntica entre todos os ramais.

---

## Solicitação 1 — Ramais 1042 e 1045 recebem `channel-hangup`, mas NUNCA `channel-answer` / `answeredAt` (BLOQUEANTE)

Este é o ponto central e está isolado com precisão.

Após o re-registro de 12/08, o `channel-hangup` desses dois ramais **voltou a chegar** normalmente — recebemos `hangupCause`, `duration` e `recordUrl` (gravação) em tempo real. **Porém, o `channel-answer` (e o campo `answeredAt`) nunca é entregue para os ramais 1042 e 1045** — inclusive em ligações **claramente atendidas**, com `NORMAL_CLEARING`, duração real e gravação presente.

**Evidência (mesma conta/operação, janela de 3h em 12/08):**

| Ramal | SDR | Atendidas (NORMAL_CLEARING, dur ≥ 20s, com gravação) | Dessas, com `answeredAt` |
|-------|-----|------------------------------------------------------|--------------------------|
| **1028** | Matheus | 4 | **4 (100%)** |
| **1042** | Giovanni | 3 | **0** |
| **1045** | João | 2 | **0** |

O ramal **1028** popula `answeredAt` em 100% das atendidas. Os ramais **1042** e **1045**, nas mesmas condições (atendida, com gravação), ficam com `answeredAt` **sempre vazio** — o evento `channel-answer` simplesmente não chega para eles.

**Confirmação de que vocês detectam o atendimento:** a própria CDR de vocês (`GET /calls`) mostra essas ligações de 1042/1045 **com duração real e com `record_url`** (ex.: 12/08, ramal 1045, ligações de 55s / 13s / 10s com gravação; ramal 1042, ligações de 22s / 43s / 163s com gravação). Ou seja, o atendimento **é detectado e gravado** do lado de vocês — o que falta é a **entrega do evento `channel-answer` / o preenchimento do `answeredAt`** para esses dois ramais.

**Perguntas:**
1. Por que os ramais **1042 e 1045** recebem `channel-hangup` (com `duration`, `NORMAL_CLEARING` e gravação) mas **nunca** `channel-answer` / `answeredAt`, enquanto o ramal **1028** na mesma conta popula `answeredAt` em 100% das atendidas?
2. Há alguma config por-ramal (detecção de atendimento / emissão de `channel-answer`) que esteja habilitada no 1028 e desabilitada no 1042 e no 1045?
3. O ramal **1042** passou a ser detectado/gravado na CDR a partir de ~10/08 (antes disso, `duration: 0` e sem gravação). O que mudou nesse ramal nessa data, e por que o `channel-answer` continua não sendo emitido mesmo após essa correção parcial?

Enquanto isso não se resolve, a métrica de atendimento baseada em `answeredAt` fica zerada para esses dois SDRs — precisamos que o `channel-answer` seja emitido para eles como já é para os demais.

---

## Solicitação 2 — `answeredAt` chega como string vazia (`""`) em chamadas não atendidas

**Comportamento observado:** no payload do webhook, chamadas que **não** foram atendidas trazem `answeredAt` como **string vazia (`""`)** — não como `null` ou campo ausente. Isso ocorre em causas de não-atendimento (`NO_ANSWER`, `USER_BUSY`, `ORIGINATOR_CANCEL`, `NUMBER_CHANGED`, ...).

Já tratamos isso do nosso lado (passamos a exigir um timestamp válido). É um item de qualidade de payload, sem urgência.

**Pedido:** confirmar se `answeredAt: ""` em chamada não atendida é o comportamento esperado. Se possível, enviar `null` (ou omitir o campo) quando não houve `channel-answer` — semanticamente mais correto.

**Observação:** este item (campo vazio em NÃO-atendidas) é distinto da Solicitação 1 (evento de answer AUSENTE em ligações ATENDIDAS nos ramais 1042/1045). Os dois juntos tornam o `answeredAt` pouco confiável.

---

## Solicitação 3 — Semântica e volume de `hangupCause = NUMBER_CHANGED` (BLOQUEANTE)

Repassamos `hangupCause` **cru**, sem tradução — o mapeamento código-da-operadora → rótulo é de vocês.

**Sintoma:** `NUMBER_CHANGED` aparece em volume alto e implausível (17–37% das ligações por ramal, duração ~0s, sem atendimento). A leitura de negócio muda conforme a resposta: 30–40% de "lista ruim" é problema de aquisição de dados; 30–40% de "tocou e não atendeu" é comportamento normal de outbound.

**Perguntas:**
1. Qual o mapeamento exato entre os códigos de retorno da operadora (SIP/ISUP cause codes) e os valores gravados em `hangupCause`?
2. O que gera **`NUMBER_CHANGED`**? É literal (número portado/alterado) ou é usado também para número inexistente, não atendido, rejeitado ou bloqueado?
3. Podem enviar a lista completa dos possíveis valores de `hangupCause` e o significado de cada? (Já observamos: `NORMAL_CLEARING`, `NO_ANSWER`, `NO_USER_RESPONSE`, `USER_BUSY`, `CALL_REJECTED`, `UNALLOCATED_NUMBER`, `INVALID_NUMBER_FORMAT`, `ORIGINATOR_CANCEL`, `NORMAL_TEMPORARY_FAILURE`, `RECOVERY_ON_TIMER_EXPIRE`, `NUMBER_CHANGED`.)

---

## O que precisamos de retorno

| Item | Prioridade | Precisamos de |
|------|-----------|---------------|
| 1 — `channel-answer` ausente em 1042 e 1045 | **Alta** | Por que esses dois ramais não recebem `channel-answer`/`answeredAt` (com o 1028 como contraprova); como habilitar |
| 2 — `answeredAt = ""` | Média | Confirmação do comportamento; idealmente `null` quando sem atendimento |
| 3 — Mapa de `hangupCause` | Alta | Documentação causa-operadora → valor; significado de `NUMBER_CHANGED` |

Podemos fornecer os `id` de chamadas específicas (com data/hora e o `from` de cada ramal) que evidenciam cada ponto, e estamos à disposição para uma call técnica.
