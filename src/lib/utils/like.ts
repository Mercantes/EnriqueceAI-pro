/**
 * Escapa um valor que será usado como padrão em `LIKE`/`ILIKE`.
 *
 * PostgREST repassa o valor cru para o operador do Postgres, então `%` e `_`
 * dentro do dado viram wildcards. Em dedup por igualdade isso é um bug de
 * correção, não de performance: `joao_silva@x.com` casa com `joaoXsilva@x.com`
 * e o lead novo é descartado como "duplicado".
 *
 * Use quando o valor precisa ser comparado por igualdade case-insensitive via
 * `.ilike()`. Para busca textual (onde o wildcard é intencional) continue
 * removendo os caracteres com `.replace(/[%_]/g, '')`.
 */
export function escapeLikePattern(value: string): string {
  // A barra invertida precisa ser escapada primeiro, senão escaparia os
  // escapes inseridos logo em seguida.
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, (c) => `\\${c}`);
}
