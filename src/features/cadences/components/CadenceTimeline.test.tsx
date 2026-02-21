import { describe, expect, it } from 'vitest';

import { getGlobalStepNumber, type DayData } from './CadenceTimeline';

describe('getGlobalStepNumber', () => {
  const days: DayData[] = [
    {
      day: 1,
      steps: [
        { id: 's1', channel: 'email', label: 'E-mail' },
        { id: 's2', channel: 'phone', label: 'Ligação' },
        { id: 's3', channel: 'linkedin', label: 'LinkedIn' },
      ],
    },
    {
      day: 2,
      steps: [
        { id: 's4', channel: 'whatsapp', label: 'WhatsApp' },
        { id: 's5', channel: 'research', label: 'Pesquisa' },
      ],
    },
    {
      day: 3,
      steps: [
        { id: 's6', channel: 'email', label: 'E-mail' },
      ],
    },
  ];

  it('should return 1 for first step of first day', () => {
    expect(getGlobalStepNumber(days, 0, 0)).toBe(1);
  });

  it('should return 2 for second step of first day', () => {
    expect(getGlobalStepNumber(days, 0, 1)).toBe(2);
  });

  it('should return 3 for third step of first day', () => {
    expect(getGlobalStepNumber(days, 0, 2)).toBe(3);
  });

  it('should return 4 for first step of second day', () => {
    expect(getGlobalStepNumber(days, 1, 0)).toBe(4);
  });

  it('should return 5 for second step of second day', () => {
    expect(getGlobalStepNumber(days, 1, 1)).toBe(5);
  });

  it('should return 6 for first step of third day', () => {
    expect(getGlobalStepNumber(days, 2, 0)).toBe(6);
  });

  it('should handle empty days correctly', () => {
    const daysWithEmpty: DayData[] = [
      { day: 1, steps: [] },
      { day: 2, steps: [{ id: 's1', channel: 'email', label: 'E-mail' }] },
    ];
    expect(getGlobalStepNumber(daysWithEmpty, 1, 0)).toBe(1);
  });

  it('should handle single day with single step', () => {
    const singleDay: DayData[] = [
      { day: 1, steps: [{ id: 's1', channel: 'email', label: 'E-mail' }] },
    ];
    expect(getGlobalStepNumber(singleDay, 0, 0)).toBe(1);
  });
});
