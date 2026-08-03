import { describe, expect, it } from 'vitest';

import { summarizeDirectResets } from './detect-status-reset-alert.logic';

function row(
  overrides: Partial<{
    org_id: string | null;
    created_at: string;
    from: string | null;
    to: string | null;
    app: string | null;
  }> = {},
) {
  const { org_id = 'org-1', created_at = '2026-08-02T17:39:00Z', from = 'contacted', to = 'new', app = 'mgmt-api' } =
    overrides;
  return {
    org_id,
    created_at,
    metadata: { changes: { status: { from, to } }, pg_application_name: app },
  };
}

describe('summarizeDirectResets', () => {
  it('conta reversões contacted→new por SQL direto, agrupando por org', () => {
    const out = summarizeDirectResets([
      row({ org_id: 'org-1', created_at: '2026-08-02T17:39:00Z' }),
      row({ org_id: 'org-1', created_at: '2026-08-02T17:39:10Z' }),
      row({ org_id: 'org-2', from: 'qualified' }),
    ]);
    const org1 = out.find((s) => s.orgId === 'org-1');
    expect(org1?.count).toBe(2);
    expect(out.find((s) => s.orgId === 'org-2')?.count).toBe(1);
  });

  it('guarda o primeiro horário (mais antigo) da reversão', () => {
    const [s] = summarizeDirectResets([
      row({ created_at: '2026-08-02T20:00:00Z' }),
      row({ created_at: '2026-08-02T17:39:00Z' }),
      row({ created_at: '2026-08-02T18:30:00Z' }),
    ]);
    expect(s?.firstAt).toBe('2026-08-02T17:39:00Z');
  });

  it('ignora o caminho normal do app (pg_application_name = postgrest)', () => {
    expect(summarizeDirectResets([row({ app: 'postgrest' })])).toEqual([]);
  });

  it('ignora mudanças que não são PARA new', () => {
    expect(summarizeDirectResets([row({ to: 'contacted' })])).toEqual([]);
  });

  it('ignora quando o status de origem já era new (ou ausente)', () => {
    expect(summarizeDirectResets([row({ from: 'new' }), row({ from: null })])).toEqual([]);
  });

  it('ignora eventos sem org_id', () => {
    expect(summarizeDirectResets([row({ org_id: null })])).toEqual([]);
  });

  it('rotula a origem (app) desconhecida quando ausente', () => {
    const [s] = summarizeDirectResets([row({ app: null })]);
    expect(s?.app).toBe('desconhecido');
  });
});
