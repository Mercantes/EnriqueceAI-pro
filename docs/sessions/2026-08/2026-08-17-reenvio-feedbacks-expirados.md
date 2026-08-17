<!-- Sessão: 17/08/2026 -->
<!-- Operação em produção, sem mudança de código -->

## Pedido

Disparar novamente os links expirados de feedback de reunião dos closers
(`closer_feedback_requests` com `responded_at IS NULL` e `expires_at < now()`).

## Diagnóstico

Havia **5 pendentes expirados** em produção. Mas 2 deles não eram "esquecidos" —
eram links **invalidados de propósito** pelo `reassign-closer.ts` (que seta
`expires_at = now()` quando o closer do lead é trocado), e o closer novo **já
tinha respondido** o request substituto:

| Lead | Closer do link expirado | Situação | Ação |
|------|------------------------|----------|------|
| Construvision Engenharia | Pedro Neves | Pendente real (expirou 17/08) | ✅ Reenviado |
| Sândalo Plaspérola | Pedro Neves | Pendente real (expirou 03/08) | ✅ Reenviado |
| Profitness | Vinicius Mercante | Pendente real (de abril; lead voltou a `qualified`) | ✅ Reenviado |
| Novavida Premium | Jhonata Banqueri | Closer trocado p/ Pedro; novo request já respondido | ❌ Pulado |
| Condimentos do campo | Jhonata Banqueri | Closer trocado p/ Pedro; novo request já respondido | ❌ Pulado |

## Como foi feito (procedimento reutilizável)

1. **Renovar a validade** dos requests via SQL (MCP Supabase, projeto
   `dhkmonctyoaenejemkrt`):

   ```sql
   UPDATE closer_feedback_requests
   SET expires_at = now() + interval '7 days'
   WHERE id IN (...) AND responded_at IS NULL;
   ```

   Necessário porque a rota admin de reenvio **pula requests expirados**.

2. **Disparar o e-mail** pela rota admin existente (mesmo token/link original,
   não conta como lembrete nem escalação — não mexe em `reminder_count`):

   ```bash
   curl -X POST "https://app.enriqueceai.com.br/api/admin/resend-closer-feedback" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"feedbackRequestIds":["..."]}'
   ```

Resultado: `sent` para os 3. Links válidos até **24/08/2026 ~14:10 UTC**.

## Aprendizados

- ⭐ **Nem todo request expirado deve ser reenviado**: `reassign-closer.ts`
  expira o link antigo ao trocar o closer. Antes de reenviar, conferir se
  existe request mais novo respondido para o mesmo lead (`newer_requests` /
  `responded_at`).
- A rota `/api/admin/resend-closer-feedback` (auth = Bearer com a
  `SUPABASE_SERVICE_ROLE_KEY`) só manda **e-mail** — o WhatsApp fica de fora,
  o que é adequado para reenvio manual.
- Ao renovar `expires_at`, os requests voltam a ser elegíveis para o cron
  `feedback-reminders` — os lembretes automáticos retomam sozinhos.

## Pendências

- Nenhuma mudança de código; nada a commitar/deployar.
- Se Pedro não responder até 24/08, os links expiram de novo — repetir o
  procedimento acima ou avaliar botão de reenvio que aceite expirados.
