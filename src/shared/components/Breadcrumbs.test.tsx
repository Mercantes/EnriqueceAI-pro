import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from 'next/navigation';

import { Breadcrumbs } from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('should not render for root-level paths', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    const { container } = render(<Breadcrumbs />);
    expect(container.innerHTML).toBe('');
  });

  it('should render breadcrumbs for nested paths', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/users');
    render(<Breadcrumbs />);
    expect(screen.getByText('Configurações')).toBeDefined();
    expect(screen.getByText('Usuários')).toBeDefined();
  });

  it('should match snapshot for settings/users', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/users');
    const { container } = render(<Breadcrumbs />);
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot for settings/billing', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/billing');
    const { container } = render(<Breadcrumbs />);
    expect(container).toMatchSnapshot();
  });
});
