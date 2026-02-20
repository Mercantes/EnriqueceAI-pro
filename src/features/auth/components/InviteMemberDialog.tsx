'use client';

import { useActionState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { inviteMember } from '../actions/invite-member';

type FormState = { error?: string; success?: boolean; code?: string };

export function InviteMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await inviteMember(formData);
      if (result.success) {
        return { success: true };
      }
      return { error: result.error, code: result.code };
    },
    {} as FormState,
  );

  const isLimitReached = state.code === 'MEMBER_LIMIT_REACHED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>Envie um convite por email para adicionar um novo membro.</DialogDescription>
        </DialogHeader>

        {state.success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Convite enviado com sucesso!
          </div>
        )}

        {isLimitReached && (
          <div className="space-y-3 rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">{state.error}</p>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings/billing">Ver planos</a>
            </Button>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="membro@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              name="role"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue="sdr"
            >
              <option value="sdr">SDR (Vendedor)</option>
              <option value="manager">Manager (Gerente)</option>
            </select>
          </div>

          {state.error && !isLimitReached && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
