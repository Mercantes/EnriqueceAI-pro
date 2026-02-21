import { render, screen } from '@testing-library/react';
import { Activity, TrendingUp, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import type { RankingCardData } from '../types';
import { RankingCard } from './RankingCard';

function createCardData(overrides: Partial<RankingCardData> = {}): RankingCardData {
  return {
    total: 25,
    monthTarget: 50,
    percentOfTarget: -20,
    averagePerSdr: 12.5,
    sdrBreakdown: [
      { userId: 'aaaa1111-0000-0000-0000-000000000001', value: 15, secondaryValue: 3 },
      { userId: 'bbbb2222-0000-0000-0000-000000000002', value: 10 },
    ],
    ...overrides,
  };
}

describe('RankingCard', () => {
  it('should render title and total', () => {
    render(
      <RankingCard title="Leads Finalizados" icon={Users} data={createCardData()} />,
    );
    expect(screen.getByText('Leads Finalizados')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should render target info', () => {
    render(
      <RankingCard title="Atividades" icon={Activity} data={createCardData()} />,
    );
    expect(screen.getByText(/Meta:/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should render percent below indicator', () => {
    render(
      <RankingCard title="Test" icon={Users} data={createCardData()} />,
    );
    expect(screen.getByText(/20% abaixo do previsto/)).toBeInTheDocument();
  });

  it('should render percent above indicator', () => {
    render(
      <RankingCard
        title="Test"
        icon={Users}
        data={createCardData({ percentOfTarget: 15 })}
      />,
    );
    expect(screen.getByText(/15% acima do previsto/)).toBeInTheDocument();
  });

  it('should show "Sem meta" when no target', () => {
    render(
      <RankingCard
        title="Test"
        icon={Users}
        data={createCardData({ monthTarget: 0 })}
      />,
    );
    expect(screen.getByText('Sem meta definida')).toBeInTheDocument();
  });

  it('should render SDR breakdown', () => {
    render(
      <RankingCard title="Test" icon={Users} data={createCardData()} />,
    );
    expect(screen.getByText('Por vendedor')).toBeInTheDocument();
    expect(screen.getByText('aaaa1111...')).toBeInTheDocument();
    expect(screen.getByText('bbbb2222...')).toBeInTheDocument();
  });

  it('should render secondary label when provided', () => {
    render(
      <RankingCard
        title="Leads"
        icon={Users}
        data={createCardData()}
        secondaryLabel="prospectando"
      />,
    );
    expect(screen.getByText('(3 prospectando)')).toBeInTheDocument();
  });

  it('should render average per SDR', () => {
    render(
      <RankingCard title="Test" icon={Users} data={createCardData()} />,
    );
    expect(screen.getByText(/Média\/vendedor/)).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();
  });

  it('should render with unit suffix', () => {
    render(
      <RankingCard
        title="Conversão"
        icon={TrendingUp}
        unit="%"
        data={createCardData({ total: 42 })}
      />,
    );
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('should hide breakdown when no SDRs', () => {
    render(
      <RankingCard
        title="Test"
        icon={Users}
        data={createCardData({ sdrBreakdown: [] })}
      />,
    );
    expect(screen.queryByText('Por vendedor')).not.toBeInTheDocument();
  });
});
