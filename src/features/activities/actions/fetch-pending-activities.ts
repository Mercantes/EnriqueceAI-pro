'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CadenceRow, CadenceStepRow, MessageTemplateRow } from '@/features/cadences/types';

import type { ActivityLead, PendingActivity } from '../types';

interface EnrollmentRow {
  id: string;
  cadence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  next_step_due: string | null;
  lead: ActivityLead;
  cadence: Pick<CadenceRow, 'id' | 'name' | 'total_steps' | 'created_by'>;
}

export async function fetchPendingActivities(): Promise<ActionResult<PendingActivity[]>> {
  await requireAuth();
  const supabase = await createServerSupabaseClient();

  // 1. Fetch active enrollments with due steps, joined with lead + cadence
  const { data: enrollments, error: enrollError } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('id, cadence_id, lead_id, current_step, status, next_step_due, lead:leads(*), cadence:cadences(id, name, total_steps, created_by)')
    .eq('status', 'active')
    .lte('next_step_due', new Date().toISOString())
    .order('next_step_due', { ascending: true })
    .limit(100)) as { data: EnrollmentRow[] | null; error: { message: string } | null };

  if (enrollError) {
    console.error('[activities] Failed to fetch enrollments:', enrollError.message);
    return { success: false, error: 'Erro ao buscar atividades pendentes' };
  }

  if (!enrollments || enrollments.length === 0) {
    return { success: true, data: [] };
  }

  // 2. Collect unique cadence IDs and batch-fetch steps + templates
  const cadenceIds = [...new Set(enrollments.map((e) => e.cadence_id))];

  const { data: steps } = (await (supabase
    .from('cadence_steps') as ReturnType<typeof supabase.from>)
    .select('*')
    .in('cadence_id', cadenceIds)) as { data: CadenceStepRow[] | null };

  const templateIds = (steps ?? [])
    .map((s) => s.template_id)
    .filter((id): id is string => id != null);

  let templates: MessageTemplateRow[] = [];
  if (templateIds.length > 0) {
    const { data: tplData } = (await (supabase
      .from('message_templates') as ReturnType<typeof supabase.from>)
      .select('*')
      .in('id', templateIds)) as { data: MessageTemplateRow[] | null };
    templates = tplData ?? [];
  }

  // 3. Build lookup maps
  const stepMap = new Map<string, CadenceStepRow[]>();
  for (const s of steps ?? []) {
    const list = stepMap.get(s.cadence_id) ?? [];
    list.push(s);
    stepMap.set(s.cadence_id, list);
  }

  const templateMap = new Map<string, MessageTemplateRow>();
  for (const t of templates) {
    templateMap.set(t.id, t);
  }

  // 4. Map enrollments to PendingActivity[]
  const activities: PendingActivity[] = [];

  for (const enrollment of enrollments) {
    if (!enrollment.lead || !enrollment.cadence || !enrollment.next_step_due) continue;

    const cadenceSteps = stepMap.get(enrollment.cadence_id) ?? [];
    const currentStep = cadenceSteps.find((s) => s.step_order === enrollment.current_step);

    if (!currentStep) continue;

    const template = currentStep.template_id ? templateMap.get(currentStep.template_id) : null;

    activities.push({
      enrollmentId: enrollment.id,
      cadenceId: enrollment.cadence_id,
      cadenceName: enrollment.cadence.name,
      cadenceCreatedBy: enrollment.cadence.created_by,
      stepId: currentStep.id,
      stepOrder: currentStep.step_order,
      totalSteps: enrollment.cadence.total_steps,
      channel: currentStep.channel,
      templateId: currentStep.template_id,
      templateSubject: template?.subject ?? null,
      templateBody: template?.body ?? null,
      aiPersonalization: currentStep.ai_personalization,
      nextStepDue: enrollment.next_step_due,
      lead: enrollment.lead,
    });
  }

  return { success: true, data: activities };
}
