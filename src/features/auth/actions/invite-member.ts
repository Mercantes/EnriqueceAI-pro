'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { createNotificationsForOrgMembers } from '@/features/notifications/services/notification.service';

import { inviteMemberSchema } from '../schemas/member.schemas';
import { checkMemberLimit } from '../services/member-limits.service';

export async function inviteMember(formData: FormData): Promise<ActionResult<void>> {
  try {
    const user = await requireManager();

    const raw = {
      email: formData.get('email'),
      role: formData.get('role'),
    };

    const parsed = inviteMemberSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
    }

    const supabase = await createServerSupabaseClient();

    // Get current user's org
    const { data: currentMember } = (await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()) as { data: { org_id: string } | null };

    if (!currentMember) {
      return { success: false, error: 'Organização não encontrada' };
    }

    // Check member limit
    const limit = await checkMemberLimit(supabase, currentMember.org_id);
    if (!limit.allowed) {
      return {
        success: false,
        error: `Limite de membros atingido (${limit.current}/${limit.max}). Faça upgrade do plano para adicionar mais membros.`,
        code: 'MEMBER_LIMIT_REACHED',
      };
    }

    // Check if user already a member
    const { data: existingMember } = (await supabase
      .from('organization_members')
      .select('id, status')
      .eq('org_id', currentMember.org_id)
      .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
      .single()) as { data: { id: string; status: string } | null };

    // Use signInWithOtp as invite mechanism for MVP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        data: {
          invited_to_org: currentMember.org_id,
          invited_role: parsed.data.role,
        },
      },
    });

    if (otpError) {
      return { success: false, error: otpError.message, code: otpError.code };
    }

    // Insert member record as invited (if not already exists)
    if (!existingMember) {
      // We need to insert with a placeholder user_id - will be updated on accept
      // For MVP, insert only after user actually signs up
      // Store the invite intent for now
    }

    // Notify org managers about the invite
    createNotificationsForOrgMembers({
      orgId: currentMember.org_id,
      type: 'member_invited',
      title: 'Novo membro convidado',
      body: `${parsed.data.email} foi convidado como ${parsed.data.role}`,
      resourceType: 'member',
      metadata: { email: parsed.data.email, role: parsed.data.role },
      roleFilter: 'manager',
      excludeUserId: user.id,
    }).catch((err) => console.error('Failed to create invite notification:', err));

    revalidatePath('/settings/users');
    return { success: true, data: undefined };
  } catch (error) {
    // Re-throw Next.js redirects and other non-error throws
    if (error instanceof Error && error.message?.includes('NEXT_REDIRECT')) throw error;
    console.error('Error in inviteMember:', error);
    return { success: false, error: 'Erro ao enviar convite' };
  }
}
