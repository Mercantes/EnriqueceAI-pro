import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Testes de comportamento da importação em lote.
 *
 * O mock encadeado usado nos outros testes de action não dá conta daqui: o
 * importLeads faz SELECT de dedup, INSERT em lote, INSERT individual e UPDATE
 * de restore, e o que precisa ser verificado é justamente a interação entre
 * eles (quantas queries, quem entra no lote, o que cai no fallback). Então
 * este arquivo monta um mini-PostgREST com estado, incluindo os índices
 * únicos org-wide de CNPJ e lower(email) — que são a rede de segurança do
 * caminho em lote.
 */

interface FakeLead {
  id: string;
  org_id: string;
  cnpj: string | null;
  email: string | null;
  razao_social: string | null;
  telefone: string | null;
  status: string;
  deleted_at: string | null;
  import_id?: string | null;
}

interface FakeState {
  leads: FakeLead[];
  importErrors: Array<{ row_number: number; kind: string; error_message: string }>;
  importUpdates: Array<Record<string, unknown>>;
  /** Quantidade de INSERTs em `leads` que levaram mais de uma linha. */
  batchInserts: number;
  /** Quantidade de INSERTs em `leads` com uma linha só (caminho individual). */
  singleInserts: number;
  leadSelects: number;
}

const ORG = 'org-1';
let state: FakeState;
let nextId = 0;

function uniqueViolation(row: Record<string, unknown>): string | null {
  const cnpj = row.cnpj as string | null;
  const email = row.email as string | null;
  if (cnpj && state.leads.some((l) => l.org_id === ORG && l.cnpj === cnpj)) {
    return 'duplicate key value violates unique constraint "leads_org_cnpj_unique"';
  }
  if (email && state.leads.some((l) => l.org_id === ORG && l.email?.toLowerCase() === email.toLowerCase())) {
    return 'duplicate key value violates unique constraint "leads_org_email_unique"';
  }
  return null;
}

class FakeQuery {
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: Record<string, unknown> | Record<string, unknown>[] = {};
  private filters: Array<{ kind: string; col: string; val: unknown }> = [];
  private wantsCount = false;
  private headOnly = false;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.op = 'select';
    this.wantsCount = opts?.count === 'exact';
    this.headOnly = !!opts?.head;
    return this;
  }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push({ kind: 'eq', col, val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ kind: 'is', col, val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ kind: 'in', col, val }); return this; }
  ilike(col: string, val: string) { this.filters.push({ kind: 'ilike', col, val }); return this; }
  limit() { return this; }

  private matches(lead: FakeLead): boolean {
    return this.filters.every((f) => {
      const actual = (lead as unknown as Record<string, unknown>)[f.col];
      if (f.kind === 'eq') return actual === f.val;
      if (f.kind === 'is') return actual === f.val;
      if (f.kind === 'in') return (f.val as unknown[]).includes(actual);
      if (f.kind === 'ilike') {
        // O código escapa `%`/`_`; aqui isso vira comparação exata sem caixa.
        const pattern = String(f.val).replace(/\\(.)/g, '$1');
        return typeof actual === 'string' && actual.toLowerCase() === pattern.toLowerCase();
      }
      return true;
    });
  }

  private run(mode: 'single' | 'maybe' | 'many') {
    if (this.table === 'subscriptions' || this.table === 'plans') {
      return { data: null, error: null, count: null };
    }

    if (this.table === 'lead_imports') {
      if (this.op === 'insert') return { data: { id: 'import-1' }, error: null, count: null };
      if (this.op === 'update') {
        state.importUpdates.push(this.payload as Record<string, unknown>);
        return { data: null, error: null, count: null };
      }
      return { data: null, error: null, count: null };
    }

    if (this.table === 'lead_import_errors') {
      const p = this.payload as Record<string, unknown>;
      state.importErrors.push({
        row_number: p.row_number as number,
        kind: (p.kind as string) ?? 'error',
        error_message: p.error_message as string,
      });
      return { data: null, error: null, count: null };
    }

    // leads
    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (rows.length > 1) state.batchInserts++;
      else state.singleInserts++;

      // Postgres aborta o comando inteiro na primeira violação.
      for (const row of rows) {
        const violation = uniqueViolation(row);
        if (violation) return { data: null, error: { message: violation }, count: null };
      }

      const inserted = rows.map((row) => {
        const lead: FakeLead = {
          id: `lead-${++nextId}`,
          org_id: row.org_id as string,
          cnpj: (row.cnpj as string) ?? null,
          email: (row.email as string) ?? null,
          razao_social: (row.razao_social as string) ?? null,
          telefone: (row.telefone as string) ?? null,
          status: (row.status as string) ?? 'new',
          deleted_at: null,
          import_id: (row.import_id as string) ?? null,
        };
        state.leads.push(lead);
        return { id: lead.id };
      });

      if (mode === 'many') return { data: inserted, error: null, count: null };
      return { data: inserted[0] ?? null, error: null, count: null };
    }

    if (this.op === 'update') {
      const target = state.leads.filter((l) => this.matches(l));
      for (const lead of target) Object.assign(lead, this.payload);
      const first = target[0];
      return { data: first ? { id: first.id } : null, error: null, count: null };
    }

    state.leadSelects++;
    const found = state.leads.filter((l) => this.matches(l));
    if (this.wantsCount) return { data: null, error: null, count: found.length };
    if (this.headOnly) return { data: null, error: null, count: found.length };
    if (mode === 'many') return { data: found, error: null, count: found.length };
    return { data: found[0] ?? null, error: null, count: found.length };
  }

  single() { return Promise.resolve(this.run('single')); }
  maybeSingle() { return Promise.resolve(this.run('maybe')); }
  then<T>(resolve: (v: unknown) => T) { return Promise.resolve(this.run('many')).then(resolve); }
}

