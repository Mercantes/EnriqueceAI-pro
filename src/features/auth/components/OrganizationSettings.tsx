'use client';

import { useActionState } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { updateOrganization } from '../actions/update-organization';
import type { OrganizationRow } from '../types';

type FormState = { error?: string; success?: boolean };

export function OrganizationSettings({ organization }: { organization: OrganizationRow }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await updateOrganization(formData);
      if (result.success) {
        return { success: true };
      }
      return { error: result.error };
    },
    {} as FormState,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configurações da Organização</h2>
        <p className="text-sm text-muted-foreground">Gerencie as informações da sua organização</p>
      </div>

      {state.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Organização atualizada com sucesso.
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da organização</Label>
          <Input
            id="name"
            name="name"
            defaultValue={organization.name}
            placeholder="Nome da organização"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={organization.slug} disabled />
          <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="created_at">Criada em</Label>
          <Input
            id="created_at"
            value={new Date(organization.created_at).toLocaleDateString('pt-BR')}
            disabled
          />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>
    </div>
  );
}
