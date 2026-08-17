import { describe, it, expect } from 'vitest';

import { neutralizeCsvFormula, escapeCsvField } from './csv';

describe('neutralizeCsvFormula', () => {
  it('prefixes cells that start with a formula trigger', () => {
    expect(neutralizeCsvFormula('=HYPERLINK("http://x")')).toBe("'=HYPERLINK(\"http://x\")");
    expect(neutralizeCsvFormula('+1+1')).toBe("'+1+1");
    expect(neutralizeCsvFormula('-2+3')).toBe("'-2+3");
    expect(neutralizeCsvFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCsvFormula('\tcmd')).toBe("'\tcmd");
  });

  it('leaves ordinary values untouched', () => {
    expect(neutralizeCsvFormula('Empresa LTDA')).toBe('Empresa LTDA');
    expect(neutralizeCsvFormula('11222333000181')).toBe('11222333000181');
    expect(neutralizeCsvFormula('')).toBe('');
  });
});

describe('escapeCsvField', () => {
  it('neutralizes a formula and quotes when needed', () => {
    expect(escapeCsvField('=1,2')).toBe('"\'=1,2"');
  });

  it('quotes values with commas/quotes/newlines (RFC 4180)', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('leaves plain values unquoted', () => {
    expect(escapeCsvField('plain')).toBe('plain');
  });
});
