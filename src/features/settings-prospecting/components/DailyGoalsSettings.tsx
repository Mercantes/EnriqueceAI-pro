'use client';

import { useState, useTransition } from 'react';

import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

import type { DailyGoalsData, MemberGoal } from '../actions/get-daily-goals';
import { saveDailyGoals } from '../actions/save-daily-goals';

interface DailyGoalsSettingsProps {
  initial: DailyGoalsData;
}

export function DailyGoalsSettings({ initial }: DailyGoalsSettingsProps) {
  const [orgDefault, setOrgDefault] = useState(initial.orgDefault);
  const [memberGoals, setMemberGoals] = useState<MemberGoal[]>(initial.members);
  const [isPending, startTransition] = useTransition();

  function updateMemberTarget(userId: string, value: string) {
    setMemberGoals((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? { ...m, target: value === '' ? null : Math.max(0, parseInt(value, 10) || 0) }
          : m,
      ),
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveDailyGoals({
        orgDefault,
        memberGoals: memberGoals.map((m) => ({
          userId: m.userId,
          target: m.target,
        })),
      });

      if (result.success) {
        toast.success('Metas salvas com sucesso!');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Atividades Diárias</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Configure a meta diária de atividades para a organização e para cada vendedor individualmente.
        </p>
      </div>

      {/* Org default */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <label className="block text-sm font-medium mb-2">
          Meta padrão da organização
        </label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            value={orgDefault}
            onChange={(e) => setOrgDefault(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-24"
          />
          <span className="text-sm text-[var(--muted-foreground)]">
            atividades por dia
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Vendedores sem meta individual usarão este valor.
        </p>
      </div>

      {/* Members table */}
      {memberGoals.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[var(--muted)]/50">
                <th className="p-3 text-left text-sm font-medium">Vendedor</th>
                <th className="p-3 text-left text-sm font-medium">Role</th>
                <th className="p-3 text-left text-sm font-medium">Meta Individual</th>
              </tr>
            </thead>
            <tbody>
              {memberGoals.map((member) => (
                <tr key={member.userId} className="border-b last:border-0">
                  <td className="p-3 text-sm">{member.name}</td>
                  <td className="p-3 text-sm text-[var(--muted-foreground)]">
                    {member.role === 'manager' ? 'Manager' : 'SDR'}
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      placeholder={String(orgDefault)}
                      value={member.target ?? ''}
                      onChange={(e) => updateMemberTarget(member.userId, e.target.value)}
                      className="w-24"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {memberGoals.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Nenhum membro ativo na organização.
        </p>
      )}

      <Button onClick={handleSave} disabled={isPending}>
        <Save className="mr-2 h-4 w-4" />
        {isPending ? 'Salvando...' : 'Salvar Metas'}
      </Button>
    </div>
  );
}
