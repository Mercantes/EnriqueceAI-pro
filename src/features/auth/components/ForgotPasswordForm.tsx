'use client';

import { useActionState } from 'react';

import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { resetPassword } from '../actions/reset-password';

type FormState = { error?: string; success?: boolean };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await resetPassword(formData);
      if (result.success) {
        return { success: true };
      }
      return { error: result.error };
    },
    {} as FormState,
  );

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <p className="text-muted-foreground">
          Informe seu email para receber o link de recuperação
        </p>
      </div>

      {state.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Link de recuperação enviado! Verifique seu email.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="seu@email.com" required />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Enviando...' : 'Enviar link de recuperação'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
