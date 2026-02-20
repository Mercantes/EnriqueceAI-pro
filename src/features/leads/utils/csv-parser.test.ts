import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv-parser';

describe('csv-parser', () => {
  describe('parseCsv', () => {
    it('should parse a simple CSV with CNPJ header', () => {
      const csv = 'cnpj\n11222333000181\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
      expect(result.rows[1]?.cnpj).toBe('45678901000175');
    });

    it('should detect CNPJ column with different header names', () => {
      const csv = 'nome,documento\nTest,11222333000181';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should extract razao_social and nome_fantasia', () => {
      const csv = 'cnpj,razao_social,nome_fantasia\n11222333000181,Empresa Ltda,EmpLtda';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa Ltda');
      expect(result.rows[0]?.nome_fantasia).toBe('EmpLtda');
    });

    it('should handle formatted CNPJs', () => {
      const csv = 'cnpj\n11.222.333/0001-81';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should report invalid CNPJs as errors', () => {
      const csv = 'cnpj\n11222333000181\n00000000000000\n11222333000199';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.errorMessage).toBe('CNPJ inválido');
      expect(result.errors[0]?.rowNumber).toBe(3);
    });

    it('should report empty CNPJs as errors', () => {
      const csv = 'cnpj,nome\n11222333000181,ok\n,vazio';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toBe('CNPJ vazio');
    });

    it('should return error for empty file', () => {
      const result = parseCsv('');
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toContain('vazio');
    });

    it('should return error for header-only file', () => {
      const result = parseCsv('cnpj');
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should return error when CNPJ column not found', () => {
      const csv = 'nome,email\nTest,test@test.com';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toContain('CNPJ não encontrada');
    });

    it('should reject files with more than 1000 rows', () => {
      const rows = ['cnpj'];
      for (let i = 0; i < 1001; i++) {
        rows.push('11222333000181');
      }
      const result = parseCsv(rows.join('\n'));

      expect(result.rows).toHaveLength(0);
      expect(result.errors[0]?.errorMessage).toContain('1000');
    });

    it('should handle semicolon-separated CSV', () => {
      const csv = 'cnpj;razao_social\n11222333000181;Empresa Ltda';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa Ltda');
    });

    it('should handle quoted fields', () => {
      const csv = 'cnpj,razao_social\n11222333000181,"Empresa, Ltda"';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa, Ltda');
    });

    it('should auto-detect CNPJ column by content', () => {
      const csv = 'id,number,name\n1,11222333000181,Test';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should set correct row numbers', () => {
      const csv = 'cnpj\n11222333000181\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows[0]?.rowNumber).toBe(2);
      expect(result.rows[1]?.rowNumber).toBe(3);
    });

    it('should handle Windows line endings', () => {
      const csv = 'cnpj\r\n11222333000181\r\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
    });
  });
});
