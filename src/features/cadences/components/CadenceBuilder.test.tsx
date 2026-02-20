import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CadenceDetail } from '../cadences.contract';
import type { MessageTemplateRow } from '../types';
import { CadenceBuilder } from './CadenceBuilder';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../actions/manage-cadences', () => ({
  createCadence: vi.fn(),
  updateCadence: vi.fn(),
  activateCadence: vi.fn(),
  addCadenceStep: vi.fn(),
  removeCadenceStep: vi.fn(),
}));

function createTemplate(overrides: Partial<MessageTemplateRow> = {}): MessageTemplateRow {
  return {
    id: 'tmpl-1',
    org_id: 'org-1',
    name: 'Primeiro Contato',
    channel: 'email',
    subject: 'Olá {{nome_fantasia}}',
    body: 'Corpo do email',
    variables_used: ['nome_fantasia'],
    is_system: false,
    created_by: 'user-1',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
    ...overrides,
  };
}

function createCadence(overrides: Partial<CadenceDetail> = {}): CadenceDetail {
  return {
    id: 'cad-1',
    org_id: 'org-1',
    name: 'Follow Up Inicial',
    description: 'Cadência de primeiro contato',
    status: 'draft',
    total_steps: 0,
    created_by: 'user-1',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
    deleted_at: null,
    steps: [],
    enrollment_count: 0,
    ...overrides,
  };
}

describe('CadenceBuilder', () => {
  it('should render "Nova Cadência" for new cadence', () => {
    render(<CadenceBuilder templates={[createTemplate()]} />);
    expect(screen.getByText('Nova Cadência')).toBeInTheDocument();
  });

  it('should render cadence name for existing cadence', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText('Follow Up Inicial')).toBeInTheDocument();
  });

  it('should show status badge for existing cadence', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('should show name input with cadence name', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    const input = screen.getByLabelText('Nome');
    expect(input).toHaveValue('Follow Up Inicial');
  });

  it('should show description textarea', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    const textarea = screen.getByLabelText('Descrição');
    expect(textarea).toHaveValue('Cadência de primeiro contato');
  });

  it('should show empty steps message', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText(/Nenhum passo adicionado/)).toBeInTheDocument();
  });

  it('should show step count', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText('Passos (0)')).toBeInTheDocument();
  });

  it('should show "Adicionar Passo" button for editable cadence', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText('Adicionar Passo')).toBeInTheDocument();
  });

  it('should show "Criar Cadência" button for new cadence', () => {
    render(<CadenceBuilder templates={[createTemplate()]} />);
    expect(screen.getByText('Criar Cadência')).toBeInTheDocument();
  });

  it('should show "Salvar" button for existing cadence', () => {
    render(<CadenceBuilder cadence={createCadence()} templates={[createTemplate()]} />);
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('should show steps when cadence has steps', () => {
    const cadence = createCadence({
      total_steps: 2,
      steps: [
        {
          id: 'step-1',
          cadence_id: 'cad-1',
          step_order: 1,
          channel: 'email',
          template_id: 'tmpl-1',
          delay_days: 0,
          delay_hours: 0,
          ai_personalization: false,
          created_at: '2026-02-15T10:00:00Z',
          template: { id: 'tmpl-1', name: 'Primeiro Contato', org_id: 'org-1', channel: 'email', subject: 'Olá', body: 'Corpo', variables_used: [], is_system: false, created_by: 'user-1', created_at: '2026-02-15T10:00:00Z', updated_at: '2026-02-15T10:00:00Z' },
        },
        {
          id: 'step-2',
          cadence_id: 'cad-1',
          step_order: 2,
          channel: 'whatsapp',
          template_id: null,
          delay_days: 2,
          delay_hours: 0,
          ai_personalization: false,
          created_at: '2026-02-15T10:00:00Z',
          template: null,
        },
      ],
    });
    render(<CadenceBuilder cadence={cadence} templates={[createTemplate()]} />);
    expect(screen.getByText('Passos (2)')).toBeInTheDocument();
    expect(screen.getByText('— Primeiro Contato')).toBeInTheDocument();
    expect(screen.getByText('Enviar imediatamente')).toBeInTheDocument();
    expect(screen.getByText(/Esperar 2d/)).toBeInTheDocument();
  });

  it('should show activate button for draft with >= 2 steps', () => {
    const cadence = createCadence({
      total_steps: 2,
      steps: [
        {
          id: 'step-1',
          cadence_id: 'cad-1',
          step_order: 1,
          channel: 'email',
          template_id: null,
          delay_days: 0,
          delay_hours: 0,
          ai_personalization: false,
          created_at: '2026-02-15T10:00:00Z',
          template: null,
        },
        {
          id: 'step-2',
          cadence_id: 'cad-1',
          step_order: 2,
          channel: 'email',
          template_id: null,
          delay_days: 1,
          delay_hours: 0,
          ai_personalization: false,
          created_at: '2026-02-15T10:00:00Z',
          template: null,
        },
      ],
    });
    render(<CadenceBuilder cadence={cadence} templates={[createTemplate()]} />);
    expect(screen.getByText('Ativar')).toBeInTheDocument();
  });
});
