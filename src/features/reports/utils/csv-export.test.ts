import { describe, expect, it } from 'vitest';

import type { CadenceMetrics, SdrMetrics } from '../reports.contract';
import { cadenceMetricsToCsv, sdrMetricsToCsv } from './csv-export';

describe('cadenceMetricsToCsv', () => {
  it('should generate CSV with headers and data', () => {
    const metrics: CadenceMetrics[] = [
      {
        cadenceId: 'c1',
        cadenceName: 'Outbound Q1',
        totalEnrollments: 100,
        sent: 90,
        delivered: 85,
        opened: 45,
        replied: 10,
        bounced: 5,
        meetings: 3,
        openRate: 50,
        replyRate: 11.1,
        bounceRate: 5.6,
        conversionRate: 10,
      },
    ];

    const csv = cadenceMetricsToCsv(metrics);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Cadência');
    expect(lines[0]).toContain('Taxa Abertura (%)');
    expect(lines[1]).toContain('Outbound Q1');
    expect(lines[1]).toContain('100');
    expect(lines[1]).toContain('50');
  });

  it('should escape fields with commas', () => {
    const metrics: CadenceMetrics[] = [
      {
        cadenceId: 'c1',
        cadenceName: 'Lead, Nurture',
        totalEnrollments: 10,
        sent: 10,
        delivered: 10,
        opened: 5,
        replied: 2,
        bounced: 0,
        meetings: 1,
        openRate: 50,
        replyRate: 20,
        bounceRate: 0,
        conversionRate: 20,
      },
    ];

    const csv = cadenceMetricsToCsv(metrics);
    expect(csv).toContain('"Lead, Nurture"');
  });
});

describe('sdrMetricsToCsv', () => {
  it('should generate CSV for SDR metrics', () => {
    const metrics: SdrMetrics[] = [
      {
        userId: 'u1',
        userName: 'sdr@enriqueceai.com',
        leadsWorked: 50,
        messagesSent: 120,
        replies: 15,
        meetings: 5,
        conversionRate: 30,
      },
    ];

    const csv = sdrMetricsToCsv(metrics);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('SDR');
    expect(lines[1]).toContain('sdr@enriqueceai.com');
    expect(lines[1]).toContain('50');
  });
});
