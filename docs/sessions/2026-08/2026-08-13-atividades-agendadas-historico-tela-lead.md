<!-- Título do PR: feat(activities): histórico de atividades agendadas na tela do lead -->
<!-- Branch: fix/inbound-lead-primary-contact → main -->
<!-- PR #299 — mergeado (squash 8612431a) — deploy confirmado em prod -->

## Problema / pedido

Na tela do lead, a aba **"Agendar atividade"** só tinha o formulário de
criação — não mostrava as atividades já agendadas. O pedido foi dar **paridade
com a aba "Agendar reunião"**, que lista as reuniões já criadas logo abaixo do
formulário.

## Investigação (o que difere as duas abas)

Componente central das 4 abas: `src/features/leads/components/LeadDetailTabs.tsx`.

- **"Agendar reunião"** (`LeadDetailTabs.tsx:167-262`): formulário
  (`ScheduleMeetingModal inline`) **+ bloco "Reuniões agendadas (N)"** que filtra
  o `timeline` (já carregado por props) por `type === 'meeting_scheduled'`.
- **"Agendar atividade"** (`LeadDetailTabs.tsx:157-160`): só renderizava
  `<ScheduleActivityForm leadId={lead.id} />`, sem listagem.

⭐ **As duas fontes de dados são diferentes:**
- Reuniões vivem em `interactions` (`type='meeting_scheduled'`, detalhe em
  `metadata`) — por isso saem "de graça" do `timeline`.
- Atividades agendadas vivem em **tabela própria `scheduled_activities`**
  (colunas `channel`, `scheduled_at`, `notes`, `status` pending/completed/
  cancelled, `completed_at`). Ao criar, o `schedule-activity.ts` também grava
  uma interação `system` no timeline (`metadata.system_event='activity_scheduled'`),
  mas essa interação é registro histórico imutável (não reflete cancelamento).

## Decisões (via AskUserQuestion)

1. **Fonte:** `scheduled_activities` (fonte da verdade, com status real) — e não
   o timeline (que mostraria atividade fantasma já cancelada).
2. **Escopo:** inicialmente "só a pendente vigente"; o usuário depois pediu
   **histórico completo** (pendentes + concluídas + canceladas).

## O que este PR faz

- **Nova server action `fetchScheduledActivitiesByLead`**
  (`src/features/activities/actions/fetch-scheduled-activities-by-lead.ts`):
  busca as `scheduled_activities` de **um lead** (todos os status), ordenadas por
  `scheduled_at` desc — a pendente (data futura) fica no topo. Valida o uuid do
  lead; escopo por org via RLS. ⭐ As actions existentes (`fetchPendingActivities`)
  só buscavam a **fila inteira do SDR**, não por lead — faltava esse recorte.
- **`ScheduleActivityForm.tsx`**: bloco **"Histórico de atividades (N)"** abaixo do
  formulário. Card por atividade com canal (trata "Ligação (WhatsApp)"), data/hora,
  observações e **badge de status** (Pendente âmbar / Concluída verde / Cancelada
  cinza). Cards não-pendentes ficam `opacity-70`. Botão **Cancelar** só nas
  pendentes — reusa a action existente `completeScheduledActivity(id, 'cancelled')`.
  Lista recarrega após agendar/cancelar. Fetch-on-mount com guard de unmount
  (padrão do `GoalsModal`).

## Nuance importante (dedup)

O agendamento faz **dedup**: um novo retorno marca os pendentes anteriores do
mesmo lead como `cancelled` (não apaga — `schedule-activity.ts:62-66`). Logo, no
histórico os retornos antigos aparecem como **"Cancelada"** e só o vigente como
**"Pendente"**. Comportamento esperado para um histórico.

## Escopo / fora do escopo

- ✅ Listagem read-only + cancelar pendente.
- ❌ Botão **Reagendar** (como nas reuniões) — não pedido; ficou de fora.
- ❌ Sem migração de banco (usa `scheduled_activities` existente).

## Verificação

- `pnpm typecheck` ✅ · `pnpm lint` ✅
- CI **Lint · Typecheck · Test · Build** ✅ `pass` (4m8s) antes do merge.
- **Deploy confirmado em prod:** `GET app.enriqueceai.com.br/api/version` →
  `commit=8612431a` (== head da `main`), logo após o merge.
- ⚠️ **Não houve verificação visual do card renderizado** — a tela exige login e
  não insiro credenciais. Falta um hard refresh + abrir um lead com atividade
  agendada para confirmar o render (typecheck/lint/CI dão a garantia de compilação).

## Status

- PR **#299** mergeado na `main` (squash `8612431a`, branch deletada).
- **No ar em produção** (confirmado via `/api/version`).

## Nota de processo (git)

Durante o trabalho a branch local foi trocada para `main` e sofreu `pull --ff-only`
por um processo externo (visto no reflog) — **não** pelos comandos desta sessão. A
`fix/inbound-lead-primary-contact` ficou intacta. Antes do PR, rebaseei a branch
sobre a `main` atualizada: o commit `ed706868` (fix inbound) foi **descartado** por
já estar na main via squash do #296 (`b4532d71`), deixando o PR limpo com só o
commit da feature. Force-push com `--force-with-lease` (branch nova, sem PR prévio).
