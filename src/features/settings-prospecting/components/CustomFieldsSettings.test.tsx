import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions/custom-fields-crud', () => ({
  addCustomField: vi.fn().mockResolvedValue({ success: true, data: { id: 'f-new', org_id: 'org-1', field_name: 'Test', field_type: 'text', options: null, sort_order: 1, created_at: '2026-01-01' } }),
  updateCustomField: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteCustomField: vi.fn().mockResolvedValue({ success: true, data: { deleted: true } }),
}));

import type { CustomFieldRow } from '../actions/custom-fields-crud';

import { CustomFieldsSettings } from './CustomFieldsSettings';

const makeField = (overrides: Partial<CustomFieldRow> = {}): CustomFieldRow => ({
  id: 'f-1',
  org_id: 'org-1',
  field_name: 'Segmento',
  field_type: 'text',
  options: null,
  sort_order: 1,
  created_at: '2026-01-01',
  ...overrides,
});

describe('CustomFieldsSettings', () => {
  it('should render title', () => {
    render(<CustomFieldsSettings initial={[]} />);
    expect(screen.getByText('Campos Personalizados')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    render(<CustomFieldsSettings initial={[]} />);
    expect(screen.getByText(/Nenhum campo personalizado/)).toBeInTheDocument();
  });

  it('should render existing fields', () => {
    render(<CustomFieldsSettings initial={[makeField()]} />);
    expect(screen.getByText('Segmento')).toBeInTheDocument();
  });

  it('should show field type badge', () => {
    render(<CustomFieldsSettings initial={[makeField({ field_type: 'select', options: ['A', 'B'] })]} />);
    expect(screen.getByText('Seleção')).toBeInTheDocument();
    expect(screen.getByText('(A, B)')).toBeInTheDocument();
  });

  it('should show add form', () => {
    render(<CustomFieldsSettings initial={[]} />);
    expect(screen.getByPlaceholderText(/Segmento/)).toBeInTheDocument();
    expect(screen.getByText('Adicionar')).toBeInTheDocument();
  });

  it('should enter edit mode', async () => {
    const user = userEvent.setup();
    render(<CustomFieldsSettings initial={[makeField()]} />);
    const editButtons = screen.getAllByRole('button');
    const pencilButton = editButtons.find((b) => b.querySelector('.lucide-pencil'));
    if (pencilButton) await user.click(pencilButton);
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });
});
