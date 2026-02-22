import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';
const mockFrom = mockSupabaseFrom as any;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({ from: mockFrom }),
  ),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'test@test.com' })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockEnrollLeads = vi.fn();
vi.mock('@/features/cadences/actions/manage-cadences', () => ({
  enrollLeads: (...args: unknown[]) => mockEnrollLeads(...args),
}));

const mockEnrichLeadAction = vi.fn();
vi.mock('./enrich-lead', () => ({
  enrichLeadAction: (...args: unknown[]) => mockEnrichLeadAction(...args),
}));

import { revalidatePath } from 'next/cache';
import { createLead } from './create-lead';

// --- Chain helpers ---

function makeOrgMemberChain(orgId: string | null) {
  const singleMock = vi.fn().mockResolvedValue({ data: orgId ? { org_id: orgId } : null });
  const eqStatusMock = vi.fn().mockReturnValue({ single: singleMock });
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
  return { select: selectMock };
}

function makeAssigneeChain(found: boolean) {
  const singleMock = vi.fn().mockResolvedValue({ data: found ? { user_id: 'user-2' } : null });
  const eqStatusMock = vi.fn().mockReturnValue({ single: singleMock });
  const eqOrgMock = vi.fn().mockReturnValue({ eq: eqStatusMock });
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqOrgMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
  return { select: selectMock };
}

function makeDuplicateCheckChain(existing: boolean) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: existing ? { id: 'existing-id' } : null });
  const isMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const eqCnpjMock = vi.fn().mockReturnValue({ is: isMock });
  const eqOrgMock = vi.fn().mockReturnValue({ eq: eqCnpjMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqOrgMock });
  return { select: selectMock };
}

function makeInsertChain(leadId: string | null, error: { message: string } | null = null) {
  const singleMock = vi.fn().mockResolvedValue({
    data: leadId ? { id: leadId } : null,
    error,
  });
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  return { insert: insertMock };
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CADENCE_UUID = '660e8400-e29b-41d4-a716-446655440000';

const validInput = {
  cnpj: '11222333000181',
  assigned_to: VALID_UUID,
};

describe('createLead', () => {
  beforeEach(() => {
    resetMocks();
    mockEnrollLeads.mockResolvedValue({ success: true, data: { enrolled: 1, errors: [] } });
    mockEnrichLeadAction.mockResolvedValue({ success: true, data: undefined });
  });

  it('should create a lead with minimal fields', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain('new-lead-id');
    });

    const result = await createLead(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('new-lead-id');
    }
    expect(revalidatePath).toHaveBeenCalledWith('/leads');
    expect(mockEnrichLeadAction).toHaveBeenCalledWith('new-lead-id');
    expect(mockEnrollLeads).not.toHaveBeenCalled();
  });

  it('should enroll in cadence with immediate mode', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain('new-lead-id');
    });

    const result = await createLead({
      ...validInput,
      cadence_id: CADENCE_UUID,
      enrollment_mode: 'immediate',
    });

    expect(result.success).toBe(true);
    expect(mockEnrollLeads).toHaveBeenCalledWith(CADENCE_UUID, ['new-lead-id'], 'active');
  });

  it('should enroll in cadence with paused mode', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain('new-lead-id');
    });

    const result = await createLead({
      ...validInput,
      cadence_id: CADENCE_UUID,
      enrollment_mode: 'paused',
    });

    expect(result.success).toBe(true);
    expect(mockEnrollLeads).toHaveBeenCalledWith(CADENCE_UUID, ['new-lead-id'], 'paused');
  });

  it('should return error for duplicate CNPJ', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      return makeDuplicateCheckChain(true);
    });

    const result = await createLead(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Já existe um lead com este CNPJ');
      expect(result.code).toBe('DUPLICATE_CNPJ');
    }
  });

  it('should return error when org not found', async () => {
    mockFrom.mockImplementation(() => makeOrgMemberChain(null));

    const result = await createLead(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Organização não encontrada');
    }
  });

  it('should return error when assigned_to is not in org', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      return makeAssigneeChain(false);
    });

    const result = await createLead(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Responsável não pertence à organização');
    }
  });

  it('should return error for invalid input (missing CNPJ)', async () => {
    const result = await createLead({ assigned_to: VALID_UUID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('should return error for invalid input (missing assigned_to)', async () => {
    const result = await createLead({ cnpj: '11222333000181' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('should succeed even when enrollment fails', async () => {
    mockEnrollLeads.mockRejectedValue(new Error('Enrollment error'));

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain('new-lead-id');
    });

    const result = await createLead({
      ...validInput,
      cadence_id: CADENCE_UUID,
    });

    expect(result.success).toBe(true);
  });

  it('should succeed even when enrichment fails', async () => {
    mockEnrichLeadAction.mockRejectedValue(new Error('Enrichment error'));

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain('new-lead-id');
    });

    const result = await createLead(validInput);

    expect(result.success).toBe(true);
  });

  it('should return error when DB insert fails', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeOrgMemberChain('org-1');
      if (callCount === 2) return makeAssigneeChain(true);
      if (callCount === 3) return makeDuplicateCheckChain(false);
      return makeInsertChain(null, { message: 'Insert failed' });
    });

    const result = await createLead(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao criar lead');
    }
  });
});
