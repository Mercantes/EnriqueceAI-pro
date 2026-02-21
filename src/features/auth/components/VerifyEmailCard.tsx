'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Mail } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

import { resendVerification } from '../actions/resend-verification';

export function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleResend() {
    if (!email) return;
    setMessage(null);
    startTransition(async () => {
      const result = await resendVerification(email);
      if (result.success) {
        setMessage({ type: 'success', text: 'Email reenviado! Verifique sua caixa de entrada.' });
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Erro ao reenviar email.' });
      }
    });
  }

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Verifique seu email</h1>
        <p className="text-muted-foreground">
          Enviamos um link de confirmação para{' '}
          {email ? <strong>{email}</strong> : 'seu email'}.
          Clique no link para ativar sua conta.
        </p>
      </div>

      <div className="space-y-3">
        {email && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={isPending}
          >
            {isPending ? 'Reenviando...' : 'Reenviar email de verificação'}
          </Button>
        )}

        {message && (
          <p
            className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-destructive'}`}
          >
            {message.text}
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Não recebeu? Verifique sua pasta de spam ou{' '}
        <Link href="/signup" className="text-primary hover:underline">
          tente outro email
        </Link>
        .
      </p>

      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
