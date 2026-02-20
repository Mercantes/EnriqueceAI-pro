import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageSkeleton } from './PageSkeleton';

describe('PageSkeleton', () => {
  it('should match snapshot', () => {
    const { container } = render(<PageSkeleton />);
    expect(container).toMatchSnapshot();
  });
});
