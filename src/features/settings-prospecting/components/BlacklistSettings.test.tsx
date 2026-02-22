import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/email-blacklist-crud', () => ({
  addBlacklistDomain: vi.fn().mockResolvedValue({ success: true, data: { id: 'b-new', org_id: 'org-1', domain: 'test.com', created_at: '2026-01-01' } }),
  deleteBlacklistDomain: vi.fn().mockResolvedValue({ success: true, data: { deleted: true } }),
}));

import type { EmailBlacklistRow } from '../actions/email-blacklist-crud';

import { BlacklistSettings } from './BlacklistSettings';

const makeDomain = (overrides: Partial<EmailBlacklistRow> = {}): EmailBlacklistRow => ({
  id: 'b-1',
  org_id: 'org-1',
  domain: 'spam.com',
  created_at: '2026-01-01',
  ...overrides,
});

describe('BlacklistSettings', () => {
  it('should render title', () => {
    render(<BlacklistSettings initial={[]} />);
    expect(screen.getByText('Blacklist de E-mails')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    render(<BlacklistSettings initial={[]} />);
    expect(screen.getByText(/Nenhum domínio/)).toBeInTheDocument();
  });

  it('should render existing domains', () => {
    render(<BlacklistSettings initial={[makeDomain()]} />);
    expect(screen.getByText('spam.com')).toBeInTheDocument();
  });

  it('should show add input and button', () => {
    render(<BlacklistSettings initial={[]} />);
    expect(screen.getByPlaceholderText(/exemplo.com/)).toBeInTheDocument();
    expect(screen.getByText('Adicionar')).toBeInTheDocument();
  });

  it('should disable add button when empty', () => {
    render(<BlacklistSettings initial={[]} />);
    expect(screen.getByText('Adicionar').closest('button')).toBeDisabled();
  });

  it('should enable add button when typing', async () => {
    const user = userEvent.setup();
    render(<BlacklistSettings initial={[]} />);
    await user.type(screen.getByPlaceholderText(/exemplo.com/), 'bad.com');
    expect(screen.getByText('Adicionar').closest('button')).not.toBeDisabled();
  });
});
