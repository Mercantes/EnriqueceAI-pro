import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SkipStepReasonDialog } from './SkipStepReasonDialog';

describe('SkipStepReasonDialog', () => {
  it('não confirma sem motivo; confirma com motivo e reseta para a próxima abertura (QA REL-003)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <SkipStepReasonDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} leadName="ACME" />,
    );

    const confirm = screen.getByRole('button', { name: 'Pular passo' });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByLabelText('Já contatei por outro canal'));
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('contacted_other_channel', undefined);

    // Pai fecha por prop (sem onOpenChange) e reabre para outro lead: o motivo
    // anterior NÃO pode vir marcado.
    rerender(<SkipStepReasonDialog open={false} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    rerender(<SkipStepReasonDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} leadName="Outra" />);

    expect(screen.getByRole('button', { name: 'Pular passo' })).toBeDisabled();
    expect(screen.getByLabelText('Já contatei por outro canal')).not.toBeChecked();
  });

  it('"Outro" abre a observação e envia o texto aparado', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<SkipStepReasonDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByLabelText('Outro'));
    await user.type(screen.getByLabelText(/Descreva em poucas palavras/), '  pediu só e-mail  ');
    await user.click(screen.getByRole('button', { name: 'Pular passo' }));

    expect(onConfirm).toHaveBeenCalledWith('other', 'pediu só e-mail');
  });
});