const fakeClient = { from: (table: string) => new FakeQuery(table) };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(fakeClient)),
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => fakeClient),
}));
vi.mock('@/lib/auth/require-auth-with-member', () => ({
  requireAuthWithMember: vi.fn(() => Promise.resolve({ userId: 'user-1', orgId: ORG, role: 'manager' })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/notifications/services/notification.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock('./log-lead-event', () => ({ logLeadEventBulk: vi.fn() }));

import { importLeads } from './import-leads';

function csvFile(content: string): FormData {
  const form = new FormData();
  form.append('file', new File([content], 'leads.csv', { type: 'text/csv' }));
  return form;
}

function seedLead(lead: Partial<FakeLead>) {
  state.leads.push({
    id: `seed-${++nextId}`,
    org_id: ORG,
    cnpj: null,
    email: null,
    razao_social: null,
    telefone: null,
    status: 'new',
    deleted_at: null,
    ...lead,
  });
}

beforeEach(() => {
  state = { leads: [], importErrors: [], importUpdates: [], batchInserts: 0, singleInserts: 0, leadSelects: 0 };
  nextId = 0;
});

describe('importLeads — importação em lote', () => {
  it('grava várias linhas num único INSERT', async () => {
    const csv = [
      'cnpj,razao_social,email',
      '11222333000181,Alfa,alfa@x.com',
      '45678901000175,Beta,beta@x.com',
      '01023456000130,Gama,gama@x.com',
    ].join('\n');

    const result = await importLeads(csvFile(csv));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.successCount).toBe(3);
    expect(state.leads).toHaveLength(3);
    // O ponto da Onda 2: um INSERT para o bloco inteiro, nenhum individual.
    expect(state.batchInserts).toBe(1);
    expect(state.singleInserts).toBe(0);
  });

  it('não repete queries de dedup por linha', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => `,Empresa ${i},empresa${i}@x.com`);
    const csv = ['cnpj,razao_social,email', ...rows].join('\n');

    await importLeads(csvFile(csv));

    // 3 SELECTs de dedup por bloco (cnpj, email, telefone) — e não 1 por
    // linha. O count do limite de plano não roda (sem subscription).
    expect(state.leadSelects).toBeLessThanOrEqual(3);
    expect(state.leads).toHaveLength(20);
  });

  it('marca linha repetida dentro do próprio arquivo como duplicada', async () => {
    const csv = [
      'cnpj,razao_social,email',
      '11222333000181,Alfa,alfa@x.com',
      '11222333000181,Alfa de novo,alfa@x.com',
    ].join('\n');

    const result = await importLeads(csvFile(csv));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.successCount).toBe(1);
    expect(result.data.duplicateCount).toBe(1);
    expect(result.data.errorCount).toBe(0);
    expect(state.leads).toHaveLength(1);
    expect(state.importErrors.filter((e) => e.kind === 'duplicate')).toHaveLength(1);
  });

  it('reconhece lead que já existe na base sem tentar inserir', async () => {
    seedLead({ cnpj: '11222333000181', razao_social: 'Alfa', status: 'contacted' });
    const csv = [
      'cnpj,razao_social,email',
      '11222333000181,Alfa,alfa@x.com',
      '45678901000175,Beta,beta@x.com',
    ].join('\n');

    const result = await importLeads(csvFile(csv));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.successCount).toBe(1);
    expect(result.data.duplicateCount).toBe(1);
    expect(state.leads).toHaveLength(2);
  });

  it('restaura lead arquivado em vez de contar como duplicado', async () => {
    seedLead({ cnpj: '11222333000181', razao_social: 'Alfa', status: 'archived' });
    const csv = 'cnpj,razao_social\n11222333000181,Alfa Reimportada';

    const result = await importLeads(csvFile(csv));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.successCount).toBe(1);
    expect(result.data.duplicateCount).toBe(0);
    expect(state.leads[0]?.status).toBe('new');
    expect(state.leads[0]?.razao_social).toBe('Alfa Reimportada');
  });

  it('isola a linha ruim quando o banco recusa o lote inteiro', async () => {
    // E-mail gravado com outra caixa: escapa do pré-carregamento (`.in()` é
    // byte a byte) e só o índice único lower(email) pega, derrubando o
    // INSERT das 3 linhas. O fallback individual tem que salvar as boas.
    seedLead({ email: 'ALFA@X.COM', razao_social: 'Alfa' });
    const csv = [
      'cnpj,razao_social,email',
      '11222333000181,Alfa,alfa@x.com',
      '45678901000175,Beta,beta@x.com',
      '01023456000130,Gama,gama@x.com',
    ].join('\n');

    const result = await importLeads(csvFile(csv));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(state.batchInserts).toBe(1); // o lote foi tentado
    expect(state.singleInserts).toBe(3); // e reprocessado linha a linha
    expect(result.data.successCount).toBe(2); // Beta e Gama entraram
    expect(result.data.duplicateCount).toBe(1); // Alfa foi barrada
    expect(result.data.errorCount).toBe(0);
  });

  it('conclui o import gravando status e contadores', async () => {
    const csv = 'cnpj,razao_social\n11222333000181,Alfa';

    await importLeads(csvFile(csv));

    const final = state.importUpdates.at(-1);
    expect(final?.status).toBe('completed');
    expect(final?.success_count).toBe(1);
    expect(final?.duplicate_count).toBe(0);
    expect(final?.error_count).toBe(0);
  });
});
