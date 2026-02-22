import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/save-fit-score-rules', () => ({
  saveFitScoreRules: vi.fn().mockResolvedValue({ success: true, data: { saved: 1 } }),
}));

import type { FitScoreRuleRow } from '../actions/get-fit-score-rules';

import { FitScoreConfig } from './FitScoreConfig';

const makeRule = (overrides: Partial<FitScoreRuleRow> = {}): FitScoreRuleRow => ({
  id: 'r-1',
  org_id: 'org-1',
  points: 5,
  field: 'email',
  operator: 'not_empty',
  value: null,
  sort_order: 1,
  created_at: '2026-01-01',
  ...overrides,
});

describe('FitScoreConfig', () => {
  it('should render explanation text', () => {
    render(<FitScoreConfig initial={[]} />);
    expect(screen.getByText(/Como funciona/)).toBeInTheDocument();
  });

  it('should show empty state when no rules', () => {
    render(<FitScoreConfig initial={[]} />);
    expect(screen.getByText(/Nenhuma regra configurada/)).toBeInTheDocument();
  });

  it('should render existing rules', () => {
    render(<FitScoreConfig initial={[makeRule()]} />);
    // Should show the table headers
    expect(screen.getByText('Pontos')).toBeInTheDocument();
    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.getByText('Critério')).toBeInTheDocument();
  });

  it('should add a rule when clicking "Adicionar regra"', async () => {
    const user = userEvent.setup();
    render(<FitScoreConfig initial={[]} />);

    await user.click(screen.getByText('Adicionar regra'));

    // Table should now be visible with a row
    expect(screen.getByText('Pontos')).toBeInTheDocument();
  });

  it('should show "Salvar Regras" button', () => {
    render(<FitScoreConfig initial={[]} />);
    expect(screen.getByText('Salvar Regras')).toBeInTheDocument();
  });

  it('should render dash for not_empty operator value', () => {
    render(<FitScoreConfig initial={[makeRule({ operator: 'not_empty' })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
