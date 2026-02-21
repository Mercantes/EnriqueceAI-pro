import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './ActivityRow';

describe('formatRelativeTime', () => {
  it('should return "Agora" for just now', () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result.text).toBe('Agora');
    expect(result.isUrgent).toBe(false);
  });

  it('should return minutes for < 60 min', () => {
    const date = new Date(Date.now() - 30 * 60000); // 30 min ago
    const result = formatRelativeTime(date.toISOString());
    expect(result.text).toBe('Há 30min');
    expect(result.isUrgent).toBe(false);
  });

  it('should return hours for < 24h', () => {
    const date = new Date(Date.now() - 3 * 3600000); // 3 hours ago
    const result = formatRelativeTime(date.toISOString());
    expect(result.text).toBe('Há 3h');
    expect(result.isUrgent).toBe(true);
  });

  it('should return days for >= 24h', () => {
    const date = new Date(Date.now() - 2 * 24 * 3600000); // 2 days ago
    const result = formatRelativeTime(date.toISOString());
    expect(result.text).toBe('Há 2d');
    expect(result.isUrgent).toBe(true);
  });

  it('should mark urgent at exactly 1 hour (AC 7)', () => {
    const date = new Date(Date.now() - 60 * 60000); // exactly 1h ago
    const result = formatRelativeTime(date.toISOString());
    expect(result.isUrgent).toBe(true);
  });

  it('should not mark urgent at 59 min', () => {
    const date = new Date(Date.now() - 59 * 60000); // 59 min ago
    const result = formatRelativeTime(date.toISOString());
    expect(result.isUrgent).toBe(false);
  });
});
