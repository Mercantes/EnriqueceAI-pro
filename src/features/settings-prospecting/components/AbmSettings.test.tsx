import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/org-settings-crud', () => ({
  saveAbmSettings: vi.fn().mockResolvedValue({ success: true, data: { saved: true } }),
}));

import { AbmSettings } from './AbmSettings';

describe('AbmSettings', () => {
  it('should render title', () => {
    render(<AbmSettings initialEnabled={false} initialGroupField="razao_social" />);
    expect(screen.getByText(/Vendas Baseadas em Contas/)).toBeInTheDocument();
  });

  it('should show checkbox unchecked when disabled', () => {
    render(<AbmSettings initialEnabled={false} initialGroupField="razao_social" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('should show group field when enabled', () => {
    render(<AbmSettings initialEnabled={true} initialGroupField="razao_social" />);
    expect(screen.getByText('Campo de agrupamento')).toBeInTheDocument();
  });

  it('should hide group field when disabled', () => {
    render(<AbmSettings initialEnabled={false} initialGroupField="razao_social" />);
    expect(screen.queryByText('Campo de agrupamento')).not.toBeInTheDocument();
  });

  it('should toggle ABM on', async () => {
    const user = userEvent.setup();
    render(<AbmSettings initialEnabled={false} initialGroupField="razao_social" />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Campo de agrupamento')).toBeInTheDocument();
  });

  it('should show save button', () => {
    render(<AbmSettings initialEnabled={false} initialGroupField="razao_social" />);
    expect(screen.getByText('Salvar Configuração')).toBeInTheDocument();
  });
});
