<!-- Título do PR: fix(leads): remove item duplicado "Reunião não aconteceu" do menu do lead -->
<!-- Branch: fix/remove-duplicate-noshow-menu-item → main -->
<!-- PR #278 — mergeado (squash 173b103) -->

## Problema

No header do lead (`LeadDetailHeader`), o menu de ações **"..."** trazia o
item **"Reunião não aconteceu"**, que disparava exatamente o mesmo handler
que o botão amarelo **"No-show"** do topo — `handleNoShow` →
`markMeetingNoShow`. Eram **duas entradas de UI para a mesma ação**,
aparecendo juntas em leads com reunião agendada e status aberto. Dualidade
sem ganho: confundia sem oferecer caminho novo.

## O que este PR faz

Remove o `DropdownMenuItem` "Reunião não aconteceu" do dropdown
(`src/features/leads/components/LeadDetailHeader.tsx`, 6 linhas). O botão
**No-show** do topo permanece como **ponto único** dessa ação.

- Ícone `CalendarX` e o handler `handleNoShow` continuam em uso pelo botão
  No-show — **nenhum import ficou órfão**.
- Demais itens do menu (Enviar Email · Inscrever em Cadência · Agendar
  Reunião · Enriquecer) **não** têm equivalente entre os botões principais,
  então não são duplicatas — mantidos.

## Efeito colateral conhecido (aceito)

O item de dropdown era a **única** forma de marcar no-show num lead já
**"Ganho"** (o botão No-show some via `isClosed`, mas o status `won` não é
`unqualified`, então o item aparecia). Com a remoção, no-show passa a ser
acessível só enquanto o lead **não está fechado** (`!isClosed`). Removido por
completo conforme a instrução ("remover a dualidade"); se o cenário
"marcar no-show em lead ganho" voltar a ser necessário, reintroduzir o item
**apenas** sob `isWon`.

## Verificação

- `pnpm typecheck` ✅ verde
- Compilação do dev server (Next 16 / Turbopack) sem erros
- CI **Lint · Typecheck · Test · Build** ✅ `pass` (4m23s) antes do merge

## Status

- PR **#278** mergeado na `main` (squash `173b103`, branch deletada)
- Merge na `main` dispara **auto-deploy no Coolify** → produção
  (lembrete: CI verde ≠ já no ar; hard refresh ao conferir)
