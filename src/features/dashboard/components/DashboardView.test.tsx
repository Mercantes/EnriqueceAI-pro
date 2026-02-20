import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardMetrics } from '../dashboard.contract';
import { DashboardView } from './DashboardView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

function createMetrics(overrides: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    totalLeads: 100,
    leadsByStatus: { new: 40, contacted: 30, qualified: 20, unqualified: 5, archived: 5 },
    recentImports: [
      {
        id: 'imp-1',
        file_name: 'leads.csv',
        total_rows: 50,
        success_count: 45,
        error_count: 5,
        status: 'completed',
        created_at: '2026-02-15T10:00:00Z',
      },
    ],
    enrichmentStats: {
      total: 100,
      enriched: 60,
      pending: 25,
      failed: 10,
      notFound: 5,
      successRate: 60,
    },
    leadsByPorte: { ME: 50, EPP: 30, MEI: 20 },
    leadsByUf: { SP: 40, RJ: 25, MG: 20, PR: 15 },
    ...overrides,
  };
}

describe('DashboardView', () => {
  it('should show empty state when no leads and no imports', () => {
    render(
      <DashboardView
        metrics={createMetrics({
          totalLeads: 0,
          leadsByStatus: {},
          recentImports: [],
          enrichmentStats: {
            total: 0, enriched: 0, pending: 0, failed: 0, notFound: 0, successRate: 0,
          },
          leadsByPorte: {},
          leadsByUf: {},
        })}
      />,
    );
    expect(screen.getByText('Comece importando seus leads')).toBeInTheDocument();
  });

  it('should render total leads metric card', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Total de Leads')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render qualified metric card', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Qualificados')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should render enrichment metric cards', () => {
    render(<DashboardView metrics={createMetrics()} />);
    // "Enriquecidos" appears in metric card and enrichment card
    expect(screen.getAllByText('Enriquecidos').length).toBeGreaterThanOrEqual(2);
  });

  it('should render recent imports', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Importações Recentes')).toBeInTheDocument();
    expect(screen.getByText('leads.csv')).toBeInTheDocument();
  });

  it('should render enrichment card with success rate', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Enriquecimento')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should render porte distribution', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Leads por Porte')).toBeInTheDocument();
    // ME, EPP, MEI are all present in the distribution
    expect(screen.getByText('EPP')).toBeInTheDocument();
  });

  it('should render UF distribution', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('Leads por Estado')).toBeInTheDocument();
    expect(screen.getByText(/SP/)).toBeInTheDocument();
  });

  it('should render period filter', () => {
    render(<DashboardView metrics={createMetrics()} />);
    expect(screen.getByText('7 dias')).toBeInTheDocument();
    expect(screen.getByText('30 dias')).toBeInTheDocument();
    expect(screen.getByText('90 dias')).toBeInTheDocument();
  });
});
