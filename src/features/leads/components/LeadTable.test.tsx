import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LeadRow } from '../types';
import { LeadTable } from './LeadTable';

const mockPush = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
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
    notes: null,
    fit_score: null,
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

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should display Meetime-style status badge', () => {
    const leads = [createMockLead({ status: 'new' })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('ESPERANDO INÍCIO')).toBeInTheDocument();
  });

  it('should display ATIVO badge for contacted leads', () => {
    const leads = [createMockLead({ status: 'contacted' })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('ATIVO')).toBeInTheDocument();
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

  it('should render score circle for leads with fit_score', () => {
    const leads = [createMockLead({ fit_score: 8 })];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should render dash in score circle for leads without fit_score', () => {
    const leads = [createMockLead({ fit_score: null })];

    render(<LeadTable leads={leads} />);

    // Score circle shows — for null
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should render sortable Score column header', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('should render Responsável column header', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Responsável')).toBeInTheDocument();
  });

  it('should render action menu button', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} />);

    expect(screen.getByText('Ações')).toBeInTheDocument();
  });
});
