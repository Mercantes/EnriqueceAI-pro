import { describe, expect, it } from 'vitest';

import { decodeCsvBuffer } from './decode-csv';

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe('decodeCsvBuffer', () => {
  it('decodifica UTF-8 normalmente', () => {
    const buffer = new TextEncoder().encode('razao_social\nConstrução Alfa').buffer;
    expect(decodeCsvBuffer(buffer)).toBe('razao_social\nConstrução Alfa');
  });

  it('cai para windows-1252 quando o arquivo veio do Excel BR', () => {
    // "Construção" em Windows-1252: ç = 0xE7, ã = 0xE3 — bytes inválidos em
    // UTF-8, que antes viravam "Constru��o" no banco.
    const buffer = bytes(0x43, 0x6f, 0x6e, 0x73, 0x74, 0x72, 0x75, 0xe7, 0xe3, 0x6f);
    expect(decodeCsvBuffer(buffer)).toBe('Construção');
  });

  it('consome o BOM UTF-8 em vez de deixá-lo no primeiro cabeçalho', () => {
    const buffer = bytes(0xef, 0xbb, 0xbf, 0x63, 0x6e, 0x70, 0x6a);
    expect(decodeCsvBuffer(buffer)).toBe('cnpj');
  });

  it('respeita o BOM UTF-16LE', () => {
    const buffer = bytes(0xff, 0xfe, 0x63, 0x00, 0x6e, 0x00, 0x70, 0x00, 0x6a, 0x00);
    expect(decodeCsvBuffer(buffer)).toBe('cnpj');
  });

  it('decodifica ASCII igual nos dois caminhos', () => {
    const buffer = new TextEncoder().encode('cnpj,razao_social\n11222333000181,Alfa').buffer;
    expect(decodeCsvBuffer(buffer)).toBe('cnpj,razao_social\n11222333000181,Alfa');
  });
});
