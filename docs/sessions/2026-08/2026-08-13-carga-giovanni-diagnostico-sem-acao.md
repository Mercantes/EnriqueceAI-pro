<!-- Sessão de diagnóstico (sem alteração de dados/código) -->
<!-- Data: 2026-08-13 -->
<!-- Org: V4 Company Amaral (c2727473-1df8-4faa-9264-a9fc1759fe3b) -->
<!-- Pedido: "alinha a carga do CRM pra não sobrecarregar o Giovanni" -->
<!-- Decisão do usuário: só diagnóstico, sem ação. -->

## TL;DR

A premissa "carga do CRM sobrecarregando o Giovanni" **não se confirma**: a carga
de leads dele é normal (meio do time) e **não existe feed automático do CRM**
distribuindo leads. O gargalo real é a **telefonia dele (ramal 1042 quebrado)** —
throughput, não volume. Nenhuma ação tomada, a pedido do usuário.

## Como a atribuição funciona (confirmado no código)

**Não há round-robin nem distribuição automática/balanceamento.** `leads.assigned_to`
é sempre explícito:
- **Inbound API/webhook** — usa o `assigned_to` do payload (`inbound-lead.service.ts:144`); se ausente, fica `null`.
- **Criação manual** — `create-lead.ts:155`.
- **Import CSV** — se um SDR importa, auto-atribui a ele; se manager importa, fica `null` (`import-leads.ts:142`).
- **Bulk reassign (manual)** — `bulk-assign-leads.ts` (reatribui lead + `cadence_enrollments.enrolled_by` + `scheduled_activities.user_id`).
- **Sync do Kommo NÃO cria/atribui leads** — só atualiza existentes (`crm-sync.service.ts`, "We don't auto-create leads from CRM pull").

`daily_activity_goals` e `goals_per_user` são **KPIs**, não teto de fila.
Pausar SDR do rateio = `organization_members.status='suspended'` (mas NÃO
redistribui os leads que já são dele).

## Carga atual por SDR (leads trabalháveis = new+contacted+qualified)

| SDR | Trabalháveis | new | Obs |
|-----|-------------|-----|-----|
| Ismael (1024) | 768 | 529 | maior pilha |
| Matheus (1028) | 700 | 514 | |
| **Giovanni (1042)** | **694** | **499** | **meio do time — não é o mais carregado** |
| Guilherme (1033) | 634 | 480 | |
| João (1045) | 55 | 21 | capacidade sobrando; já no Callface |

**Backlog de atividades agendadas é mínimo** (Giovanni 4 atrasadas / 8 pendentes) —
o peso está nos leads `new` parados, não em atividades.

## De onde vêm os leads `new` do Giovanni (499)

Todos `lead_source='Outbound'`, via **import CSV manual** (não CRM):
- **182** importados por **Vinícius** em 01-04/ago (o lote grande recente).
- 106 + 41 criados pelo próprio Giovanni (mai-jul).
- 79 sem `created_by` (mai-jul).
- 62 pelo Rafael (suspenso).

Inflow: 278 leads em 14d, mas **273 vieram 7-14 dias atrás** (só 5 nos últimos 7d)
— um lote pontual, não um fluxo contínuo.

## Achado importante: os `new` NÃO são leads frescos

Dos 499 `new`, **só 12 são limpos** (sem interação e sem cadência ativa). Os
outros **487 têm interações** (histórico) mas estão presos em `status='new'` — é o
**limbo de cadência** / reset de status já mapeado ([[cadence-limbo-triage]],
[[auto-loss-enabled-21d]]), problema SEPARADO. Remanejar esses carregaria a
conversa de outro SDR junto.

## Conclusão / opções (para o usuário decidir com o time)

O lever certo NÃO é "alinhar distribuição" (não há o que alinhar) nem redistribuir
volume (já equilibrado). As opções reais:

1. **Migrar Giovanni p/ Callface** (resolve a raiz — vazão), como fizeram com o
   João. Desbloqueia os leads que ele já tem. É config Callface + n8n (ops, fora
   deste repo). ⭐ **Maior alavanca.**
2. **Segurar imports grandes pro Giovanni** até a telefonia normalizar
   (comportamental no import CSV — foi um import manual, não um feed).
3. **Remanejar** (via bulk-assign) — só 12 limpos; mover os 487 com histórico é
   mais delicado.
4. **Atacar o limbo** (487 `new` com histórico) — frente separada já mapeada.

Pendência externa que destrava tudo: **API4COM religar o `channel-answer` do ramal
1042**, ou migrar o Giovanni pro Callface.

## Referências

- [[api4com-connected-empty-answered-at-bug]] — ramal 1042 sem channel-answer.
- [[calls-connected-metric-unified]] — conexão do Giovanni em 1,6% pelo mesmo defeito.
- [[callface-integration]] — João migrado pro Callface (modelo a seguir).
- [[cadence-limbo-triage]], [[recovery-backlog-paused-giovanni]] — o limbo de `new` com histórico.
