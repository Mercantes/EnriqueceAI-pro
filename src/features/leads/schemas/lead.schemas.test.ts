import { describe, expect, it } from 'vitest';

import { cnpjSchema, createLeadSchema, leadFiltersSchema } from './lead.schemas';

describe('lead schemas', () => {
  describe('cnpjSchema', () => {
    it('should accept a valid CNPJ', () => {
      const result = cnpjSchema.safeParse('11222333000181');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('11222333000181');
    });

    it('should accept and strip formatted CNPJ', () => {
      const result = cnpjSchema.safeParse('11.222.333/0001-81');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('11222333000181');
    });

    it('should reject empty string', () => {
      const result = cnpjSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject invalid CNPJ', () => {
      const result = cnpjSchema.safeParse('11222333000199');
      expect(result.success).toBe(false);
    });
  });

  describe('createLeadSchema', () => {
    it('should accept valid input with only CNPJ', () => {
      const result = createLeadSchema.safeParse({ cnpj: '11222333000181' });
      expect(result.success).toBe(true);
    });

    it('should accept valid input with all fields', () => {
      const result = createLeadSchema.safeParse({
        cnpj: '11.222.333/0001-81',
        razao_social: 'Test Company Ltda',
        nome_fantasia: 'TestCo',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.cnpj).toBe('11222333000181');
    });

    it('should reject without CNPJ', () => {
      const result = createLeadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('leadFiltersSchema', () => {
    it('should accept empty filters with defaults', () => {
      const result = leadFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.per_page).toBe(20);
      }
    });

    it('should accept valid status filter', () => {
      const result = leadFiltersSchema.safeParse({ status: 'new' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = leadFiltersSchema.safeParse({ status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should coerce page number from string', () => {
      const result = leadFiltersSchema.safeParse({ page: '3' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(3);
    });

    it('should reject per_page above 100', () => {
      const result = leadFiltersSchema.safeParse({ per_page: 200 });
      expect(result.success).toBe(false);
    });
  });
});
