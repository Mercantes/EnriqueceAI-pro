import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LeadRow } from '../types';
import { LeadTable } from './LeadTable';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock('../actions/bulk-actions', () => ({
  bulkArchiveLeads: vi.fn(),
  bulkEnrichLeads: vi.fn(),
  exportLeadsCsv: vi.fn(),
}));

function createMockLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 'lead-1',
    org_id: 'org-1',
    cnpj: '11222333000181',
    status: 'new',
    enrichment_status: 'pending',
    razao_social: 'Empresa Teste LTDA',
    nome_fantasia: 'Empresa Teste',
    endereco: { cidade: 'São Paulo', uf: 'SP' },
    porte: 'ME',
    cnae: '6201-5/01',
    situacao_cadastral: 'Ativa',
    email: null,
    telefone: null,
    socios: null,
    faturamento_estimado: null,
    enriched_at: null,
    created_by: null,
    import_id: null,
    deleted_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('LeadTable', () => {
  it('should render leads in the table', () => {
    const leads = [
      createMockLead({ id: 'lead-1', nome_fantasia: 'Alpha Corp' }),
      createMockLead({ id: 'lead-2', nome_fantasia: 'Beta Inc', cnpj: '22333444000100' }),
    ];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('should display formatted CNPJ', () => {
    const leads = [createMockLead({ cnpj: '11222333000181' })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
  });

  it('should display cidade/UF from endereco', () => {
    const leads = [createMockLead({ endereco: { cidade: 'Curitiba', uf: 'PR' } })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Curitiba/PR')).toBeInTheDocument();
  });

  it('should display dash when no endereco', () => {
    const leads = [createMockLead({ endereco: null })];

    render(<LeadTable leads={leads} />);

    // Multiple dashes in the row (porte, cnae, cidade, etc if null)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should display status badges', () => {
    const leads = [createMockLead({ status: 'new', enrichment_status: 'enriched' })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Enriquecido')).toBeInTheDocument();
  });

  it('should render checkboxes for selection', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} />);

    // Header checkbox + row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('should show razao_social as subtitle when nome_fantasia exists', () => {
    const leads = [
      createMockLead({
        nome_fantasia: 'Nome Fantasia',
        razao_social: 'Razão Social LTDA',
      }),
    ];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Nome Fantasia')).toBeInTheDocument();
    expect(screen.getByText('Razão Social LTDA')).toBeInTheDocument();
  });

  it('should show dash when both names are null', () => {
    const leads = [createMockLead({ nome_fantasia: null, razao_social: null })];

    render(<LeadTable leads={leads} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should format date in pt-BR', () => {
    const leads = [createMockLead({ created_at: '2026-02-15T10:00:00Z' })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('15/02/2026')).toBeInTheDocument();
  });
});
