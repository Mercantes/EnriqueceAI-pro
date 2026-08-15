# Sessão 2026-08-09 — Feedback do closer: conferência da qualificação

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Reformulação do **formulário público de feedback do closer** (acessado por token). A estrela "Qualidade do lead" (1–5) estava sendo usada pelos closers como proxy da dificuldade da reunião, tornando a métrica inútil para o SLA do pré-vendas. Trocamos essa estrela por uma **conferência objetiva da qualificação** e mantivemos a estrela apenas como leitura subjetiva ("Chance de fechar"), sem peso na avaliação do SDR. Escopo: **só frontend + endpoint de submissão** — as colunas e os 3 constraints já tinham sido aplicados no banco antes da sessão. Em seguida, como o `decisor_presente` deixou de ser preenchido, **re-fonteamos a métrica "Decisor na Call %" do Sales Hub** derivando-a das divergências. Merges: **#251** (form), **#254** (métrica).

## O que entrou na `main` (PRs)

| PR | Commit (squash) | Conteúdo |
|----|-----------------|----------|
| #251 | `1274d84` | troca "qualidade do lead" por conferência da qualificação no feedback do closer |
| #254 | `1bb755c` | re-fonteia "Decisor na Call %" a partir das divergências do closer (RPC `get_leads_for_v4sales`) |
| #266 | `22aa2d1` | alinha o output do feedback (e-mails/alerta + dashboards) à nova semântica |
| #275 | `9698d09` | gestor volta a receber TODO feedback do closer (alerta × informativo) |
| #292 | `705e579` | pergunta dedicada "O decisor estava na call?" de volta + métrica prioriza campo explícito |
| #320 | `5b1451c` | enriquece o e-mail de feedback (SDR + gestor): decisor, chance de fechar, data, badge, botão Ver lead |
| #330 | `158fac9` | Observações obrigatória quando Realizada (descrever a call) + placeholder guiado |

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
- `decisor_presente` (métrica "Decisor na Call %" do Sales Hub) **deixou de ser alimentada** pelo formulário. A coluna continua no banco. **Métrica re-fonteada na mesma sessão** — ver seção abaixo.

## Nova fonte da métrica "Decisor na Call %" (#254 — `1bb755c`)

Resolvido na mesma sessão. Como o form parou de alimentar `closer_feedback_requests.decisor_presente`, a métrica do Sales Hub ficaria sem fonte. Escolhida a **Opção 1 (derivar das divergências)**, **contida 100% na RPC `get_leads_for_v4sales` do Enriquece** — n8n e Sales Hub **não mudam**.

