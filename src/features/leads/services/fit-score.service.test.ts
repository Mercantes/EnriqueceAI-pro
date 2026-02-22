import { describe, expect, it } from 'vitest';

import { calculateFitScore, type FitScoreRule, type LeadData } from './fit-score.service';

const lead: LeadData = {
  email: 'joao@gmail.com',
  telefone: '11999887766',
  razao_social: 'Acme Ltda',
  nome_fantasia: 'Acme',
  porte: 'ME',
  cnae: '6201-5/01',
  situacao_cadastral: 'Ativa',
  faturamento_estimado: 500000,
  uf: 'SP',
  notes: 'Lead interessante',
};

describe('calculateFitScore', () => {
  it('should return null when no rules', () => {
    expect(calculateFitScore(lead, [])).toBeNull();
  });

  it('should return 0 when no rules match', () => {
    const rules: FitScoreRule[] = [
      { points: 5, field: 'email', operator: 'contains', value: '@enterprise.com' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(0);
  });

  // Operator: contains
  it('should match contains operator (case-insensitive)', () => {
    const rules: FitScoreRule[] = [
      { points: -1, field: 'email', operator: 'contains', value: 'gmail' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(-1);
  });

  it('should match contains case-insensitive with uppercase value', () => {
    const rules: FitScoreRule[] = [
      { points: 3, field: 'email', operator: 'contains', value: 'GMAIL' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(3);
  });

  // Operator: equals
  it('should match equals operator (case-insensitive)', () => {
    const rules: FitScoreRule[] = [
      { points: 5, field: 'porte', operator: 'equals', value: 'me' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(5);
  });

  it('should not match equals when different', () => {
    const rules: FitScoreRule[] = [
      { points: 5, field: 'porte', operator: 'equals', value: 'EPP' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(0);
  });

  // Operator: not_empty
  it('should match not_empty when field has value', () => {
    const rules: FitScoreRule[] = [
      { points: 3, field: 'telefone', operator: 'not_empty', value: null },
    ];
    expect(calculateFitScore(lead, rules)).toBe(3);
  });

  it('should not match not_empty when field is null', () => {
    const nullLead: LeadData = { ...lead, telefone: null };
    const rules: FitScoreRule[] = [
      { points: 3, field: 'telefone', operator: 'not_empty', value: null },
    ];
    expect(calculateFitScore(nullLead, rules)).toBe(0);
  });

  it('should not match not_empty when field is empty string', () => {
    const emptyLead: LeadData = { ...lead, telefone: '  ' };
    const rules: FitScoreRule[] = [
      { points: 3, field: 'telefone', operator: 'not_empty', value: null },
    ];
    expect(calculateFitScore(emptyLead, rules)).toBe(0);
  });

  // Operator: starts_with
  it('should match starts_with operator (case-insensitive)', () => {
    const rules: FitScoreRule[] = [
      { points: 2, field: 'razao_social', operator: 'starts_with', value: 'acme' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(2);
  });

  it('should not match starts_with when no prefix match', () => {
    const rules: FitScoreRule[] = [
      { points: 2, field: 'razao_social', operator: 'starts_with', value: 'Beta' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(0);
  });

  // Multiple rules
  it('should sum points from multiple matching rules', () => {
    const rules: FitScoreRule[] = [
      { points: 3, field: 'telefone', operator: 'not_empty', value: null },
      { points: 5, field: 'uf', operator: 'equals', value: 'SP' },
      { points: -1, field: 'email', operator: 'contains', value: 'gmail' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(7); // 3 + 5 - 1
  });

  it('should handle negative scores', () => {
    const rules: FitScoreRule[] = [
      { points: -5, field: 'email', operator: 'contains', value: 'gmail' },
      { points: -3, field: 'porte', operator: 'equals', value: 'ME' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(-8);
  });

  // Edge: field not present on lead
  it('should not match when field is undefined on lead', () => {
    const minLead: LeadData = { email: 'a@b.com' };
    const rules: FitScoreRule[] = [
      { points: 5, field: 'porte', operator: 'equals', value: 'ME' },
    ];
    expect(calculateFitScore(minLead, rules)).toBe(0);
  });

  // Edge: numeric field as string
  it('should handle numeric field via string conversion', () => {
    const rules: FitScoreRule[] = [
      { points: 10, field: 'faturamento_estimado', operator: 'not_empty', value: null },
    ];
    expect(calculateFitScore(lead, rules)).toBe(10);
  });

  // Edge: invalid operator
  it('should not match with unknown operator', () => {
    const rules: FitScoreRule[] = [
      { points: 5, field: 'email', operator: 'regex' as 'contains', value: '.*' },
    ];
    expect(calculateFitScore(lead, rules)).toBe(0);
  });
});
