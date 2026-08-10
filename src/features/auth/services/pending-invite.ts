import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export interface PendingInvite {
  memberId: string;
  userId: string;
}

/**
 * Descobre se existe um convite pendente (organization_members.status = 'invited')
 * para o e-mail informado, cruzando com auth.users via a função
 * `find_pending_invite_by_email` (SECURITY DEFINER, restrita ao service_role).
 *
 * Usado no login para transformar o genérico "credenciais inválidas" em uma
 * orientação para o usuário aceitar o convite, e no reenvio público de convite.
 *
 * Nunca lança: qualquer falha (admin client indisponível, RPC ausente) retorna
 * null — o chamador segue com o comportamento padrão.
 */
export async function findPendingInviteByEmail(email: string): Promise<PendingInvite | null> {
  const normalized = email.trim();
  if (!normalized) return null;

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc('find_pending_invite_by_email', {
      p_email: normalized,
    });

    if (error || !data) return null;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.member_id || !row?.user_id) return null;

    return { memberId: row.member_id as string, userId: row.user_id as string };
  } catch {
    return null;
  }
}
