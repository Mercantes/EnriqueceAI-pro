import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LeadContactsSection } from './LeadContactsSection';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../actions/lead-contacts', () => ({
  listLeadContacts: vi.fn(),
  upsertLeadContact: vi.fn(),
  deleteLeadContact: vi.fn(),
  setPrimaryLeadContact: vi.fn(),
}));

import { listLeadContacts } from '../actions/lead-contacts';

const VALID_UUID = '11111111-2222-4333-8444-555555555555';

describe('LeadContactsSection — carga inicial', () => {
  beforeEach(() => {
    vi.mocked(listLeadContacts).mockReset();
    vi.mocked(listLeadContacts).mockResolvedValue({ success: true, data: [] });
  });

  it('busca os contatos quando o leadId é um UUID válido', async () => {
    render(<LeadContactsSection leadId={VALID_UUID} />);
    await waitFor(() => expect(listLeadContacts).toHaveBeenCalledWith(VALID_UUID));
  });

  it('não chama a action quando o leadId não é UUID (ex.: lead fictício da /demo)', async () => {
    render(<LeadContactsSection leadId="demo-lead-1" />);
    // Espera a montagem assentar; a action não pode ter sido chamada.
    await waitFor(() => expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument());
    expect(listLeadContacts).not.toHaveBeenCalled();
  });
});
