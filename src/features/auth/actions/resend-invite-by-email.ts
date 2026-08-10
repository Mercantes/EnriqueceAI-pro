'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import type { ActionResult } from '@/lib/actions/action-result';
import { ERR_RATE_LIMITED } from '@/lib/constants/error-codes';
import { INVITE_EXPIRY_DAYS, RESEND_LIMIT, RESEND_WINDOW_MS } from '@/lib/constants/limits';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { from } from '@/lib/supabase/from';
import { getAppUrl } from '@/lib/utils/app-url';

import { findPendingInviteByEmail } from '../services/pending-invite';

const emailSchema = z.string().email();

/**
 * Reenvia o convite de um membro a partir do e-mail, SEM exigir sessão de manager.
 *
 * Usado na tela de login quando o usuário tenta entrar com uma conta ainda em
 * status 'invited'. Diferente de `resendInvite(memberId)` (que é acionado pelo
 * gestor em Configurações › Usuários), esta ação é pública, então:
 *  - é limitada por IP (RESEND_LIMIT / RESEND_WINDOW_MS);
 *  - só age se existir de fato um convite pendente para o e-mail;
 *  - retorna sempre a mesma mensagem neutra, para não revelar se um e-mail
 *    está ou não cadastrado (proteção contra enumeração de usuários).
 */
export async function resendInviteByEmail(email: string): Promise<ActionResult<void>> {
  try {
    const headerStore = await headers();
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    const rateCheck = await checkRateLimit(`resend-invite:${ip}`, RESEND_LIMIT, RESEND_WINDOW_MS);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000);
      return {
        success: false,
        error: `Muitas tentativas. Tente novamente em ${retryMinutes} minuto(s).`,
        code: ERR_RATE_LIMITED,
      };
    }

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      // Não revela nada além de validação de formato.
      return { success: true, data: undefined };
    }

    const invite = await findPendingInviteByEmail(parsed.data);
    if (!invite) {
      // E-mail sem convite pendente (inexistente, já ativo, etc.) — resposta neutra.
      return { success: true, data: undefined };
    }

    const admin = createAdminSupabaseClient();

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data, {
      redirectTo: `${getAppUrl()}/api/auth/confirm`,
    });
    if (inviteError) {
      console.error('[resendInviteByEmail] invite error:', inviteError.message);
      return { success: false, error: 'Não foi possível reenviar o convite agora.' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    await from(admin, 'organization_members')
      .update({ invited_expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', invite.memberId);

    return { success: true, data: undefined };
  } catch (error) {
    console.error('[resendInviteByEmail] Unhandled error:', error);
    // Mesmo em erro inesperado, não vaza estado da conta.
    return { success: true, data: undefined };
  }
}
