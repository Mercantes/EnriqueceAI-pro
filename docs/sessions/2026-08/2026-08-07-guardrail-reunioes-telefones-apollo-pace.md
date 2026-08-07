# Sessão 2026-08-07 — Guard-rail, reunião/closer, telefones dos sócios, Apollo, pace do dashboard, novo tenant

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Sessão longa, dirigida por reports do gestor. Vários bugs de produto corrigidos + investigações. Merges: #233, #234, #236, #237, #238.

## O que entrou na `main` (PRs)

| PR | Commit | Conteúdo |
|----|--------|----------|
| #233 | `bc4c3b0` | Guard-rail: bloqueia inscrição de lead sem responsável (cadência manual) |
| #234 | `c725b3a` | Closer obrigatório ao agendar reunião (evita perder briefing + grupo) |
| #236 | `f25bff3` | Celulares dos sócios não poluem a lista de telefones do lead |
| #237 | `151c83e` | Mostra o motivo do erro na importação do Apollo |
| #238 | `3bbd0d8` | Pace do dashboard considera só dias úteis já concluídos (exclui hoje) |

> ⚠️ **CI travado (~10h UTC):** o GitHub Actions ficou preso em `queued`/`cancelled` por ~1h30 (runner `ubuntu-latest` indisponível — não era o PR). O #233 foi re-disparado por um monitor de hora em hora e passou às 09:59 UTC. Regra reforçada: nunca mergear sobre check `CANCELLED`/não-verde.

---

## #234 + caso Imperius Fitness (reunião sem closer)

**Report (Matheus):** marcou reunião para o closer Jhonata, mas o **BANT não chegou no e-mail dele** e o **grupo de WhatsApp não foi criado**.

**Causa-raiz (uma só):** a reunião foi salva **sem closer** (`closer_id` null). Em `scheduleMeeting`, **tanto o briefing quanto o grupo de WhatsApp são gated em `input.closerId`** (linhas 137 e 158) — sem closer, os dois são pulados **silenciosamente**. O grupo **não deu erro**: nunca foi tentado (o WhatsApp do Matheus estar conectado é irrelevante — o código não chegou a chamar o Evolution). O campo de closer era opcional, sem validação.

**Fix #234:** closer obrigatório no `ScheduleMeetingModal` + `LeadScheduleTab` + gate no servidor (`MISSING_CLOSER`).

**Retro deste lead (via MCP/endpoint):** setei `closer_id`=Jhonata e disparei `POST /api/admin/resend-meeting-briefing` (briefing reenviado ✅). **Grupo de WhatsApp ainda PENDENTE** — não há endpoint para recriar grupo retroativo (`createMeetingWhatsAppGroup` só roda dentro do agendamento). Matheus está `connected` no Evolution. Opções (Vini não decidiu): (1) Matheus re-agenda pelo app com o Jhonata → cria o grupo; (2) criar endpoint admin "recriar grupo".

**Adjacente:** `meet_link` nulo nessa reunião. Conta Google do Matheus (Calendar+Gmail) = **matheus.m.santos@v4company.com** (Workspace, NÃO pessoal — Meet funcionaria). Provável ter desmarcado o toggle "gerar link do Meet" (opcional, default ligado). Não investigado a fundo.

---

## #236 — "Porrada de telefones" no lead (KAP · 02f81149)

**Report:** dezenas de telefones que o SDR não pôs; excluir + salvar não persiste (voltam).

**Causa-raiz:** `buildInitialPhones` (edição) e `allPhones` (visualização) mesclavam **`socios[].celulares`** (auto-enriquecidos do CNPJ) na lista de telefones. KAP tinha **20 celulares** entre 7 sócios. O save só grava `leads.phones`/`telefone`, nunca `socios.celulares` → re-derivavam a cada reload. O array próprio do lead sempre teve **1** telefone (não era corrupção).

**Fix #236:** lista "Telefone(s)" (edição+visualização) só com telefones próprios do lead; celulares dos sócios vão para subseção **recolhível só-leitura** ("Telefones dos sócios · N", com nome do sócio + badge WhatsApp + copiar).

---

## #237 — Erro na importação do Apollo (sem motivo)

**Report:** import do Apollo deu "1 Erro" sem dizer por quê.

**Diagnóstico:** não é o banco (sem erro de INSERT nos logs do Postgres). É a etapa de **reveal do Apollo** (`POST /people/match`, consome crédito): `enrichPerson` rejeitado (402 sem crédito / 429 rate-limit / 403 chave) ou `person: null`. Search é grátis e funcionou; o reveal falhou. **Suspeito nº1: crédito do Apollo esgotado.** Conexão da org existe.

**Fix #237 (observabilidade):** `importApolloLeads` coleta os motivos distintos (`errorSamples`) + `describeApolloError` traduz as falhas; a tela mostra o "porquê" num box. Motivo exato deste caso: refazer o import (já mostra) ou checar créditos Apollo / log Coolify `[apollo-import] enrichPerson failed`.

---

## #238 — Pace do dashboard: exclui o dia de hoje

**Pergunta do gestor:** o "esperado até hoje" contava hoje ou ontem? → Contava **hoje como dia útil inteiro** (`throughDay` inclusivo), cobrando a cota do dia todo já de manhã → time parecia "abaixo do ritmo" cedo. Ex.: 1100, sexta 07/08 → 262 (`1100×5/21`).

**Decisão (opção 1):** pacear pelo último dia **concluído** (ontem no mês corrente). `currentDayOfMonthBrt` (fonte única) → `now.day-1`; consolidei os 2 cálculos inline (`dashboard-metrics`, `ranking`) no mesmo helper. Não afeta a linha de meta do gráfico nem a "actual". Ex. passa a ~210. Efeito colateral aceito: fica "otimista" durante o dia; no último dia do mês só bate 100% quando o mês vira.

---

## Novo tenant — Jll Roque & Co (alef.roque@v4company.com)

**Como fazer (Vini é admin):** usar a ferramenta admin do app — rota **`/admin/create`** (`createOrgWithManager`). Campos: Nome da Org `Jll Roque & Co`, Nome do Manager, Email `alef.roque@v4company.com`, Senha temporária (auto-gerada → enviar ao Alef). ⭐ o app é **one-org-per-signup** (trigger `handle_new_user` cria org nova por usuário) → **sem auto-join por domínio**, o `@v4company.com` **não** cai na V4 Amaral; tenant 100% isolado por RLS. Não criei a conta (regra: eu não crio contas/credenciais). `alef.roque` não existia e não há org "Jll Roque" hoje.

## Pendências / notas

- **Grupo WhatsApp Imperius Fitness** — decidir opção 1 ou 2 (reunião era 08/08 09h).
- **API4COM ramal 1042** — re-rodar o `check-api4com-config` (ver Pending Actions da memória).
- **⚠️ Log poluído:** `invalid input syntax for type uuid: "undefined"` recorrente (~2-3/min) nos logs do Postgres — query passando "undefined" como uuid (mesma classe do crash `?assigned_to=undefined` / helper `isUuid()` em `src/lib/utils/uuid.ts`). Vale caçar a origem (algum filtro de página).

## Disciplina de merge

Todos os PRs: head SHA == commit local + check `SUCCESS` no SHA exato antes do merge.
