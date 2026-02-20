import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { OrganizationSettings } from '@/features/auth/components/OrganizationSettings';
import type { MemberWithOrganization } from '@/features/auth/types';

export default async function SettingsPage() {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: MemberWithOrganization | null };

  if (!member?.organization) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Organização não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Configurações</h1>
      <OrganizationSettings organization={member.organization} />
    </div>
  );
}
