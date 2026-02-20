'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { EnrollmentListResult, EnrollmentWithLead } from '../cadences.contract';
import type { EnrollmentStatus } from '../types';

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };
  return member?.org_id ?? null;
}

export async function fetchCadenceEnrollments(
  cadenceId: string,
  page = 1,
  perPage = 50,
): Promise<ActionResult<EnrollmentListResult>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Verify cadence belongs to org
  const { data: cadence } = (await (supabase
    .from('cadences') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('id', cadenceId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single()) as { data: { id: string } | null };

  if (!cadence) {
    return { success: false, error: 'Cadência não encontrada' };
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count, error } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('*, leads!inner(razao_social, nome_fantasia, cnpj)', { count: 'exact' })
    .eq('cadence_id', cadenceId)
    .order('enrolled_at', { ascending: false })
    .range(from, to)) as {
    data: Array<Record<string, unknown> & { leads: { razao_social: string | null; nome_fantasia: string | null; cnpj: string } }> | null;
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao buscar inscritos' };
  }

  const enrollments: EnrollmentWithLead[] = (data ?? []).map((row) => {
    const { leads, ...enrollment } = row;
    return {
      ...enrollment,
      lead_name: leads.nome_fantasia ?? leads.razao_social,
      lead_cnpj: leads.cnpj,
    } as EnrollmentWithLead;
  });

  return {
    success: true,
    data: {
      data: enrollments,
      total: count ?? 0,
    },
  };
}

export async function fetchAvailableLeads(
  cadenceId: string,
  search?: string,
  limit = 20,
): Promise<ActionResult<Array<{ id: string; name: string; cnpj: string; email: string | null }>>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Get leads already enrolled in this cadence
  const { data: enrolled } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('lead_id')
    .eq('cadence_id', cadenceId)) as { data: Array<{ lead_id: string }> | null };

  const enrolledIds = (enrolled ?? []).map((e) => e.lead_id);

  // Get available leads
  let query = (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .select('id, razao_social, nome_fantasia, cnpj, email')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .limit(limit);

  if (enrolledIds.length > 0) {
    // Filter out already enrolled leads
    query = query.not('id', 'in', `(${enrolledIds.join(',')})`);
  }

  if (search && search.trim()) {
    query = query.or(`razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%`);
  }

  const { data, error } = (await query) as {
    data: Array<{ id: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string; email: string | null }> | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao buscar leads disponíveis' };
  }

  return {
    success: true,
    data: (data ?? []).map((lead) => ({
      id: lead.id,
      name: lead.nome_fantasia ?? lead.razao_social ?? lead.cnpj,
      cnpj: lead.cnpj,
      email: lead.email,
    })),
  };
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { error } = await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .update({ status } as Record<string, unknown>)
    .eq('id', enrollmentId);

  if (error) {
    return { success: false, error: 'Erro ao atualizar status do enrollment' };
  }

  return { success: true, data: undefined };
}

export async function removeEnrollment(
  enrollmentId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { error } = await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id', enrollmentId);

  if (error) {
    return { success: false, error: 'Erro ao remover enrollment' };
  }

  return { success: true, data: undefined };
}
