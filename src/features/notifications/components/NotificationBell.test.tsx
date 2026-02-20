import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationContext } from './NotificationProvider';
import type { NotificationContextValue } from './NotificationProvider';
import { NotificationBell } from './NotificationBell';

function renderWithContext(overrides: Partial<NotificationContextValue> = {}) {
  const defaultValue: NotificationContextValue = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    hasMore: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    loadMore: vi.fn(),
    ...overrides,
  };

  return render(
    <NotificationContext.Provider value={defaultValue}>
      <NotificationBell />
    </NotificationContext.Provider>,
  );
}

describe('NotificationBell', () => {
  it('should render bell button', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /notificações/i })).toBeInTheDocument();
  });

  it('should not show badge when unreadCount is 0', () => {
    renderWithContext({ unreadCount: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should show badge with unread count', () => {
    renderWithContext({ unreadCount: 5 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show 99+ when count exceeds 99', () => {
    renderWithContext({ unreadCount: 150 });
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});
