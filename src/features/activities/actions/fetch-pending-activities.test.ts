import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';
const mockFrom = mockSupabaseFrom as ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'test@test.com' })),
}));

import { fetchPendingActivities } from './fetch-pending-activities';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockLead = {
  id: 'lead-1',
  org_id: 'org-1',
  nome_fantasia: 'Empresa ABC',
  razao_social: 'ABC Ltda',
  cnpj: '11222333000181',
  email: 'contato@abc.com',
  telefone: '11999990000',
  municipio: 'São Paulo',
  uf: 'SP',
  porte: 'ME',
};

const mockCadence = {
  id: 'cad-1',
  name: 'Outbound V1',
  total_steps: 3,
  created_by: 'user-1',
};

const mockEnrollment = {
  id: 'enr-1',
  cadence_id: 'cad-1',
  lead_id: 'lead-1',
  current_step: 1,
  status: 'active',
  next_step_due: '2026-02-19T10:00:00Z',
  lead: mockLead,
  cadence: mockCadence,
};

const mockStep = {
  id: 'step-1',
  cadence_id: 'cad-1',
  step_order: 1,
  channel: 'email' as const,
  template_id: 'tpl-1',
  delay_days: 0,
  delay_hours: 0,
  ai_personalization: false,
  created_at: '2026-01-01T00:00:00Z',
};

const mockTemplate = {
  id: 'tpl-1',
  org_id: 'org-1',
  name: 'Welcome Email',
  channel: 'email' as const,
  subject: 'Olá {{nome_fantasia}}',
  body: 'Prezada {{nome_fantasia}}, como vai?',
  variables_used: ['nome_fantasia'],
  is_system: false,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Chain mock factory
// ---------------------------------------------------------------------------

function createChainMock(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve, reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchPendingActivities', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return empty array when no enrollments are due', async () => {
    const enrollmentsChain = createChainMock({ data: [], error: null });

    mockFrom.mockImplementation(() => enrollmentsChain);

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should return error when enrollment query fails', async () => {
    const enrollmentsChain = createChainMock({
      data: null,
      error: { message: 'connection refused' },
    });

    mockFrom.mockImplementation(() => enrollmentsChain);

    const result = await fetchPendingActivities();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao buscar atividades pendentes');
    }
  });

  it('should return mapped PendingActivity when enrollments exist', async () => {
    const enrollmentsChain = createChainMock({
      data: [mockEnrollment],
      error: null,
    });

    const stepsChain = createChainMock({ data: [mockStep] });
    const templatesChain = createChainMock({ data: [mockTemplate] });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return enrollmentsChain;
      if (callIndex === 2) return stepsChain;
      if (callIndex === 3) return templatesChain;
      return createChainMock({ data: null });
    });

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);

    const activity = result.data[0];
    expect(activity.enrollmentId).toBe('enr-1');
    expect(activity.cadenceId).toBe('cad-1');
    expect(activity.cadenceName).toBe('Outbound V1');
    expect(activity.cadenceCreatedBy).toBe('user-1');
    expect(activity.stepId).toBe('step-1');
    expect(activity.stepOrder).toBe(1);
    expect(activity.totalSteps).toBe(3);
    expect(activity.channel).toBe('email');
    expect(activity.templateId).toBe('tpl-1');
    expect(activity.templateSubject).toBe('Olá {{nome_fantasia}}');
    expect(activity.templateBody).toBe('Prezada {{nome_fantasia}}, como vai?');
    expect(activity.aiPersonalization).toBe(false);
    expect(activity.lead).toEqual(mockLead);
  });

  it('should skip enrollments without matching step', async () => {
    const enrollmentNoStep = {
      ...mockEnrollment,
      current_step: 99, // step doesn't exist
    };

    const enrollmentsChain = createChainMock({
      data: [enrollmentNoStep],
      error: null,
    });

    const stepsChain = createChainMock({ data: [mockStep] }); // step_order=1, not 99

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return enrollmentsChain;
      if (callIndex === 2) return stepsChain;
      return createChainMock({ data: [] });
    });

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('should handle steps without templates', async () => {
    const stepNoTemplate = { ...mockStep, template_id: null };

    const enrollmentsChain = createChainMock({
      data: [mockEnrollment],
      error: null,
    });
    const stepsChain = createChainMock({ data: [stepNoTemplate] });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return enrollmentsChain;
      if (callIndex === 2) return stepsChain;
      return createChainMock({ data: [] });
    });

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].templateId).toBeNull();
    expect(result.data[0].templateSubject).toBeNull();
    expect(result.data[0].templateBody).toBeNull();
  });

  it('should skip enrollments missing lead or cadence', async () => {
    const enrollmentNoLead = {
      ...mockEnrollment,
      id: 'enr-bad',
      lead: null,
    };

    const enrollmentsChain = createChainMock({
      data: [enrollmentNoLead],
      error: null,
    });
    const stepsChain = createChainMock({ data: [mockStep] });
    const templatesChain = createChainMock({ data: [mockTemplate] });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return enrollmentsChain;
      if (callIndex === 2) return stepsChain;
      if (callIndex === 3) return templatesChain;
      return createChainMock({ data: null });
    });

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('should handle multiple enrollments across different cadences', async () => {
    const mockLead2 = { ...mockLead, id: 'lead-2', nome_fantasia: 'Empresa XYZ' };
    const mockCadence2 = { ...mockCadence, id: 'cad-2', name: 'Follow Up' };
    const enrollment2 = {
      ...mockEnrollment,
      id: 'enr-2',
      cadence_id: 'cad-2',
      lead_id: 'lead-2',
      lead: mockLead2,
      cadence: mockCadence2,
    };
    const step2 = { ...mockStep, id: 'step-2', cadence_id: 'cad-2' };

    const enrollmentsChain = createChainMock({
      data: [mockEnrollment, enrollment2],
      error: null,
    });
    const stepsChain = createChainMock({ data: [mockStep, step2] });
    const templatesChain = createChainMock({ data: [mockTemplate] });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return enrollmentsChain;
      if (callIndex === 2) return stepsChain;
      if (callIndex === 3) return templatesChain;
      return createChainMock({ data: null });
    });

    const result = await fetchPendingActivities();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0].cadenceName).toBe('Outbound V1');
    expect(result.data[1].cadenceName).toBe('Follow Up');
  });
});