- **Migration** `supabase/migrations/20260810120000_decisor_presente_from_divergencias.sql` (aplicada em produção via MCP; PR #254 mergeado).
- **Lógica:** `decisor_presente` deixa de ser lido direto e passa a ser **derivado** por lead, na última resposta `meeting_done`:
  - `qualificacao_aderente IN (bateu, divergiu)` → `NOT ('decisor' = ANY(divergencias))` (TRUE = info de decisor conferiu; FALSE = "decisor" foi marcado como divergência)
  - **fallback** para o `decisor_presente` legado (respostas ago/2026 sem qualificação) → histórico preservado
  - `nao_validado` / sem resposta → NULL
- **Pipeline intacto:** o n8n "Sync Leads PV" (`cNdb9RZLqFEM5S3t`) continua lendo um booleano da RPC e gravando em `leads_pv.decisor_presente`; a view `v_decisor_na_call_mensal` (SH) calcula igual.
- **Validação ponta a ponta:** RPC deriva 15 sinais (12 TRUE / 3 FALSE) → **sync disparado manualmente** (execução n8n `1248837`, success) → `leads_pv` (SH) recebeu 15 (12/3) → view Ago/2026 = **80,0% decisor na call, cobertura 68,2%**. Meses anteriores ficam 0 porque o sync busca só o mês corrente (`p_from_date` = início do mês) e o sinal de decisor só existe desde ago.
- ⭐ Como a qualificação é **obrigatória** em toda reunião realizada, a cobertura tende a subir mais rápido que com o `decisor_presente` opcional antigo.

### Monitoramento pós-deploy (syncs agendados)

O sync "Sync Leads PV" roda **a cada 15 min** (webhook nos minutos :07/:22/:37/:52), ~3s por execução, todas `success`. Acompanhamos vários ciclos agendados e a métrica evoluiu **organicamente com respostas reais do form novo** (não só o backfill):

| Momento (UTC) | Reuniões | Respondidas | Decisor | Cobertura | Decisor na Call % |
|---|---|---|---|---|---|
| Backfill inicial (sync manual `1248837`) | 22 | 15 | 12 | 68,2% | 80,0% |
| Sync agendado ~17:07 | 23 | 15 | 12 | 65,2% | 80,0% |
| Sync agendado ~18:37 | 23 | 18 | 15 | 78,3% | 83,3% |
| Baseline monitor 21:22Z | 24 | 19 | 16 | 79,2% | 84,2% |

- Cada nova reunião realizada sem feedback ainda **derruba a cobertura** (denominador sobe); quando o closer responde pelo form novo, `respondidas` e `decisor` sobem e a métrica se recompõe.
- Todas as respostas novas observadas vieram do regime novo (`qualificacao_aderente`) e derivaram `decisor_presente=TRUE` (nenhuma marcou "decisor" como divergência) → confirma a derivação da RPC ponta a ponta, em produção, com usuários reais.
- Método: espera em background até cada slot + `search_executions` (n8n) + leitura da `v_decisor_na_call_mensal` (SH). Também deixamos um monitor de sessão lendo a view via REST (anon key) a cada 90s, emitindo só em mudança — **encerrado ao fim do acompanhamento**.

## Correção do output do feedback (#266 — `22aa2d1`)

Um e-mail real de alerta ao gestor revelou que a **camada de output** ficou com a semântica antiga (o form + endpoint foram migrados, mas as notificações/dashboards não). O e-mail mostrava "Qualidade do lead ★★☆☆☆" e disparava por "nota baixa (2/5)" — mas `rating` virou **"Chance de fechar"** (leitura subjetiva do closer, sem peso no SLA do SDR). ⭐ **Lição:** ao mudar a semântica de uma coluna, varrer TODOS os consumidores — e-mails, notificações in-app, dashboards, analytics — não só o form/endpoint.

- **`route.ts` (e-mails + alerta):** gatilho do alerta ao gestor deixa de ser `rating <= 2` e passa a ser **no-show / remarcada / `qualificacao_aderente = 'divergiu'`**; motivo do alerta lista as divergências; "Qualidade do lead" → "A qualificação bateu?" + itens que não conferiram; rating vira "Chance de fechar (leitura do closer)"; remove `RATING_LABELS` obsoleto. Notificação in-app e metadata passam a carregar `qualificacao_aderente`/`divergencias`.
- **Dashboards:** `FeedbackAnalyticsView` / `CloserPerformanceCards` / `CloserFeedbackTable` — "Nota/Nota média/Rating" → **"Chance de fechar"**. `LeadDetailLayout` — card do closer passa a exibir **"A qualificação bateu?"** (com divergências) como sinal primário; `fetch-closer-feedback` traz `qualificacao_aderente`/`divergencias`.
- **Decisão de produto (via AskUserQuestion):** alerta ao gestor = no-show/remarcada/divergiu; rating baixo **não** alerta mais.
- 2 commits no mesmo PR (`fix(feedback)` + `refactor(dashboards)`). typecheck/lint/testes verdes. E-mails revisados por prévia HTML (não disparei e-mail real — vai a managers reais).

### Efeito colateral do #266: gestor parou de receber (#275 — `9698d09`)

Dias depois, o gestor reportou não estar recebendo os feedbacks dos closers novos. **Não era bug** — diagnóstico via dados: desde o form novo, as 11 respostas foram **todas "Bateu"**, e o #266 (correto na época) silenciava os casos saudáveis para o gestor. O pipeline estava intacto (o `rescheduled` de 11/ago notificou normalmente; os alertas de `meeting_done` até 11/ago 16:18 eram do **código antigo** ainda no ar, que alertava por nota baixa). ⭐ **Lição:** silenciar "casos saudáveis" pode virar "o gestor não recebe nada" quando o caso saudável é a maioria.

**Decisão do gestor (via AskUserQuestion):** receber **todo** feedback respondido. Fix (`route.ts`): `notifyManagers` é **sempre** chamado (removido o gate `isActionable` no POST); `isActionable` vira parâmetro e só muda a **moldura** — **alerta** (⚠️ assunto + caixa "Motivo do alerta") para no-show/remarcada/divergiu; **informativo** ("Feedback do closer", sem caixa) para bateu/não validado. `metadata.actionable` reflete o caso real. Afeta só feedbacks futuros (os "Bateu" já respondidos ficam visíveis em Estatísticas → Feedbacks). typecheck/lint verdes.

## Pergunta do decisor de volta (#292 — `705e579`)

Um gestor apontou que o form reformulado **perdeu a pergunta sobre o decisor na call**. Na reforma, "decisor" tinha virado só um item de divergência da qualificação — o que **mistura presença física do decisor com aderência da informação** do pré-vendas. ⭐ **Lição:** ao "consolidar" um campo dentro de outro conceito, confira se os dois medem a mesma coisa; presença ≠ aderência. Decisão do gestor (AskUserQuestion): pergunta dedicada de volta.

- **`FeedbackForm.tsx`**: nova pergunta **"O decisor estava na call? Sim/Não"** (só Realizada, obrigatória) → grava `decisor_presente`; **"Decisor" sai das divergências** (não capta em dois lugares).
- **`route.ts`**: aceita/valida `decisor_presente` (obrigatório em meeting_done); "decisor" sai dos `VALID_DIVERGENCIAS` (constraint do banco mantém p/ histórico).
- **Métrica** (`get_leads_for_v4sales`, migration `20260813130000`, aplicada em prod): passa a **priorizar o campo explícito** — `COALESCE(decisor_presente, derivação)`. ⭐ **Corrige bug latente:** sem isso, um "Bateu" com decisor **ausente** era contado como **presente** (a derivação dava TRUE). Validado: gravou `decisor_presente=false` num "Bateu" → métrica retornou FALSE.
- **`LeadDetailLayout` + `fetch-closer-feedback`**: card exibe "Decisor na call: Sim/Não".
- ⚠️ Histórico: as ~13 respostas "Bateu" anteriores não têm `decisor_presente` (campo estava fora do form) → seguem pela derivação. Dado explícito vale a partir deste deploy.
- ✅ **Deploy confirmado em prod:** `/api/version` = `705e579` (= merge do #292) **e** prova visual — o form de `app.enriqueceai.com.br` renderiza "O decisor estava na call? Sim/Não" (obrigatória) quando Realizada.

## E-mail de feedback enriquecido (#320 — `5b1451c`)

Gestor apontou que o e-mail estava "pobrinho". ⭐ **Mesmo drift do #292 mordendo de novo:** quando trouxemos a pergunta do decisor de volta, atualizamos form/endpoint/métrica/card do lead — **mas o e-mail ficou de fora** (não mostrava o decisor). O e-mail do gestor também nunca teve "Chance de fechar" e o "Acesse a plataforma" era texto morto.

- **Fonte ÚNICA** para os dois e-mails (SDR + gestor): `buildFeedbackDetailsHtml` + `buildLeadButtonHtml` (`route.ts`) — extraída justamente para não voltarem a divergir (a raiz do problema era a duplicação).
- Adiciona: **badge colorido** do resultado, **data da reunião** (`meeting_starts_at`, BRT), **"O decisor estava na call? Sim/Não"**, **"Chance de fechar"** (agora também no e-mail do gestor), **botão "Ver lead na plataforma"** com link real. Observações **escapadas** (anti-injeção de HTML). `decisor_presente` threaded até `notifySdr`/`notifyManagers`.
- ⚙️ **Nota de processo:** ambiente local resetou p/ o branch inicial da sessão; PR feito via **worktree isolado** em `origin/main` (patch do route.ts) para não arrastar 6 arquivos alheios do working tree.

## Observações obrigatória em Realizada (#330 — `158fac9`)

Gestor viu um feedback "Bateu" sem observação e pediu para tornar o campo **obrigatório** — o closer deve descrever a call (ex.: se o lead entrou pelo **computador ou celular**, comportamento, objeções, próximos passos). Diagnóstico prévio (30 dias): de 104 respondidos, **89 com obs útil, 13 em branco, 2 lixo** — não era bug, era campo opcional pouco preenchido.

- **Obrigatório só em "Realizada"** (só aí há call a descrever); No-show/Remarcada seguem opcionais.
- `FeedbackForm.tsx`: rótulo com `*` quando Realizada; **placeholder guiado**; bloqueia envio (botão desabilitado + erro "Escreva uma observação sobre a reunião."); textarea 3 linhas.
- `route.ts`: validação server-side espelha o cliente (`meeting_done` sem obs → 400).
- Validado ponta a ponta (sem obs trava; com obs grava o `comment`). typecheck/lint verdes.

## Fora de escopo (intactos)

Enum `closer_feedback_result`; envio do e-mail de solicitação; lembretes (`reminder_sent_at`/`reminder_count`); view `vw_sla_qualificacao_sdr`.

## Follow-ups

- [x] ~~Confirmar o formulário novo no ar em produção~~ — confirmado (screenshot de `app.enriqueceai.com.br` com o form reformulado)
- [x] ~~Definir a origem da métrica "Decisor na Call %" no Sales Hub~~ — feito no #254 (derivada das divergências, ver seção acima)
- [x] ~~Alinhar o output do feedback (e-mails/alertas + dashboards) à nova semântica~~ — feito no #266
- [ ] (Opcional / futuro) Granularidade por dimensão no SH (verba/dor/timing além de decisor) — exigiria propagar `divergencias` até `leads_pv` + nova view/painel (Opção 2). Vale também um KPI de **aderência da qualificação %** (bateu ÷ respondidas) nos dashboards internos.
- [ ] (Opcional) Extrair o componente de estrelas para `src/shared` — hoje há 2 implementações (interativa inline no form + read-only na `CloserFeedbackTable`)
