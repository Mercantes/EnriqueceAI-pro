# Sessão 2026-08-09 — Cron de webhook de reunião pro n8n

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Sessão focada em uma frente nova: um **cron que dispara um webhook para o n8n externo** na véspera (D-1) e no dia da reunião. Também mergeados o #241 (BANT em bullets) no início. Merges: #241, #242, #243.

## O que entrou na `main` (PRs)

| PR | Commit | Conteúdo |
|----|--------|----------|
| #241 | `0987039` | qualificação (BANT) em bullets + tom informal |
| #242 | `fa4fc08` | cron dispara webhook n8n na véspera e no dia da reunião |
| #243 | `34afb5c` | payload do webhook inclui `responsavel_email` (e-mail do closer) |
| #244 | `cc569e2` | debug temporário do toggle no cron (diagnóstico — removido no #246) |
| #245 | `311643d` | gate do webhook por flag no banco (`app_flags`), além da env |
| #246 | `f529aed` | fallback de telefone no payload + remove o debug do #244 |

---

## Webhook de reunião → n8n (#242 + #243)

**Pedido:** cron que faz POST em `https://n8n.v4companyamaral.com/webhook/enriquece/reuniao-marcada` no dia da reunião. Decisões (via AskUserQuestion): **dois disparos** (D-1 `momento:"d1"` e no dia `momento:"dia"`), a partir das **8h BRT**; `lead_id` = **UUID do Enriquece**; escopo **só V4 Amaral**.

**Arquitetura (standalone, desacoplado da régua de e-mail/WhatsApp):**
- **View `v_meeting_webhook_candidates`** — reunião válida/futura + `meet_link`/`calendar_event_id` (última interaction `meeting_scheduled`) + telefone (última ligação conectada, `normalize_br_phone`) + `responsavel_email` (`closers.email` via `leads.closer_id`). Mesma derivação da `v_reminders_due`.
- **Tabela `meeting_webhook_dispatch_log`** — idempotência por `(lead_id, meeting_starts_at, momento)`. Grava **só no sucesso** → falha transitória re-tenta no próximo tick. Reagendou (muda `meeting_starts_at`) → chave nova → dispara de novo.
- **Serviço** `src/features/meeting-reminders/services/meeting-webhook-dispatch.service.ts` — janela (≥8h BRT; `dia`=reunião hoje BRT, `d1`=amanhã BRT), monta payload, POST (timeout 10s, header opcional `x-webhook-secret`), grava log.
- **Action** `run-meeting-webhook-dispatch.ts` + **rota** `POST /api/cron/meeting-webhook-dispatch` (`verifyCronSecret`).

**Payload:**
```json
{
  "lead_id": "<UUID>",
  "nome": "João da Silva",
  "telefone": "11988887777",
  "inicio": "2026-08-11T20:00:00.000Z",
  "link": "https://meet.google.com/xck-jbus-trw",
  "event_id": "abc123doGoogleCalendar",
  "responsavel_email": "pedro@v4company.com",
  "momento": "d1"
}
```
- `telefone` = nacional **sem 55** (`toNationalPhone`; `normalize_br_phone` devolve `55DDD…`). 1 linha pra reverter se o n8n quiser com 55.
- `inicio` = `meeting_starts_at` em ISO UTC. `link`/`event_id`/`responsavel_email` = `null` quando ausentes.

**⭐ Origem dos campos-chave:**
- `closer` é **entidade própria** (`closers`: `name`/`email`/`phone`), referenciada por `leads.closer_id` — **NÃO** é `auth.users`. Por isso `responsavel_email` sai de `closers.email` (join na view), não de `resolveUserEmails`.
- `event_id` = id do evento **na agenda onde foi criado no agendamento**. Pra o n8n mover, a conta do n8n precisa de escrita nessa agenda (tarefa de compartilhamento do lado deles).

## Toggles por env (dry-run por default)

| Env | Default |
|-----|---------|
| `MEETING_WEBHOOK_ENABLED` | `false` (dry-run — nada dispara) |
| `N8N_MEETING_WEBHOOK_URL` | `https://n8n.v4companyamaral.com/webhook/enriquece/reuniao-marcada` |
| `N8N_MEETING_WEBHOOK_SECRET` | — (opcional, header `x-webhook-secret`) |
| `MEETING_WEBHOOK_MOMENTOS` | `d1,dia` |
| `MEETING_WEBHOOK_ORG_ID` | `c2727473…` (V4 Amaral) |

## O que está aplicado em produção (via MCP)

- ✅ Migrations `20260808120000` (view + tabela), `20260809120000` (add `responsavel_email`), `20260809130000` (`app_flags`) e `20260809140000` (fallback de telefone) aplicadas no Enriquece (`dhkmonctyoaenejemkrt`).
- ✅ `pg_cron` **`meeting-webhook-dispatch`** agendado `0 * * * *`, ativo. Bearer copiado do job `meeting-reminders` (secret atual, não impresso).

## Ativação — a novela do toggle (⭐ lição)

