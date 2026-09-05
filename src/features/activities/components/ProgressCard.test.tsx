import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./StartProspectingDialog', () => ({ StartProspectingDialog: () => null }));

import { ProgressCard } from './ProgressCard';

describe('ProgressCard — linha de guardrails', () => {
  it('mostra Adiadas · Puladas · Trocadas · Perdidos com os motivos no tooltip', () => {
    render(
      <ProgressCard
        completed={5}
        total={10}
        target={20}
        guardrails={{
          snoozed: 5,
          skipped: 2,
          switched: 1,
          lost: 3,
          topReasons: [
            { label: 'Sem telefone / WhatsApp', count: 2 },
            { label: 'Sem fit', count: 1 },
          ],
        }}
      />,
    );

    const line = screen.getByTestId('guardrails-summary');
    expect(line).toHaveTextContent('Adiadas 5 · Puladas 2 · Trocadas 1 · Perdidos 3');
    expect(line.getAttribute('title')).toContain('Sem telefone / WhatsApp: 2');
    expect(line.getAttribute('title')).toContain('Sem fit: 1');
  });

  it('sem guardrails a linha não aparece', () => {
    render(<ProgressCard completed={0} total={0} target={20} />);
    expect(screen.queryByTestId('guardrails-summary')).toBeNull();
  });
});
