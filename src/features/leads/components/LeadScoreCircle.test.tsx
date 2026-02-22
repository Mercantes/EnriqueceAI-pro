import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadScoreCircle } from './LeadScoreCircle';

describe('LeadScoreCircle', () => {
  it('should render score number when score is provided', () => {
    render(<LeadScoreCircle score={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should render dash when score is null', () => {
    render(<LeadScoreCircle score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should apply green color for score >= 7', () => {
    const { container } = render(<LeadScoreCircle score={7} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-green-500');
  });

  it('should apply green color for high score', () => {
    const { container } = render(<LeadScoreCircle score={10} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-green-500');
  });

  it('should apply yellow color for score 4-6', () => {
    const { container } = render(<LeadScoreCircle score={5} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-yellow-500');
  });

  it('should apply yellow color for score exactly 4', () => {
    const { container } = render(<LeadScoreCircle score={4} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-yellow-500');
  });

  it('should apply red color for score <= 3', () => {
    const { container } = render(<LeadScoreCircle score={3} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-red-500');
  });

  it('should apply red color for negative score', () => {
    const { container } = render(<LeadScoreCircle score={-5} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-red-500');
  });

  it('should apply gray color for null score', () => {
    const { container } = render(<LeadScoreCircle score={null} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('text-gray-300');
  });

  it('should render SVG with correct size', () => {
    const { container } = render(<LeadScoreCircle score={5} size={48} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });

  it('should render SVG ring circles', () => {
    const { container } = render(<LeadScoreCircle score={5} />);
    const circles = container.querySelectorAll('circle');
    // Background ring + score ring
    expect(circles.length).toBe(2);
  });

  it('should not render score ring when score is null', () => {
    const { container } = render(<LeadScoreCircle score={null} />);
    const circles = container.querySelectorAll('circle');
    // Only background ring
    expect(circles.length).toBe(1);
  });
});
