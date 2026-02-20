'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';

import { enrollLeads } from '../actions/manage-cadences';
import { fetchAvailableLeads } from '../actions/manage-enrollments';

interface EnrollLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cadenceId: string;
}

interface AvailableLead {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
}

export function EnrollLeadsDialog({ open, onOpenChange, cadenceId }: EnrollLeadsDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<AvailableLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setLeads([]);
      setSelected(new Set());
      return;
    }
    loadLeads('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => loadLeads(search), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function loadLeads(query: string) {
    setLoading(true);
    const result = await fetchAvailableLeads(cadenceId, query, 30);
    if (result.success) {
      setLeads(result.data);
    }
    setLoading(false);
  }

  function toggleLead(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

  function handleEnroll() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await enrollLeads(cadenceId, Array.from(selected));
      if (result.success) {
        toast.success(`${result.data.enrolled} lead(s) inscrito(s) com sucesso`);
        if (result.data.errors.length > 0) {
          toast.warning(`${result.data.errors.length} erro(s) ao inscrever`);
        }
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inscrever Leads na Cadência
          </DialogTitle>
          <DialogDescription>
            Selecione os leads que deseja inscrever nesta cadência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              placeholder="Buscar por nome, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border">
            {loading ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                Buscando leads...
              </p>
            ) : leads.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                Nenhum lead disponível encontrado.
              </p>
            ) : (
              <div className="divide-y">
                {leads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--muted)]"
                  >
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {lead.cnpj}{lead.email ? ` — ${lead.email}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              {selected.size} lead(s) selecionado(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleEnroll} disabled={isPending || selected.size === 0}>
            {isPending ? 'Inscrevendo...' : `Inscrever ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
