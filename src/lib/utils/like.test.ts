import { describe, expect, it } from 'vitest';

import { escapeLikePattern } from './like';

describe('escapeLikePattern', () => {
  it('escapa underscore para não virar wildcard de um caractere', () => {
    // Sem escape, `joao_silva@x.com` casaria com `joaoXsilva@x.com` e o lead
    // novo seria descartado como duplicado.
    expect(escapeLikePattern('joao_silva@x.com')).toBe('joao\\_silva@x.com');
  });

  it('escapa porcentagem', () => {
    expect(escapeLikePattern('desconto%')).toBe('desconto\\%');
  });

  it('escapa a barra invertida antes dos demais', () => {
    expect(escapeLikePattern('a\\_b')).toBe('a\\\\\\_b');
  });

  it('deixa valores sem caractere especial intactos', () => {
    expect(escapeLikePattern('contato@empresa.com.br')).toBe('contato@empresa.com.br');
    expect(escapeLikePattern('EMPRESA X LTDA')).toBe('EMPRESA X LTDA');
  });
});
