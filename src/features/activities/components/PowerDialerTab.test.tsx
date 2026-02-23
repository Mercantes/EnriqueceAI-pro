import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/shared/components/ui/tooltip';

import type { DialerQueueItem } from '../actions/fetch-dialer-queue';

import { PowerDialerTab } from './PowerDialerTab';

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const mockQueue: DialerQueueItem[] = [
  {
    enrollmentId: 'e1',
    leadId: 'l1',
    leadName: 'Maria Silva',
    companyName: 'Silva Ltda',
    phone: '(11) 99999-1234',
    cadenceName: 'Cadencia Teste',
    cadenceId: 'c1',
    stepId: 's1',
    stepOrder: 1,
    totalSteps: 3,
    nextStepDue: '2026-02-23T10:00:00Z',
  },
  {
    enrollmentId: 'e2',
    leadId: 'l2',
    leadName: 'Joao Santos',
    companyName: 'Santos SA',
    phone: '(21) 98765-4321',
    cadenceName: 'Cadencia Teste',
    cadenceId: 'c1',
    stepId: 's2',
    stepOrder: 1,
    totalSteps: 3,
    nextStepDue: '2026-02-23T11:00:00Z',
  },
  {
    enrollmentId: 'e3',
    leadId: 'l3',
    leadName: 'Ana Costa',
    companyName: 'Costa ME',
    phone: null,
    cadenceName: 'Cadencia Teste',
    cadenceId: 'c1',
    stepId: 's3',
    stepOrder: 2,
    totalSteps: 3,
    nextStepDue: '2026-02-23T12:00:00Z',
  },
];

describe('PowerDialerTab', () => {
  it('renders empty state when no leads in queue', () => {
    renderWithProvider(<PowerDialerTab initialQueue={[]} />);
    expect(screen.getByText('Nenhuma ligacao pendente')).toBeInTheDocument();
  });

  it('renders queue header with lead count', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    expect(screen.getByText('Fila de Discagem')).toBeInTheDocument();
    expect(screen.getByText('3 leads')).toBeInTheDocument();
  });

  it('renders lead names in queue list', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Joao Santos')).toBeInTheDocument();
    expect(screen.getByText('Ana Costa')).toBeInTheDocument();
  });

  it('renders progress bar showing 0 of total', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    expect(screen.getByText(/0 de 3 ligacoes concluidas/)).toBeInTheDocument();
  });

  it('renders play button (start)', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    const playBtn = screen.getByRole('button', { name: /iniciar/i });
    expect(playBtn).toBeEnabled();
  });

  it('renders skip button as disabled when not active', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    const skipBtn = screen.getByRole('button', { name: /pular/i });
    expect(skipBtn).toBeDisabled();
  });

  it('shows placeholder panel when not started', () => {
    renderWithProvider(<PowerDialerTab initialQueue={mockQueue} />);
    expect(screen.getByText('Clique em Iniciar para comecar')).toBeInTheDocument();
  });
});
