import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));

import { MobileNav } from './MobileNav';

describe('MobileNav', () => {
  it('renders hamburger button', () => {
    render(<MobileNav />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('opens drawer with logo on hamburger click', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await screen.findByText('Enriquece AI')).toBeInTheDocument();
  });

  it('shows nav items in drawer', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Prospecção')).toBeInTheDocument();
    expect(screen.getByText('Ligações')).toBeInTheDocument();
    expect(screen.getByText('Estatísticas')).toBeInTheDocument();
  });

  it('expands Prospecção section to show submenu items', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByText('Prospecção'));

    expect(await screen.findByText('Execução')).toBeInTheDocument();
    expect(screen.getByText('Cadências')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('shows placeholder text for Ligações section', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByText('Ligações'));

    expect(await screen.findByText('Em breve')).toBeInTheDocument();
  });

  it('renders mobile sub-actions (Ligar and Usuário)', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await screen.findByText('Ligar')).toBeInTheDocument();
    expect(screen.getByText('Usuário')).toBeInTheDocument();
  });
});
