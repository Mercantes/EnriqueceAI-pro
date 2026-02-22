import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/shared/components/ui/tooltip';

import { PowerDialerTab } from './PowerDialerTab';

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('PowerDialerTab', () => {
  it('renders "Em breve" banner', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText(/Em breve — Integração com provedor VoIP/)).toBeInTheDocument();
  });

  it('renders VoIP description text', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText(/Power Dialer permitirá discagem automática/)).toBeInTheDocument();
  });

  it('renders queue header with lead count', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText('Fila de Discagem')).toBeInTheDocument();
    expect(screen.getByText('5 leads')).toBeInTheDocument();
  });

  it('renders mock leads with names and phones', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-1234')).toBeInTheDocument();
    expect(screen.getByText('João Santos')).toBeInTheDocument();
    expect(screen.getByText('Ana Costa')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('Em chamada')).toBeInTheDocument();
    expect(screen.getAllByText('Aguardando')).toHaveLength(3);
  });

  it('renders disabled control buttons', () => {
    renderWithProvider(<PowerDialerTab />);
    const playBtn = screen.getByRole('button', { name: /play/i });
    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    const skipBtn = screen.getByRole('button', { name: /skip/i });

    expect(playBtn).toBeDisabled();
    expect(pauseBtn).toBeDisabled();
    expect(skipBtn).toBeDisabled();
  });

  it('renders lead avatars with initials', () => {
    renderWithProvider(<PowerDialerTab />);
    expect(screen.getByText('MS')).toBeInTheDocument(); // Maria Silva
    expect(screen.getByText('JS')).toBeInTheDocument(); // João Santos
    expect(screen.getByText('AC')).toBeInTheDocument(); // Ana Costa
  });
});
