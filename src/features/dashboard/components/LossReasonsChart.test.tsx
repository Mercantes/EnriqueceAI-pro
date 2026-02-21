import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LossReasonEntry } from '../types';
import { LossReasonsChart } from './LossReasonsChart';

// Mock recharts — jsdom can't render SVG charts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

describe('LossReasonsChart', () => {
  it('should render empty state when no data', () => {
    render(<LossReasonsChart data={[]} />);
    expect(screen.getByText('Sem dados de motivos de perda')).toBeInTheDocument();
  });

  it('should render chart title', () => {
    const data: LossReasonEntry[] = [
      { reason: 'Sem orçamento', count: 5, percent: 50 },
      { reason: 'Timing ruim', count: 5, percent: 50 },
    ];
    render(<LossReasonsChart data={data} />);
    expect(screen.getByText('Motivos de Perda')).toBeInTheDocument();
  });

  it('should render bar chart component', () => {
    const data: LossReasonEntry[] = [
      { reason: 'Sem orçamento', count: 10, percent: 100 },
    ];
    render(<LossReasonsChart data={data} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should render responsive container', () => {
    const data: LossReasonEntry[] = [
      { reason: 'Sem orçamento', count: 10, percent: 100 },
    ];
    render(<LossReasonsChart data={data} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('should have card styling wrapper', () => {
    const data: LossReasonEntry[] = [
      { reason: 'Sem orçamento', count: 10, percent: 100 },
    ];
    const { container } = render(<LossReasonsChart data={data} />);
    const card = container.querySelector('.rounded-lg.border.bg-card');
    expect(card).toBeInTheDocument();
  });
});
