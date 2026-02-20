import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LeadRow } from '../types';
import { LeadProfile } from './LeadProfile';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock server actions
vi.mock('../actions/enrich-lead', () => ({
  enrichLeadAction: vi.fn(),
}));
vi.mock('../actions/update-lead', () => ({
  archiveLead: vi.fn(),
  updateLead: vi.fn(),
}));
vi.mock('@/features/ai/actions/generate-message', () => ({
  generateMessageAction: vi.fn(),
  getAIUsageAction: vi.fn(),
}));

function createMockLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 'lead-1',
    org_id: 'org-1',
    cnpj: '11222333000181',
    status: 'new',
    enrichment_status: 'enriched',
    razao_social: 'Empresa Teste LTDA',
    nome_fantasia: 'Empresa Teste',
    endereco: {
      logradouro: 'Rua Principal',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01000-000',
    },
    porte: 'ME',
    cnae: '6201-5/01',
    situacao_cadastral: 'Ativa',
    email: 'contato@empresa.com',
    telefone: '(11) 99999-0000',
    socios: [
      { nome: 'João da Silva', qualificacao: 'Sócio-Administrador' },
    ],
    faturamento_estimado: 500000,
    enriched_at: '2026-02-10T10:00:00Z',
    created_by: null,
    import_id: null,
    deleted_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    ...overrides,
  };
}

describe('LeadProfile', () => {
  it('should render company name as title', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Empresa Teste' })).toBeInTheDocument();
  });

  it('should render formatted CNPJ', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
  });

  it('should render company details', () => {
    render(<LeadProfile lead={createMockLead()} />);
    // razao_social appears in subtitle and in the info row
    expect(screen.getAllByText('Empresa Teste LTDA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ME').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('6201-5/01')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('should render contact email and phone', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText('contato@empresa.com')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-0000')).toBeInTheDocument();
  });

  it('should render socios', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText(/Sócio-Administrador/)).toBeInTheDocument();
  });

  it('should render formatted address', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText(/Rua Principal/)).toBeInTheDocument();
    expect(screen.getByText(/São Paulo\/SP/)).toBeInTheDocument();
  });

  it('should render faturamento estimado', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText(/R\$\s*500\.000/)).toBeInTheDocument();
  });

  it('should render status and enrichment badges', () => {
    render(<LeadProfile lead={createMockLead()} />);
    // Status appears in header badge + status card
    expect(screen.getAllByText('Novo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Enriquecido').length).toBeGreaterThanOrEqual(2);
  });

  it('should render action buttons', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText('Gerar com IA')).toBeInTheDocument();
    expect(screen.getByText('Re-enriquecer')).toBeInTheDocument();
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Arquivar')).toBeInTheDocument();
  });

  it('should show timeline section', () => {
    render(<LeadProfile lead={createMockLead()} />);
    expect(screen.getByText(/Timeline de Atividades/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma interação registrada ainda/)).toBeInTheDocument();
  });

  it('should show no contact message when no email/phone/socios', () => {
    render(
      <LeadProfile
        lead={createMockLead({ email: null, telefone: null, socios: null })}
      />,
    );
    expect(screen.getByText(/Nenhum contato disponível/)).toBeInTheDocument();
  });

  it('should disable archive button when already archived', () => {
    render(<LeadProfile lead={createMockLead({ status: 'archived' })} />);
    const archiveBtn = screen.getByText('Arquivar').closest('button');
    expect(archiveBtn).toBeDisabled();
  });
});
