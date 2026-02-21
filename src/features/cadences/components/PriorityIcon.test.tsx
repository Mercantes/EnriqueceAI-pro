import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CadencePriority } from '../types';
import { PriorityIcon } from './PriorityIcon';

describe('PriorityIcon', () => {
  it('renders with high priority (green)', () => {
    render(<PriorityIcon priority="high" />);
    const icon = screen.getByLabelText('Prioridade Alta');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-green-600');
  });

  it('renders with medium priority (yellow)', () => {
    render(<PriorityIcon priority="medium" />);
    const icon = screen.getByLabelText('Prioridade Média');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-yellow-500');
  });

  it('renders with low priority (gray)', () => {
    render(<PriorityIcon priority="low" />);
    const icon = screen.getByLabelText('Prioridade Baixa');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-gray-400');
  });

  it('accepts custom className', () => {
    render(<PriorityIcon priority="high" className="h-6 w-6" />);
    const icon = screen.getByLabelText('Prioridade Alta');
    expect(icon).toHaveClass('h-6', 'w-6');
  });

  it.each<[CadencePriority, string]>([
    ['high', 'Alta'],
    ['medium', 'Média'],
    ['low', 'Baixa'],
  ])('renders accessible label for %s priority', (priority, label) => {
    render(<PriorityIcon priority={priority} />);
    expect(screen.getByLabelText(`Prioridade ${label}`)).toBeInTheDocument();
  });
});
