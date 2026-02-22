'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio, UserRound } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import { createLead } from '../actions/create-lead';
import { fetchActiveCadences } from '../actions/fetch-active-cadences';
import { fetchOrgMembersAuth, type OrgMemberOption } from '../actions/fetch-org-members';

interface ActiveCadence {
  id: string;
  name: string;
  total_steps: number;
}

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

const INITIAL_FORM = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  email: '',
  telefone: '',
  assigned_to: '',
  cadence_id: '',
  enrollment_mode: 'immediate' as 'immediate' | 'paused',
};

export function CreateLeadDialog({ open, onOpenChange, currentUserId }: CreateLeadDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ ...INITIAL_FORM, assigned_to: currentUserId });

  // Data loading states
  const [members, setMembers] = useState<OrgMemberOption[]>([]);
  const [cadences, setCadences] = useState<ActiveCadence[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isLoading = open && !loaded;

  // Load members and cadences when dialog opens
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;

    Promise.all([fetchOrgMembersAuth(), fetchActiveCadences()]).then(
      ([membersResult, cadencesResult]) => {
        if (cancelled) return;
        if (membersResult.success) setMembers(membersResult.data);
        if (cadencesResult.success) setCadences(cadencesResult.data);
        setLoaded(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM, assigned_to: currentUserId });
  }, [currentUserId]);

  function handleOpenChange(value: boolean) {
    if (!value) resetForm();
    onOpenChange(value);
  }

  const hasCadence = form.cadence_id !== '';
  const isFormValid = form.cnpj.trim() !== '' && form.assigned_to !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createLead({
        cnpj: form.cnpj,
        razao_social: form.razao_social || undefined,
        nome_fantasia: form.nome_fantasia || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        assigned_to: form.assigned_to,
        cadence_id: form.cadence_id || undefined,
        enrollment_mode: form.enrollment_mode,
      });

      if (result.success) {
        toast.success('Lead criado com sucesso');
        handleOpenChange(false);
        router.push(`/leads/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Lead</DialogTitle>
          <DialogDescription>
            Preencha os dados do lead e configure a entrada na cadência.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: CONFIGURAÇÕES DE ENTRADA */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Configurações de Entrada
              </h3>
              <div className="space-y-4">
                {/* Modo de início */}
                <div className="space-y-3">
                  <RadioGroup
                    value={form.enrollment_mode}
                    onValueChange={(v) =>
                      setForm({ ...form, enrollment_mode: v as 'immediate' | 'paused' })
                    }
                    className={!hasCadence ? 'opacity-50 pointer-events-none' : ''}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                      <label
                        htmlFor="mode-immediate"
                        className="flex cursor-pointer items-start gap-3"
                      >
                        <RadioGroupItem value="immediate" id="mode-immediate" className="mt-0.5" />
                        <div>
                          <span className="text-sm font-medium">Início imediato</span>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Disponibilizar a execução do lead imediatamente.
                          </p>
                        </div>
                      </label>
                      <label
                        htmlFor="mode-paused"
                        className="flex cursor-pointer items-start gap-3"
                      >
                        <RadioGroupItem value="paused" id="mode-paused" className="mt-0.5" />
                        <div>
                          <span className="text-sm font-medium">Aguardar início</span>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            O vendedor receberá esse lead ao iniciar a prospecção.
                          </p>
                        </div>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Responsável + Cadência */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <UserRound className="h-4 w-4 text-[var(--muted-foreground)]" />
                      Responsável <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.assigned_to}
                      onValueChange={(v) => setForm({ ...form, assigned_to: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Radio className="h-4 w-4 text-[var(--muted-foreground)]" />
                      Cadência
                    </Label>
                    <Select
                      value={form.cadence_id || 'none'}
                      onValueChange={(v) =>
                        setForm({ ...form, cadence_id: v === 'none' ? '' : v })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sem cadência (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cadência</SelectItem>
                        {cadences.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.total_steps} {c.total_steps === 1 ? 'passo' : 'passos'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* SECTION 2: INFORMAÇÕES DO LEAD */}
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Informações do Lead
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="create-cnpj">
                    CNPJ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="create-razao">Razão Social</Label>
                  <Input
                    id="create-razao"
                    value={form.razao_social}
                    onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="create-fantasia">Nome Fantasia</Label>
                  <Input
                    id="create-fantasia"
                    value={form.nome_fantasia}
                    onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="create-telefone">Telefone</Label>
                  <Input
                    id="create-telefone"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !isFormValid}>
                {isPending ? 'Criando...' : 'Criar Lead'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
