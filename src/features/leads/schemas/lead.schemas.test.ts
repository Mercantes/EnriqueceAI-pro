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
    const validUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept valid input with only CNPJ and assigned_to', () => {
      const result = createLeadSchema.safeParse({
        cnpj: '11222333000181',
        assigned_to: validUserId,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid input with all fields', () => {
      const result = createLeadSchema.safeParse({
        cnpj: '11.222.333/0001-81',
        razao_social: 'Test Company Ltda',
        nome_fantasia: 'TestCo',
        email: 'contato@empresa.com',
        telefone: '11999999999',
        assigned_to: validUserId,
        cadence_id: '660e8400-e29b-41d4-a716-446655440000',
        enrollment_mode: 'paused',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cnpj).toBe('11222333000181');
        expect(result.data.enrollment_mode).toBe('paused');
      }
    });

    it('should reject without CNPJ', () => {
      const result = createLeadSchema.safeParse({ assigned_to: validUserId });
      expect(result.success).toBe(false);
    });

    it('should reject without assigned_to', () => {
      const result = createLeadSchema.safeParse({ cnpj: '11222333000181' });
      expect(result.success).toBe(false);
    });

    it('should default enrollment_mode to immediate', () => {
      const result = createLeadSchema.safeParse({
        cnpj: '11222333000181',
        assigned_to: validUserId,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.enrollment_mode).toBe('immediate');
    });

    it('should accept empty string for optional email and telefone', () => {
      const result = createLeadSchema.safeParse({
        cnpj: '11222333000181',
        assigned_to: validUserId,
        email: '',
        telefone: '',
        cadence_id: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('leadFiltersSchema', () => {
    it('should accept empty filters with defaults', () => {
      const result = leadFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.per_page).toBe(25);
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
