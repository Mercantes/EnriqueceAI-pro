'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DialerQueueItem {
  enrollmentId: string;
  leadId: string;
  leadName: string;
  companyName: string;
  phone: string | null;
  cadenceName: string;
  cadenceId: string;
  stepId: string;
  stepOrder: number;
  totalSteps: number;
  nextStepDue: string;
}

export async function fetchDialerQueue(): Promise<ActionResult<DialerQueueItem[]>> {
  await requireAuth();
  const supabase = await createServerSupabaseClient();

  // Active enrollments where next step is due
  const { data: enrollments, error } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('id, cadence_id, lead_id, current_step, next_step_due, lead:leads(id, nome_fantasia, razao_social, cnpj, telefone), cadence:cadences(id, name)')
    .eq('status', 'active')
    .lte('next_step_due', new Date().toISOString())
    .order('next_step_due', { ascending: true })
    .limit(50)) as {
      data: Array<{
        id: string;
        cadence_id: string;
        lead_id: string;
        current_step: number;
        next_step_due: string;
        lead: { id: string; nome_fantasia: string | null; razao_social: string | null; cnpj: string; telefone: string | null } | null;
        cadence: { id: string; name: string } | null;
      }> | null;
      error: { message: string } | null;
    };

  if (error || !enrollments) {
    return { success: true, data: [] };
  }

  // Batch-fetch all steps for these cadences (phone only + total count)
  const cadenceIds = [...new Set(enrollments.map((e) => e.cadence_id))];
  if (cadenceIds.length === 0) return { success: true, data: [] };

  const [phoneStepsResult, allStepsResult] = await Promise.all([
    (supabase
      .from('cadence_steps') as ReturnType<typeof supabase.from>)
      .select('id, cadence_id, step_order, channel')
      .in('cadence_id', cadenceIds)
      .eq('channel', 'phone') as Promise<{ data: Array<{ id: string; cadence_id: string; step_order: number; channel: string }> | null }>,
    (supabase
      .from('cadence_steps') as ReturnType<typeof supabase.from>)
      .select('cadence_id, step_order')
      .in('cadence_id', cadenceIds) as Promise<{ data: Array<{ cadence_id: string; step_order: number }> | null }>,
  ]);

  // Build lookup: cadence_id -> set of phone step_orders and their IDs
  const phoneSteps = new Map<string, Map<number, string>>(); // cadence_id -> (step_order -> step_id)
  for (const s of phoneStepsResult.data ?? []) {
    const map = phoneSteps.get(s.cadence_id) ?? new Map();
    map.set(s.step_order, s.id);
    phoneSteps.set(s.cadence_id, map);
  }

  // Build total step count per cadence
  const stepCounts = new Map<string, number>();
  for (const s of allStepsResult.data ?? []) {
    stepCounts.set(s.cadence_id, (stepCounts.get(s.cadence_id) ?? 0) + 1);
  }

  // Filter enrollments where current step is a phone step
  const result: DialerQueueItem[] = [];
  for (const e of enrollments) {
    if (!e.lead || !e.cadence) continue;
    const phoneMap = phoneSteps.get(e.cadence_id);
    const stepId = phoneMap?.get(e.current_step);
    if (!stepId) continue;

    result.push({
      enrollmentId: e.id,
      leadId: e.lead.id,
      leadName: e.lead.nome_fantasia ?? e.lead.razao_social ?? e.lead.cnpj,
      companyName: e.lead.razao_social ?? e.lead.cnpj,
      phone: e.lead.telefone,
      cadenceName: e.cadence.name,
      cadenceId: e.cadence_id,
      stepId,
      stepOrder: e.current_step,
      totalSteps: stepCounts.get(e.cadence_id) ?? 1,
      nextStepDue: e.next_step_due,
    });
  }

  return { success: true, data: result };
}
