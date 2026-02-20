import { render, screen } from '@testing-library/react';
import { Upload } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('should render title and description', () => {
    render(
      <EmptyState icon={Upload} title="No data" description="Nothing here yet" />,
    );
    expect(screen.getByText('No data')).toBeDefined();
    expect(screen.getByText('Nothing here yet')).toBeDefined();
  });

  it('should render action button when provided', () => {
    render(
      <EmptyState
        icon={Upload}
        title="No data"
        description="Nothing here"
        action={{ label: 'Add', href: '/add' }}
      />,
    );
    expect(screen.getByText('Add')).toBeDefined();
  });

  it('should not render action button when not provided', () => {
    render(
      <EmptyState icon={Upload} title="No data" description="Nothing here" />,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('should match snapshot', () => {
    const { container } = render(
      <EmptyState
        icon={Upload}
        title="Import leads"
        description="Get started by importing"
        action={{ label: 'Import', href: '/import' }}
      />,
    );
    expect(container).toMatchSnapshot();
  });
});
