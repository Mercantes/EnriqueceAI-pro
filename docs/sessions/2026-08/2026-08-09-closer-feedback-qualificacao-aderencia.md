# Sessão 2026-08-09 — Feedback do closer: conferência da qualificação

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Reformulação do **formulário público de feedback do closer** (acessado por token). A estrela "Qualidade do lead" (1–5) estava sendo usada pelos closers como proxy da dificuldade da reunião, tornando a métrica inútil para o SLA do pré-vendas. Trocamos essa estrela por uma **conferência objetiva da qualificação** e mantivemos a estrela apenas como leitura subjetiva ("Chance de fechar"), sem peso na avaliação do SDR. Escopo: **só frontend + endpoint de submissão** — as colunas e os 3 constraints já tinham sido aplicados no banco antes da sessão. Merge: **#251**.

## O que entrou na `main` (PRs)

| PR | Commit (squash) | Conteúdo |
|----|-----------------|----------|
| #251 | `1274d84` | troca "qualidade do lead" por conferência da qualificação no feedback do closer |

---

## Mudança (#251)

**Arquivos** (o fluxo NÃO é um feature module; vive em `src/app/`):
- `src/app/feedback/[token]/FeedbackForm.tsx` — formulário (client component), reescrito
- `src/app/api/feedback/route.ts` — endpoint `POST /api/feedback`, validação + UPDATE

**UI (coluna única, nesta ordem):**
1. **Resultado da reunião** — Realizada / No-show / Remarcada (sempre visível; grava `meeting_done` / `no_show` / `rescheduled`)
2. **A qualificação bateu com a reunião?** — Bateu / Divergiu / Não deu pra validar — **só quando "Realizada"**; trocar para No-show/Remarcada limpa `qualificacao` e `divergencias` do estado
3. **O que não conferiu** — bloco recuado condicional, **só em "Divergiu"**: Verba / Decisor / Dor / Timing / Dados cadastrais (múltipla escolha, mín. 1); sair de "Divergiu" zera o array
4. **Observações** — textarea, opcional
5. **Chance de fechar** — as **mesmas estrelas** (reaproveita a coluna `rating`), opcional, no rodapé atrás de divisória, sem peso na métrica do SDR
- **`decisor_presente` sai da UI** — coluna **mantida no banco** por compatibilidade, não é mais enviada nem gravada por este fluxo

**Endpoint:**
- Passa a aceitar `qualificacao_aderente` e `divergencias`; **deixa de receber `decisor_presente`**
- `rating` vira **opcional** (chance de fechar); grava qualificação/divergências só em `meeting_done`, nulos caso contrário
- **Replica os 3 constraints do banco no servidor** (com dedup do array) → devolve **400 legível** em vez de deixar estourar 500

## Contrato do banco (já em produção — confirmado nesta sessão)

Tabela `public.closer_feedback_requests` (Supabase `dhkmonctyoaenejemkrt`, o que o Coolify usa):

- Colunas (todas nullable): `qualificacao_aderente` (enum `closer_qualificacao_aderencia`), `divergencias` (`text[]`), `rating` (`int2`), `decisor_presente` (`bool`, legado)
- Enum `closer_qualificacao_aderencia`: `bateu`, `divergiu`, `nao_validado`
- Constraints:
  - `closer_feedback_divergencias_validas` — `divergencias` só aceita `verba/decisor/dor/timing/dados_cadastrais`
  - `closer_feedback_divergencias_obrigatorias` — `qualificacao_aderente='divergiu'` exige ≥1 item
  - `closer_feedback_divergencias_somente_se_divergiu` — `bateu`/`nao_validado` (e no_show/rescheduled) exigem array vazio/nulo

> Nenhuma migration neste PR. O código novo **quebra** se subir sem essas colunas/constraints — mas foram verificadas em produção antes do merge.

## Como foi validado

- `pnpm typecheck` e `pnpm lint` — verdes
- Envio **ponta a ponta** pelo dev server (localhost:3000) num cenário isolado e neutralizado: lead de teste sem SDR + guard de dedup anti-CRM + closer de teste. Resultado gravado: `result='meeting_done'`, `qualificacao_aderente='divergiu'`, `divergencias={decisor,timing}`, `rating=null`, `comment=null`, **`decisor_presente=null`**, `responded_at` preenchido
- **Dados de teste removidos** ao final (2 requests, 2 closers de teste, 1 lead, 1 interaction-guard) — zero resíduo confirmado
- CI do #251 verde (Lint · Typecheck · Test · Build) antes do merge squash

## ⭐ Lições / notas

- ⭐ **O fluxo de feedback do closer NÃO é um feature module.** Página + form + endpoint vivem em `src/app/feedback/[token]/` e `src/app/api/feedback/route.ts`; ações de disparo ficam em `src/features/leads/actions/`. Não há schema Zod (validação é imperativa no route) nem componente de estrelas compartilhado (o interativo é inline no form).
- ⭐ **O `POST /api/feedback` tem efeitos colaterais reais no envio:** `meeting_done` carimba `leads.meeting_held_at` + CRM push (`pushLeadToCrmWithDefaults`, `after()`); `no_show`/`rescheduled` reabrem o lead + agendam follow-up + são **acionáveis** (notificam gestores por e-mail). Para testar sem sujar produção: lead **sem `won_by`/`assigned_to`** (mata `notifySdr`), resultado **`meeting_done` não-acionável** (não roda `notifyManagers`), e uma interaction `crm_deal_created` de guard **neutraliza o CRM push** via dedup.
- ⭐ Índice **único parcial** `idx_feedback_unique_pending` em `(lead_id, closer_id)` impede 2 requests pendentes para o mesmo par — para 2 tokens de teste no mesmo lead, use **2 closers**.
- `decisor_presente` (métrica "Decisor na Call %" do Sales Hub) **deixou de ser alimentada** por este fluxo. A coluna continua no banco; a view `vw_sla_qualificacao_sdr` e o sync do SH ficaram fora de escopo. ⚠️ Avaliar se a métrica de decisor no SH agora fica órfã / precisa de outra fonte.

## Fora de escopo (intactos)

Enum `closer_feedback_result`; envio do e-mail de solicitação; lembretes (`reminder_sent_at`/`reminder_count`); view `vw_sla_qualificacao_sdr`.

## Follow-ups

- [ ] Confirmar o formulário novo no ar em produção após o auto-deploy do Coolify (hard refresh se aparecer o formato antigo — deployment skew)
- [ ] Definir a origem da métrica "Decisor na Call %" no Sales Hub agora que `decisor_presente` não é mais preenchido pelo feedback
- [ ] (Opcional) Extrair o componente de estrelas para `src/shared` — hoje há 2 implementações (interativa inline no form + read-only na `CloserFeedbackTable`)
