import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CadenceRow } from '../types';
import { CadenceListView } from './CadenceListView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('../actions/manage-cadences', () => ({
  deleteCadence: vi.fn(),
  updateCadence: vi.fn(),
}));

function createCadence(overrides: Partial<CadenceRow> = {}): CadenceRow {
  return {
    id: 'cad-1',
    org_id: 'org-1',
    name: 'Follow Up Inicial',
    description: 'Cadência de primeiro contato',
    status: 'draft',
    total_steps: 3,
    created_by: 'user-1',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('CadenceListView', () => {
  it('should render header with title', () => {
    render(
      <CadenceListView
        cadences={[createCadence()]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Cadências')).toBeInTheDocument();
    expect(screen.getByText('1 cadência')).toBeInTheDocument();
  });

  it('should show plural count for multiple cadences', () => {
    render(
      <CadenceListView
        cadences={[createCadence(), createCadence({ id: 'cad-2', name: 'Reengajamento' })]}
        total={2}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('2 cadências')).toBeInTheDocument();
  });

  it('should render cadence card with name', () => {
    render(
      <CadenceListView
        cadences={[createCadence()]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Follow Up Inicial')).toBeInTheDocument();
  });

  it('should show cadence description', () => {
    render(
      <CadenceListView
        cadences={[createCadence()]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Cadência de primeiro contato')).toBeInTheDocument();
  });

  it('should show step count', () => {
    render(
      <CadenceListView
        cadences={[createCadence()]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('3 passos')).toBeInTheDocument();
  });

  it('should show singular step count', () => {
    render(
      <CadenceListView
        cadences={[createCadence({ total_steps: 1 })]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('1 passo')).toBeInTheDocument();
  });

  it('should show status badge for draft', () => {
    render(
      <CadenceListView
        cadences={[createCadence({ status: 'draft' })]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('should show status badge for active', () => {
    render(
      <CadenceListView
        cadences={[createCadence({ status: 'active' })]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('should show empty state when no cadences', () => {
    render(
      <CadenceListView
        cadences={[]}
        total={0}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Nenhuma cadência encontrada')).toBeInTheDocument();
  });

  it('should show "Nova Cadência" button', () => {
    render(
      <CadenceListView
        cadences={[createCadence()]}
        total={1}
        page={1}
        perPage={20}
      />,
    );
    expect(screen.getByText('Nova Cadência')).toBeInTheDocument();
  });
});
