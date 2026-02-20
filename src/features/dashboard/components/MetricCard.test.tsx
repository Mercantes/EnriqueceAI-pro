import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Users } from 'lucide-react';

import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('should render title and value', () => {
    render(<MetricCard title="Total de Leads" value={42} icon={Users} />);
    expect(screen.getByText('Total de Leads')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(
      <MetricCard title="Leads" value={10} icon={Users} description="+5 esta semana" />,
    );
    expect(screen.getByText('+5 esta semana')).toBeInTheDocument();
  });

  it('should render string value', () => {
    render(<MetricCard title="Taxa" value="85%" icon={Users} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});
