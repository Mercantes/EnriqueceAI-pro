import { describe, expect, it } from 'vitest';

import { formatCnpj, isValidCnpj, stripCnpj } from './cnpj';

describe('cnpj utils', () => {
  describe('stripCnpj', () => {
    it('should remove formatting characters', () => {
      expect(stripCnpj('11.222.333/0001-81')).toBe('11222333000181');
    });

    it('should handle already stripped input', () => {
      expect(stripCnpj('11222333000181')).toBe('11222333000181');
    });

    it('should handle empty string', () => {
      expect(stripCnpj('')).toBe('');
    });
  });

  describe('formatCnpj', () => {
    it('should format a 14-digit CNPJ', () => {
      expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    });

    it('should return original string if not 14 digits', () => {
      expect(formatCnpj('123')).toBe('123');
    });

    it('should handle already formatted input', () => {
      expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
    });
  });

  describe('isValidCnpj', () => {
    it('should validate a correct CNPJ', () => {
      expect(isValidCnpj('11222333000181')).toBe(true);
    });

    it('should validate a formatted CNPJ', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    });

    it('should reject an all-zeros CNPJ', () => {
      expect(isValidCnpj('00000000000000')).toBe(false);
    });

    it('should reject all-same-digit CNPJs', () => {
      expect(isValidCnpj('11111111111111')).toBe(false);
      expect(isValidCnpj('99999999999999')).toBe(false);
    });

    it('should reject CNPJ with wrong check digits', () => {
      expect(isValidCnpj('11222333000182')).toBe(false);
      expect(isValidCnpj('11222333000191')).toBe(false);
    });

    it('should reject too short CNPJ', () => {
      expect(isValidCnpj('1122233300018')).toBe(false);
    });

    it('should reject too long CNPJ', () => {
      expect(isValidCnpj('112223330001811')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidCnpj('')).toBe(false);
    });

    it('should validate other valid CNPJs', () => {
      // CNPJs with algorithmically correct check digits
      expect(isValidCnpj('45678901000175')).toBe(true);
      expect(isValidCnpj('98765432000198')).toBe(true);
    });
  });
});
