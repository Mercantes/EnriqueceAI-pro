'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ChannelType } from '@/features/cadences/types';

export interface EnrollmentStepInfo {
  step_order: number;
  channel: ChannelType;
  status: 'completed' | 'current' | 'future';
}

export interface LeadEnrollmentData {
  enrollment: {
    cadence_name: string;
    status: string;
    current_step: number;
    total_steps: number;
    enrolled_by_email: string | null;
  } | null;
  steps: EnrollmentStepInfo[];
  kpis: {
    completed: number;
    open: number;
    conversations: number;
  };
}

export async function fetchLeadEnrollment(
  leadId: string,
): Promise<ActionResult<LeadEnrollmentData>> {
  await requireAuth();
  const supabase = await createServerSupabaseClient();

  // Get active enrollment with cadence info
  const { data: enrollment } = await supabase
    .from('cadence_enrollments')
    .select(`
      id,
      cadence_id,
      status,
      current_step,
      enrolled_by,
      cadences!inner ( name, total_steps )
    `)
    .eq('lead_id', leadId)
    .in('status', ['active', 'paused'])
    .limit(1)
    .maybeSingle();

  let enrollmentData: LeadEnrollmentData['enrollment'] = null;
  let steps: EnrollmentStepInfo[] = [];

  if (enrollment) {
    const row = enrollment as unknown as {
      id: string;
      cadence_id: string;
      status: string;
      current_step: number;
      enrolled_by: string | null;
      cadences: { name: string; total_steps: number };
    };

    // Resolve enrolled_by to email
    let enrolledByEmail: string | null = null;
    if (row.enrolled_by) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('user_email')
        .eq('user_id', row.enrolled_by)
        .maybeSingle();
      enrolledByEmail = (member as { user_email: string | null } | null)?.user_email ?? null;
    }

    enrollmentData = {
      cadence_name: row.cadences.name,
      status: row.status,
      current_step: row.current_step,
      total_steps: row.cadences.total_steps,
      enrolled_by_email: enrolledByEmail,
    };

    // Get cadence steps for the progress bar
    const { data: stepsData } = await supabase
      .from('cadence_steps')
      .select('step_order, channel')
      .eq('cadence_id', row.cadence_id)
      .order('step_order', { ascending: true });

    if (stepsData) {
      steps = (stepsData as Array<{ step_order: number; channel: string }>).map((s) => ({
        step_order: s.step_order,
        channel: s.channel as ChannelType,
        status: s.step_order < row.current_step
          ? 'completed' as const
          : s.step_order === row.current_step
            ? 'current' as const
            : 'future' as const,
      }));
    }
  }

  // KPIs from interactions
  const [completedRes, openRes, conversationRes] = await Promise.all([
    supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .in('type', ['sent', 'delivered', 'opened', 'clicked']),
    supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('type', 'sent'),
    supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .in('type', ['replied', 'meeting_scheduled']),
  ]);

  return {
    success: true,
    data: {
      enrollment: enrollmentData,
      steps,
      kpis: {
        completed: completedRes.count ?? 0,
        open: openRes.count ?? 0,
        conversations: conversationRes.count ?? 0,
      },
    },
  };
}