Ligar em produção **não** foi trivial e virou a maior parte da sessão:

1. **Toggle via env do Coolify não funcionava.** Setei `MEETING_WEBHOOK_ENABLED=true` + redeploy várias vezes → a rota seguia `enabled:false`.
2. **Debug temporário (#244)** na resposta da rota provou a causa: `process.env.MEETING_WEBHOOK_ENABLED` chegava **`undefined`** no runtime (não era aspas/typo — a env simplesmente não entrava no processo, mesmo no container novo). ⭐ Env do Coolify **não** estava chegando ao runtime desta app.
3. **Plano C — flag no banco (#245):** tabela global `app_flags` (`key`/`enabled`). Gate passou a ser `enabled = (env === 'true') OR app_flags['meeting_webhook_enabled']`. Assim **ligo/desligo via MCP, sem depender do Coolify**.
4. **Liguei a flag via MCP** (`UPDATE app_flags SET enabled=true …`) → disparo real: `enabled:true`, **sent:2** (os 2 leads `d1` de amanhã), idempotência gravada em `meeting_webhook_dispatch_log`.
5. **Fallback de telefone (#246):** um dos leads foi com `telefone:null` (sem ligação conectada). Corrigido na view: `COALESCE(ligação conectada → leads.telefone → 1º de leads.phones)`. Cobertura **4/8 → 8/8**. Mesmo PR removeu o debug do #244.
6. **Disparos reais confirmados:** os 2 leads de amanhã reenviados com payload completo (Laisla Alves — telefone via fallback; Henrique Construvision — telefone da ligação), n8n `Workflow was started`/200.

**⭐ Como ligar/desligar daqui pra frente (NÃO usar env do Coolify):**
```sql
UPDATE public.app_flags SET enabled = true  WHERE key = 'meeting_webhook_enabled'; -- liga
UPDATE public.app_flags SET enabled = false WHERE key = 'meeting_webhook_enabled'; -- desliga
```
Vale no próximo tick, sem redeploy. Estado atual: **enabled = true (NO AR)**.

## Lado n8n — quem consome o payload (⭐ mapa)

O webhook `enriquece/reuniao-marcada` cai em **2 workflows** (instância `n8n.v4companyamaral.com`):

1. **"WhatsApp - Disparo de Confirmacao (Ativo)"** (`1NOxAbQssHQrAFGv`) — recebe o webhook, **normaliza o payload** e dispara o template `confirmar_reuniao_sal`. ⭐ Já lê o payload certo: `event_id: p.event_id ?? p.calendar_event_id`, e `calendar_id: p.calendar_id ?? p.responsavel_email ?? p.closer_email` (usa nosso `responsavel_email` como agenda do closer). Fluxo: `Normalizar Payload` → RPC `pode_enviar_confirmacao(event_id, momento)` (dedup) → envia template → RPC `registrar_envio_confirmacao(event_id, …, calendar_id, wamid)` (**amarra wamid↔event_id**).
2. **"WhatsApp - Respostas de Reuniao"** (`CYeIDuEtSYgIatE7`) — trata os cliques dos botões (Confirmar/Reagendar). Pega `event_id`/`calendar_id` pela RPC `marcar_interacao_confirmacao(wamid)`, calcula slots livres e **move o evento** (`Mover Evento na Agenda`, id cru via API).

⭐ **Formato do `event_id`:** o app manda o **id cru** do Calendar (ex.: `l3o0simckkkgln4uob3v8poaio`) — aceito pela API e pela validação do n8n. NÃO é o base64 de URL (`NHZw…`, que decodifica pra `4vpsa..._2026...Z <email>`).

## Fix no n8n — agenda do closer no reagendamento (⭐)

**Bug:** no "WhatsApp - Respostas de Reuniao", o nó **`Buscar Ocupados`** (disponibilidade pra sugerir horários no reagendamento) estava com a agenda **hardcoded** em `jhonata.banqueri@v4company.com` — ignorava o `calendar_id` da RPC. Pra qualquer closer ≠ Jhonata, sugeria horários da agenda errada. (O nó `Mover Evento na Agenda` já usava `calendar_id` dinâmico; só o `Buscar Ocupados` ficou preso.)

**Fix aplicado via MCP** (`update_workflow`, workflow ativo → já valendo): `Buscar Ocupados.calendar` → `={{ $('Marcar Reagendamento').first().json.calendar_id }}`. Validar no próximo reagendamento real de um closer ≠ Jhonata.

## Pendências herdadas (não desta frente)

- Grupo de WhatsApp do lead Imperius Fitness — Matheus re-agenda pelo app OU endpoint "recriar grupo".
- Novo tenant **Jll Roque & Co** (alef.roque@v4company.com) — provisionar em `/admin/create`.
- Re-rodar `check-api4com-config` do ramal 1042 (Pending Actions da memória).

## Disciplina de merge

#241 a #246: head SHA == commit local + check `SUCCESS` no SHA exato antes do merge; mergeState CLEAN; squash + delete-branch.
