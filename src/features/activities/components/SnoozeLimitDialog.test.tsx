import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SnoozeLimitDialog } from './SnoozeLimitDialog';

describe('SnoozeLimitDialog', () => {
  it('oferece exatamente 3 saídas e cada uma chama seu handler', async () => {
    const user = userEvent.setup();
    const onExecuteNow = vi.fn();
    const onLeadLost = vi.fn();
    const onSwitchCadence = vi.fn();

    render(
      <SnoozeLimitDialog
        open
        onOpenChange={vi.fn()}
        leadName="ACME"
        onExecuteNow={onExecuteNow}
        onLeadLost={onLeadLost}
        onSwitchCadence={onSwitchCadence}
      />,
    );

    // Título e descrição repetem "adiado 2 vezes" — checa pelo heading.
    expect(screen.getByRole('heading', { name: /já foi adiado 2 vezes/i })).toBeInTheDocument();

    // Só as 3 saídas (o Dialog do shadcn adiciona um "Close" de acessibilidade).
    const actions = screen
      .getAllByRole('button')
      .filter((b) => !/close/i.test(b.textContent ?? '') && b.getAttribute('aria-label') !== 'Close');
    expect(actions.map((b) => b.textContent?.trim())).toEqual(['Executar agora', 'Trocar cadência', 'Lead perdido']);

    await user.click(screen.getByRole('button', { name: 'Executar agora' }));
    await user.click(screen.getByRole('button', { name: 'Trocar cadência' }));
    await user.click(screen.getByRole('button', { name: 'Lead perdido' }));

    expect(onExecuteNow).toHaveBeenCalledTimes(1);
    expect(onSwitchCadence).toHaveBeenCalledTimes(1);
    expect(onLeadLost).toHaveBeenCalledTimes(1);
  });
});
