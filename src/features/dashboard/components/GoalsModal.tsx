'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { getGoals } from '../actions/get-goals';
import { saveGoals } from '../actions/save-goals';
import type { UserGoalRow } from '../types';

interface GoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string; // YYYY-MM
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function computeEstimate(
  opportunityTarget: number,
  conversionTarget: number,
  numSdrs: number,
) {
  if (conversionTarget <= 0 || numSdrs <= 0) return null;
  const leadsNeeded = Math.ceil(opportunityTarget / (conversionTarget / 100));
  const avgActivitiesPerLead = 8;
  const businessDays = 22;
  const activitiesPerDay = Math.ceil(
    (leadsNeeded * avgActivitiesPerLead) / businessDays / numSdrs,
  );
  return { leadsNeeded, activitiesPerDay };
}

export function GoalsModal({ open, onOpenChange, month }: GoalsModalProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [opportunityTarget, setOpportunityTarget] = useState(0);
  const [conversionTarget, setConversionTarget] = useState(0);
  const [userGoals, setUserGoals] = useState<UserGoalRow[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch-on-open pattern */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getGoals(month).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setOpportunityTarget(result.data.opportunityTarget);
        setConversionTarget(result.data.conversionTarget);
        setUserGoals(result.data.userGoals);
      } else {
        toast.error(result.error);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, month]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function updateUserGoal(userId: string, value: number) {
    setUserGoals((prev) =>
      prev.map((ug) => (ug.userId === userId ? { ...ug, opportunityTarget: value } : ug)),
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveGoals({
        month,
        opportunityTarget,
        conversionTarget,
        userGoals: userGoals.map((ug) => ({
          userId: ug.userId,
          opportunityTarget: ug.opportunityTarget,
        })),
      });

      if (result.success) {
        toast.success('Metas salvas com sucesso');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const estimate = computeEstimate(opportunityTarget, conversionTarget, userGoals.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas {formatMonthLabel(month)}
          </DialogTitle>
          <DialogDescription>
            Defina as metas mensais da equipe de vendas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Org-level goals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opportunity-target">Meta de Oportunidades</Label>
                <Input
                  id="opportunity-target"
                  type="number"
                  min={0}
                  value={opportunityTarget}
                  onChange={(e) => setOpportunityTarget(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion-target">Taxa de Conversão (%)</Label>
                <Input
                  id="conversion-target"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={conversionTarget}
                  onChange={(e) => setConversionTarget(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Effort estimate */}
            {estimate && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Será necessário finalizar <strong>{estimate.leadsNeeded} leads</strong> e
                realizar <strong>{estimate.activitiesPerDay} atividades diárias</strong> por
                vendedor.
              </div>
            )}

            {/* Per-user goals */}
            {userGoals.length > 0 && (
              <div className="space-y-3">
                <Label>Metas por vendedor</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {userGoals.map((ug) => (
                    <div
                      key={ug.userId}
                      className="flex items-center gap-3 rounded-md border p-2"
                    >
                      <span className="flex-1 text-sm font-medium">{ug.userName}</span>
                      {ug.previousTarget !== null && (
                        <span className="text-xs text-muted-foreground">
                          Anterior: {ug.previousTarget}
                        </span>
                      )}
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        value={ug.opportunityTarget}
                        onChange={(e) =>
                          updateUserGoal(ug.userId, Number(e.target.value) || 0)
                        }
                        aria-label={`Meta de ${ug.userName}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || loading}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
