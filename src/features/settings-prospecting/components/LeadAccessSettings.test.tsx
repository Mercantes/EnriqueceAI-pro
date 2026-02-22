import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/org-settings-crud', () => ({
  saveLeadVisibility: vi.fn().mockResolvedValue({ success: true, data: { saved: true } }),
}));

import { LeadAccessSettings } from './LeadAccessSettings';

describe('LeadAccessSettings', () => {
  it('should render title', () => {
    render(<LeadAccessSettings initialMode="all" />);
    expect(screen.getByText('Acesso aos Leads')).toBeInTheDocument();
  });

  it('should show three radio options', () => {
    render(<LeadAccessSettings initialMode="all" />);
    expect(screen.getByText('Todos veem todos')).toBeInTheDocument();
    expect(screen.getByText('Apenas seus leads')).toBeInTheDocument();
    expect(screen.getByText('Por equipe')).toBeInTheDocument();
  });

  it('should have initial mode selected', () => {
    render(<LeadAccessSettings initialMode="own" />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const ownRadio = radios.find((r) => r.value === 'own');
    expect(ownRadio?.checked).toBe(true);
  });

  it('should allow changing mode', async () => {
    const user = userEvent.setup();
    render(<LeadAccessSettings initialMode="all" />);
    const teamRadio = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).value === 'team');
    if (teamRadio) await user.click(teamRadio);
    expect((teamRadio as HTMLInputElement)?.checked).toBe(true);
  });

  it('should show save button', () => {
    render(<LeadAccessSettings initialMode="all" />);
    expect(screen.getByText('Salvar Configuração')).toBeInTheDocument();
  });
});
