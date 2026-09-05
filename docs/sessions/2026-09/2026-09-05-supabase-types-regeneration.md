# 2026-09-05 — Types do Supabase regenerados e `pnpm gen:types` destravado

## Origem
Ao fechar a story `activity-skip-guardrails` (mesmo dia), tentamos regenerar `src/lib/supabase/types.ts` pelo MCP do Supabase. O arquivo do repo tinha 1903 linhas / 36 tabelas e estava defasado há meses (editado à mão a cada migration). O gerado tem 5866 linhas / 161 tabelas e views. Substituir quebrou o typecheck: **63 erros em 30 arquivos**. Revertemos e abrimos a story `docs/stories/supabase-types-regeneration.story.md` (validada pelo @po, GO 10/10).

## Diagnóstico (duas camadas)
1. **`lib/supabase/from.ts`** — o cast de retorno `ReturnType<SupabaseClient<Database>['from']>` colapsava para a tabela `leads`, e todo `update`/`insert` de qualquer tabela era validado contra as colunas dela (29 erros falsos, ex.: "`abm_enabled` does not exist" em `organizations`). Trocar para `SupabaseClient<any>` derruba 63 → 34.
2. **34 casts `builder as Promise<…>`** dentro de `Promise.all` em 14 arquivos: com o builder agora tipado, o TS recusa a conversão (TS2352). Correção textual `as unknown as Promise<…>`; em `api-key.service.ts` o builder foi envolvido em `Promise.resolve()` para expor `.catch`.

## Implementação (worktree `.claude/worktrees/supabase-types-regeneration`)
- Fase 1: `from()` solto; `types.ts` regenerado + Prettier; 34 fixes. typecheck/lint/build ✅, 1870 testes ✅ sem alteração de asserção.
- Fase 1.4 (medida e descartada): `from<T extends keyof Tables>()` tipado de verdade → **147 erros em 85 arquivos**. Story futura de tipagem por feature.
- Fase 2: script `pnpm gen:types` (CLI já é devDependency, 2.76.10, logada; output byte-a-byte igual ao do MCP; idempotente — hash `953d01eac6b2`). `CLAUDE.md`, `.claude/rules/dev-checkpoints.md` e `.aios-core/product/checklists/deploy-verification-checklist.md`: `TYPES_STALE` deixa de ser aceito.
- Check de drift no CI **adiado**: `ci.yml` não tem secret do Supabase; até lá o Checkpoint 3 é a trava.

## QA gate: PASS
Quinn re-executou a suíte e o `gen:types`. Três observações low: `gen:types` redireciona direto (se a CLI falhar, arquivo vazio — typecheck denuncia; melhor temp + `mv`); Prettier reordenou imports de `api-key.service.ts`; CodeRabbit sem rodar (login interativo).

## Entrega
- Dois commits: `661a2fa8` (`chore(types): regenerate`, só o arquivo gerado) e `165206c2` (`fix(types)`, o que se revisa).
- PR [#366](https://github.com/v4amaraltech/EnriqueceAI-pro/pull/366) → merge squash `e22a791e` às 18:48 UTC, CI verde. Deploy Coolify confirmado por `/api/version`.
- Story marcada **Done** neste PR de docs.

## ⭐ Lições
- `pnpm format:check` global falha em **879 arquivos pré-existentes** e não está no CI — não é bloqueio de story; formatar só o que se reescreve.
- Worktree funcionou para isolar da sessão paralela (que na story anterior trocou a branch do checkout principal duas vezes). O sandbox do worktree recusa comandos compostos com `perl`/heredoc que "podem ser git" — separar em passos simples.
- `ReturnType` de função sobrecarregada não é o tipo que você espera; quando o wrapper for tipado de verdade, será por generics, não por `ReturnType`.

## Próximos passos
- `gen:types` em temp + `mv` (1 linha) no próximo PR que tocar `package.json`.
- Story futura: tipagem real do `from()` por feature (147 sites).
- Remover o worktree `.claude/worktrees/supabase-types-regeneration` quando o Vini pedir; `git pull` na `main` do checkout principal.
