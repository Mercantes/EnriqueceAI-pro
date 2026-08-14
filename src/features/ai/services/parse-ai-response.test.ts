import { describe, expect, it } from 'vitest';

import { tryParseJsonObject } from './ai.service';

describe('tryParseJsonObject', () => {
  it('parses clean JSON', () => {
    expect(tryParseJsonObject('{"body":"oi"}')).toEqual({ body: 'oi' });
  });

  it('recovers JSON wrapped in prose (model ignored the format instruction)', () => {
    const raw = 'Claro! Aqui está a mensagem:\n{"subject":"Assunto","body":"Olá"}\nEspero que ajude.';
    expect(tryParseJsonObject(raw)).toEqual({ subject: 'Assunto', body: 'Olá' });
  });

  it('returns null when there is no JSON object at all', () => {
    expect(tryParseJsonObject('desculpe, não consegui gerar')).toBeNull();
  });

  it('returns null for malformed braces', () => {
    expect(tryParseJsonObject('{ body: sem aspas }')).toBeNull();
  });
});
