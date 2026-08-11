# Sessão 2026-08-10 — "Feitas hoje" contava envios automáticos

**Agentes:** @dev (Dex) · @devops (Gage) · **Branch base:** main

## Resumo

Bug reportado pelo gestor: o card **"Meu progresso hoje"** (tela de Atividades) mostrava **36 atividades realizadas** sem ele ter feito nenhuma. Investigação + correção. Mergeado (#259).

## O que entrou na `main` (PRs)

| PR | Commit | Conteúdo |
|----|--------|----------|
| #259 | `f8eef97` | "feitas hoje" conta só atividade manual + card segue o SDR do filtro |

## Diagnóstico

`fetchDailyProgress` (`src/features/activities/actions/fetch-daily-progress.ts`) conta `completed` = interações `performed_by = usuário LOGADO`, criadas hoje (BRT), canais `email/whatsapp/phone/linkedin/research`, excluindo notas (`is_note`) e `failed`. **Dois problemas:**

1. **Contava envios automáticos como atividade do SDR.** Os 36 do Vinicius = **34 e-mails da cadência "Inbound — E-mail (auto)"** (`type='auto_email'`, disparados pelo motor 8h–18h) + 2 ligações. O motor grava a interação com `performed_by` = dono do lead → inflava o "feitas". Mesma família dos bugs #219 (notas) e do "system events" do Rafael.
   - ⭐ **Régua de reunião também inflava** — o #228 (desta leva de trabalho) passou a gravar os toques da régua como `interactions` do SDR (`metadata.meeting_reminder=true`, `type='sent'`). Automáticos, não manuais → regressão.
2. **O card mostrava sempre o usuário LOGADO**, não o SDR do dropdown. Manager filtrando por "Ismael" via o próprio número.

## Correção (#259)

**`fetchDailyProgress`:**
- Exclui do `completed`: e-mails de cadência `auto_email` (busca os `cadences.id` com `type='auto_email'` e filtra em JS) **e** toques de régua (`metadata.meeting_reminder` via 2º `.or` null-safe — dois `.or` viram AND de grupos OR no PostgREST). Ligações/WhatsApp/e-mails **manuais** (cadência standard) continuam contando.
- Passou de `head count` para **fetch de rows** (`id, cadence_id`, limit 5000) pra poder excluir por cadência em JS.
- Aceita `sdrUserId` opcional (**manager-only**, valida `isManager`) → progresso de um SDR específico.

**`ActivityQueueView.tsx`:**
- Estado `sdrProgress` + `useEffect` em `[filters.sdr, isManager]`: quando um manager filtra por um SDR (≠ 'all'), refaz `fetchDailyProgress(sdrId)` e o card reflete **aquele** SDR. `effectiveProgress` = SDR filtrado ou (fallback) o `progress` do usuário logado.

## Verificação

- 6 testes (2 novos: exclusão de `auto_email` e de régua) ✅; `pnpm typecheck`, `pnpm lint`, `pnpm build` ✅.
- Conferido contra produção (10/ago): **Vinicius 36→2**, **Ismael 200→196** — só o automático saiu; o manual ficou.

## ⭐ Lições

- **Daily progress = atividade MANUAL do SDR.** Toda fonte automática que grava `interactions` com `performed_by`=SDR (cadência auto, régua de reunião, imports, system events) precisa sair da conta. Ao adicionar uma nova escrita de interação automática, lembrar de excluí-la aqui.
- **Cards "meu progresso" devem seguir o filtro de SDR** quando quem olha é manager — senão o número não bate com a fila filtrada.

## Pendências herdadas (não desta frente)

- Opção C (Service Account + DWD) do reagendamento n8n — guia + prompt em `docs/guides/n8n-google-calendar-service-account-dwd.md`; executar quando escalar.
- Compartilhar agendas do Pedro e Jhonata com a conta do n8n (checklist no handoff `2026-08-09-webhook-reuniao-n8n.md`).
