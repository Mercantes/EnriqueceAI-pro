# 2026-09-05 — E-mail para o time de SDR: melhorias da semana (31/ago a 05/set)

## Pedido
Formalizar um e-mail para o time de SDR comunicando as melhorias da ferramenta.
Escopo fechado pelo Vini: **só o que entrou no ar na última semana**.

## Fontes
- `git log` 29/ago → 05/set (sem `docs(sessions)`): PRs #345 a #354 e #360.
- Handoffs: `2026-09-05-atrasadas-vencimento-9h.md`, `2026-09-04-cadencias-email-ok-e-fix-cron-limbo.md`,
  `2026-09-03-enviado-manualmente-e-controle-diario.md`, `2026-09-03-recovery-edicao-passos-zerou-step-id.md`,
  `2026-09-03-dashboard-grafico-rm-rr-por-dia.md`, `2026-08-28-inbound-recovery-redistribuicao.md` (adendos 31/ago e 01/set).

## Conteúdo do e-mail (7 pontos)
1. **Fila às 9h** (PR #360) — a partir de seg 07/set a tarefa manual com delay ≥ 1 dia vence às 9h do dia alvo. Aviso de que segunda parece cheia (esperado). Dica: "Pular" adia só 2h; usar só para retorno no mesmo dia.
2. **Botão "Enviado manualmente"** (PR #351/#352) — WhatsApp e e-mail; conta em Progresso diário, Dashboard e Estatísticas; selo "Manual" na timeline; não gasta crédito. Substitui nota + Pular.
3. **Controle Diário** (PR #351) — não conta mais "Pular" como concluída; painéis batem entre si.
4. **Template de e-mail preenche a tarefa da fila** (PR #347).
5. **Dashboard RM/RR por dia** (PR #348/#349) + card RR por SDR responsável (PR #350).
6. **Recuperação automática de inbound perdido** (PR #345/#346) — Ismael dá Perdido (Nunca respondeu / Sem interesse / Sem timing) → redistribui entre Matheus, Guilherme, Giovanni, João; Recovery em 30 dias; troca de dono só na ativação. Retroativo em ondas 10/set, 17/set, 24/set, 01/out.
7. **Bastidores** — fix das atrasadas fantasma de 03/set + trava no editor de cadência (PR #353); alerta de limbo funcionando (PR #354).

## Entrega
- Rascunho salvo no Gmail do Vini: assunto **"EnriqueceAI: melhorias da semana (31/ago a 05/set)"**,
  draft id `r-1794605342522691066`. HTML + texto puro.
- **Destinatários em branco** de propósito (preencher com o time de SDR antes de enviar). Nada foi enviado.

## Pendências
- [ ] Vini revisa, preenche destinatários e envia (idealmente antes de seg 07/set, por causa do item 1).
- [ ] Rascunho anterior do "Pular" (Matheus/Giovanni) continua no Gmail; o item 1 deste e-mail já cobre a dica geral. Decidir se o e-mail individual ainda vai.

## Arquivos
- Nenhum arquivo de código alterado. Só este handoff.
