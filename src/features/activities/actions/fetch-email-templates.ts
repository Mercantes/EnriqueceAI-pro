'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

export interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string | null;
  body: string;
}

export async function fetchEmailTemplates(): Promise<ActionResult<EmailTemplateOption[]>> {
  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { orgId, supabase } = auth.data;

  const { data, error } = (await from(supabase, 'message_templates')
    .select('id, name, subject, body')
    .eq('org_id', orgId)
    .eq('channel', 'email')
    .order('name')) as { data: EmailTemplateOption[] | null; error: { message: string } | null };

  if (error) {
    return { success: false, error: 'Erro ao buscar templates' };
  }

  return { success: true, data: data ?? [] };
}
