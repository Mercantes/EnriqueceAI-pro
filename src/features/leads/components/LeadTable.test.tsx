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
    assigned_to: null,
    deleted_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

const emptyCadenceInfo = {};

describe('LeadTable', () => {
  it('should render leads in the table', () => {
    const leads = [
      createMockLead({ id: 'lead-1', nome_fantasia: 'Alpha Corp' }),
      createMockLead({ id: 'lead-2', nome_fantasia: 'Beta Inc', cnpj: '22333444000100' }),
    ];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('should display Meetime-style status badge', () => {
    const leads = [createMockLead({ status: 'new' })];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('ESPERANDO INÍCIO')).toBeInTheDocument();
  });

  it('should display ATIVO badge for contacted leads', () => {
    const leads = [createMockLead({ status: 'contacted' })];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('ATIVO')).toBeInTheDocument();
  });

  it('should render checkboxes for selection', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

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

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('Nome Fantasia')).toBeInTheDocument();
    expect(screen.getByText('Razão Social LTDA')).toBeInTheDocument();
  });

  it('should show dash when both names are null', () => {
    const leads = [createMockLead({ nome_fantasia: null, razao_social: null })];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('should display cadence name from cadenceInfo', () => {
    const leads = [createMockLead({ id: 'lead-1' })];
    const cadenceInfo = {
      'lead-1': { cadence_name: 'Outbound Q1', responsible_email: 'john@test.com' },
    };

    render(<LeadTable leads={leads} cadenceInfo={cadenceInfo} />);

    expect(screen.getByText('Outbound Q1')).toBeInTheDocument();
  });

  it('should display responsible username from cadenceInfo', () => {
    const leads = [createMockLead({ id: 'lead-1' })];
    const cadenceInfo = {
      'lead-1': { cadence_name: 'Test', responsible_email: 'john@test.com' },
    };

    render(<LeadTable leads={leads} cadenceInfo={cadenceInfo} />);

    expect(screen.getByText('john')).toBeInTheDocument();
  });

  it('should render Responsável column header', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('Responsável')).toBeInTheDocument();
  });

  it('should render Cadência column header', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('Cadência')).toBeInTheDocument();
  });

  it('should render action menu button', () => {
    const leads = [createMockLead()];

    render(<LeadTable leads={leads} cadenceInfo={emptyCadenceInfo} />);

    expect(screen.getByText('Ações')).toBeInTheDocument();
  });
});
