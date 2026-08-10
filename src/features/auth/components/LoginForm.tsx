'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ERR_INVITE_PENDING } from '@/lib/constants/error-codes';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { resendInviteByEmail } from '../actions/resend-invite-by-email';
import { signIn } from '../actions/sign-in';

const HASH_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'O link expirou. Faça login com seu email e senha.',
  access_denied: 'Acesso negado. Faça login com seu email e senha.',
};

type LoginState = { error?: string; code?: string };

export function LoginForm({ error: initialError }: { error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);
  const [resending, startResend] = useTransition();

  const [hashError] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const hash = window.location.hash;
    if (!hash || !hash.includes('error')) return undefined;

    const params = new URLSearchParams(hash.replace('#', ''));
    const errorCode = params.get('error_code') || params.get('error');

    if (errorCode && HASH_ERROR_MESSAGES[errorCode]) {
      return HASH_ERROR_MESSAGES[errorCode];
    } else if (errorCode) {
      return 'Erro na autenticação. Faça login com seu email e senha.';
    }
    return undefined;
  });

  // Clean the hash from URL after reading it
  useEffect(() => {
    if (hashError) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [hashError]);

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    async (_prev, formData) => {
      const result = await signIn(formData);
      if (result.success) {
        router.push('/dashboard');
        return {};
      }
      return { error: result.error, code: result.code };
    },
    { error: initialError },
  );

  const invitePending = state.code === ERR_INVITE_PENDING;
  const displayError = !invitePending ? state.error || hashError : undefined;

  function handleResend() {
    if (!email) return;
    startResend(async () => {
      await resendInviteByEmail(email);
      setResent(true);
    });
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="text-muted-foreground">Acesse sua conta</p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="seu@email.com"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setResent(false);
            }}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <Input id="password" name="password" type="password" required />
        </div>

        {displayError && <p className="text-sm text-destructive">{displayError}</p>}

        {invitePending && (
          <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="text-foreground">
              {state.error ??
                'Você tem um convite pendente. Verifique seu e-mail para criar sua senha e ativar o acesso.'}
            </p>
            {resent ? (
              <p className="text-muted-foreground">
                Se houver um convite pendente para <span className="font-medium">{email}</span>,
                reenviamos o link. Confira também a caixa de spam.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending || !email}
              >
                {resending ? 'Reenviando...' : 'Reenviar convite'}
              </Button>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
