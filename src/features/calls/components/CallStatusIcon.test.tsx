import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/shared/components/ui/tooltip';

import type { CallStatus } from '../types';
import { CallStatusIcon } from './CallStatusIcon';

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('CallStatusIcon', () => {
  const statuses: Array<{ status: CallStatus; label: string }> = [
    { status: 'significant', label: 'Significativa' },
    { status: 'not_significant', label: 'Não Significativa' },
    { status: 'no_contact', label: 'Sem Contato' },
    { status: 'busy', label: 'Ocupado' },
    { status: 'not_connected', label: 'Não Conectada' },
  ];

  statuses.forEach(({ status, label }) => {
    it(`should render icon for status "${status}"`, () => {
      const { container } = renderWithProvider(<CallStatusIcon status={status} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it(`should show label "${label}" when showLabel is true`, () => {
      renderWithProvider(<CallStatusIcon status={status} showLabel />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('should not show label text by default', () => {
    renderWithProvider(<CallStatusIcon status="significant" />);
    expect(screen.queryByText('Significativa')).not.toBeInTheDocument();
  });

  it('should have green color for significant status', () => {
    const { container } = renderWithProvider(<CallStatusIcon status="significant" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-green');
  });

  it('should have red color for not_connected status', () => {
    const { container } = renderWithProvider(<CallStatusIcon status="not_connected" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-red');
  });

  it('should have yellow color for no_contact status', () => {
    const { container } = renderWithProvider(<CallStatusIcon status="no_contact" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-yellow');
  });

  it('should have orange color for busy status', () => {
    const { container } = renderWithProvider(<CallStatusIcon status="busy" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-orange');
  });

  it('should have gray color for not_significant status', () => {
    const { container } = renderWithProvider(<CallStatusIcon status="not_significant" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-gray');
  });
});
