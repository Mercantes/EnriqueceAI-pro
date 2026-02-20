import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { UserManagement } from '@/features/auth/components/UserManagement';
import { checkMemberLimit } from '@/features/auth/services/member-limits.service';
import type { OrganizationMemberRow } from '@/features/auth/types';

export default async function UsersPage() {
  const user = await requireManager();
  const supabase = await createServerSupabaseClient();

  // Get current user's org
  const { data: currentMember } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!currentMember) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Organização não encontrada.</p>
      </div>
    );
  }

  const { data: members } = (await supabase
    .from('organization_members')
    .select('*')
    .eq('org_id', currentMember.org_id)
    .order('created_at', { ascending: true })) as { data: OrganizationMemberRow[] | null };

  const { data: org } = (await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', currentMember.org_id)
    .single()) as { data: { owner_id: string } | null };

  const limit = await checkMemberLimit(supabase, currentMember.org_id);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Gestão de Usuários</h1>
      <UserManagement
        members={members ?? []}
        ownerId={org?.owner_id ?? ''}
        currentUserId={user.id}
        memberCount={limit.current}
        memberMax={limit.max}
      />
    </div>
  );
}
