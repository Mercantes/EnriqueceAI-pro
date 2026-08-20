'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Copy, Plus, Star, Trash2, Pencil, Save, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { normalizePhone } from '@/lib/utils/phone';

import type { LeadContact, LeadEmail, LeadPhone, LeadSocio } from '../types';
import {
  listLeadContacts,
  upsertLeadContact,
  deleteLeadContact,
  setPrimaryLeadContact,
} from '../actions/lead-contacts';

/** Mirror pushed up to the panel so header/dialer reflect the new primary. */
export interface PrimaryContactMirror {
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  telefone: string | null;
  emails: LeadEmail[];
  phones: LeadPhone[];
}

interface DraftForm {
  first_name: string;
  last_name: string;
  job_title: string;
  emails: LeadEmail[];
  phones: LeadPhone[];
}

const EMPTY_DRAFT: DraftForm = {
  first_name: '',
  last_name: '',
  job_title: '',
  emails: [{ tipo: 'corporativo', email: '' }],
  phones: [{ tipo: 'celular', numero: '' }],
};

function contactToDraft(c: LeadContact): DraftForm {
  return {
    first_name: c.first_name ?? '',
    last_name: c.last_name ?? '',
    job_title: c.job_title ?? '',
    emails: c.emails.length > 0 ? c.emails.map((e) => ({ ...e })) : [{ tipo: 'corporativo', email: '' }],
    phones: c.phones.length > 0 ? c.phones.map((p) => ({ ...p })) : [{ tipo: 'celular', numero: '' }],
  };
}

function computeMirror(contacts: LeadContact[]): PrimaryContactMirror {
  const primary = contacts.find((c) => c.is_primary) ?? contacts[0];
  if (!primary) {
    return { first_name: null, last_name: null, job_title: null, email: null, telefone: null, emails: [], phones: [] };
  }
  const email = primary.emails.find((e) => (e.email ?? '').trim() !== '')?.email ?? null;
  const telefone = primary.phones.find((p) => (p.numero ?? '').trim() !== '')?.numero ?? null;
  return {
    first_name: primary.first_name,
    last_name: primary.last_name,
    job_title: primary.job_title,
    email,
    telefone,
    emails: primary.emails,
    phones: primary.phones,
  };
}

const PHONE_LABEL: Record<LeadPhone['tipo'], string> = {
  celular: 'Celular',
  fixo: 'Fixo',
  whatsapp: 'WhatsApp',
};

export interface LeadContactsSectionProps {
  leadId: string;
  socios?: LeadSocio[] | null;
  onPrimaryChange?: (mirror: PrimaryContactMirror) => void;
}

export function LeadContactsSection({ leadId, socios, onPrimaryChange }: LeadContactsSectionProps) {
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [loading, setLoading] = useState(true);
  // editingId: a contact id being edited, 'new' for the add form, or null.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();

  // emitMirror=false on the initial load: the panel's data already matches the
  // DB, so there's no need to push the mirror up (which would fire a spurious
  // 'lead:updated'). Mutations pass true so the header/dialer follow the change.
  const refresh = useCallback(async (emitMirror: boolean) => {
    const result = await listLeadContacts(leadId);
    if (result.success) {
      setContacts(result.data);
      if (emitMirror) onPrimaryChange?.(computeMirror(result.data));
    }
  }, [leadId, onPrimaryChange]);

  // Fetch on mount and whenever the lead changes. setState lives inside the
  // async IIFE (not the effect body) so we don't trigger cascading renders.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setEditingId(null);
      await refresh(false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const startEdit = (c: LeadContact) => {
    setDraft(contactToDraft(c));
    setEditingId(c.id);
  };
  const startAdd = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId('new');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertLeadContact({
        id: editingId && editingId !== 'new' ? editingId : undefined,
        leadId,
        first_name: draft.first_name,
        last_name: draft.last_name,
        job_title: draft.job_title,
        emails: draft.emails,
        phones: draft.phones,
      });
      if (result.success) {
        toast.success(editingId === 'new' ? 'Contato adicionado' : 'Contato atualizado');
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
        await refresh(true);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (c: LeadContact) => {
    startTransition(async () => {
      const result = await deleteLeadContact(c.id);
      if (result.success) {
        toast.success('Contato removido');
        await refresh(true);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSetPrimary = (c: LeadContact) => {
    startTransition(async () => {
      const result = await setPrimaryLeadContact(c.id);
      if (result.success) {
        toast.success('Contato principal definido');
        await refresh(true);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Copiado!'),
      () => toast.error('Não foi possível copiar'),
    );
  };

  // Enriched socio phones (read-only) — kept as a reference the SDR can promote
  // manually to a real contact. Not persisted; auto-derived from the CNPJ.
  const sociosPhones: Array<{ nome: string; numero: string; href: string; whatsapp: boolean }> = [];
  {
    const seen = new Set<string>();
    for (const socio of socios ?? []) {
      for (const cel of socio.celulares ?? []) {
        const formatted = `(${cel.ddd}) ${cel.numero}`;
        const key = normalizePhone(formatted);
        if (seen.has(key)) continue;
        seen.add(key);
        sociosPhones.push({
          nome: socio.nome ?? '',
          numero: formatted,
          href: `tel:+55${cel.ddd}${cel.numero}`,
          whatsapp: !!cel.whatsapp,
        });
      }
    }
  }

  const renderEditForm = () => (
    <div className="space-y-2.5 rounded-md border border-[var(--primary)]/40 bg-[var(--muted)]/30 p-3">
      <div className="flex gap-1.5">
        <div className="flex-1 space-y-1">
          <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Primeiro nome</p>
          <Input
            value={draft.first_name}
            onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
            className="h-8 text-sm"
            placeholder="Nome"
          />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Sobrenome</p>
          <Input
            value={draft.last_name}
            onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
            className="h-8 text-sm"
            placeholder="Sobrenome"
          />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Cargo / posição</p>
        <Input
          value={draft.job_title}
          onChange={(e) => setDraft({ ...draft, job_title: e.target.value })}
          className="h-8 text-sm"
          placeholder="Ex.: Sócio proprietário, Responsável de Marketing"
        />
      </div>

      {/* E-mails do contato */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] dark:text-[var(--foreground)]">E-mail(s)</p>
        {draft.emails.map((entry, index) => (
          <div key={`c-email-${index}`} className="flex items-end gap-1.5">
            <div className="w-[100px] shrink-0">
              <Select
                value={entry.tipo}
                onValueChange={(val) =>
                  setDraft((d) => ({
                    ...d,
                    emails: d.emails.map((e, i) => (i === index ? { ...e, tipo: val as LeadEmail['tipo'] } : e)),
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporativo">Corporativo</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              value={entry.email}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  emails: d.emails.map((em, i) => (i === index ? { ...em, email: e.target.value } : em)),
                }))
              }
              className="h-8 min-w-0 flex-1 text-sm"
              placeholder="email@empresa.com"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover e-mail"
              className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-red-500"
              onClick={() => setDraft((d) => ({ ...d, emails: d.emails.filter((_, i) => i !== index) }))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-[var(--primary)]"
          onClick={() => setDraft((d) => ({ ...d, emails: [...d.emails, { tipo: 'corporativo', email: '' }] }))}
        >
          <Plus className="mr-1 h-3 w-3" />
          Adicionar e-mail
        </Button>
      </div>

      {/* Telefones do contato */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Telefone(s)</p>
        {draft.phones.map((entry, index) => (
          <div key={`c-phone-${index}`} className="flex items-end gap-1.5">
            <div className="w-[100px] shrink-0">
              <Select
                value={entry.tipo}
                onValueChange={(val) =>
                  setDraft((d) => ({
                    ...d,
                    phones: d.phones.map((p, i) => (i === index ? { ...p, tipo: val as LeadPhone['tipo'] } : p)),
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celular">Celular</SelectItem>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              value={entry.numero}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  phones: d.phones.map((p, i) => (i === index ? { ...p, numero: e.target.value } : p)),
                }))
              }
              className="h-8 min-w-0 flex-1 text-sm"
              placeholder="(11) 99000-0000"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover telefone"
              className="h-8 w-8 shrink-0 text-[var(--muted-foreground)] hover:text-red-500"
              onClick={() => setDraft((d) => ({ ...d, phones: d.phones.filter((_, i) => i !== index) }))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-[var(--primary)]"
          onClick={() => setDraft((d) => ({ ...d, phones: [...d.phones, { tipo: 'celular', numero: '' }] }))}
        >
          <Plus className="mr-1 h-3 w-3" />
          Adicionar telefone
        </Button>
      </div>

      <div className="flex justify-end gap-1.5 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={isPending}>
          <X className="mr-1 h-3 w-3" />
          Cancelar
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isPending}>
          <Save className="mr-1 h-3 w-3" />
          Salvar
        </Button>
      </div>
    </div>
  );

  const renderCard = (c: LeadContact) => {
    if (editingId === c.id) return <div key={c.id}>{renderEditForm()}</div>;
    const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
    const validEmails = c.emails.filter((e) => (e.email ?? '').trim() !== '');
    const validPhones = c.phones.filter((p) => (p.numero ?? '').trim() !== '');
    return (
      <div key={c.id} className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{name || 'Contato sem nome'}</p>
              {c.is_primary && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Principal
                </span>
              )}
            </div>
            {c.job_title && (
              <p className="truncate text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">{c.job_title}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Editar contato"
              className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              onClick={() => startEdit(c)}
              disabled={isPending}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover contato"
              className="h-7 w-7 text-[var(--muted-foreground)] hover:text-red-500"
              onClick={() => handleDelete(c)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {validEmails.length > 0 && (
          <div className="space-y-1">
            {validEmails.map((em, i) => (
              <div key={`em-${i}`} className="flex items-center gap-1.5 rounded bg-[var(--muted)] px-2 py-1 text-base">
                <span className="shrink-0 rounded bg-[var(--background)] px-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                  {em.tipo === 'pessoal' ? 'Pessoal' : 'Corp.'}
                </span>
                <a href={`mailto:${em.email}`} className="min-w-0 flex-1 truncate text-[var(--primary)] hover:underline">
                  {em.email}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(em.email)}
                  className="shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  title="Copiar e-mail"
                  aria-label="Copiar e-mail"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {validPhones.length > 0 && (
          <div className="space-y-1">
            {validPhones.map((ph, i) => (
              <div key={`ph-${i}`} className="flex items-center gap-1.5 rounded bg-[var(--muted)] px-2 py-1 text-base">
                <span className="shrink-0 rounded bg-[var(--background)] px-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                  {PHONE_LABEL[ph.tipo]}
                </span>
                <a href={`tel:${ph.numero}`} className="min-w-0 flex-1 truncate text-[var(--primary)] hover:underline">
                  {ph.numero}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(ph.numero)}
                  className="shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  title="Copiar telefone"
                  aria-label="Copiar telefone"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!c.is_primary && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-full justify-center text-[11px] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
            onClick={() => handleSetPrimary(c)}
            disabled={isPending}
          >
            <Star className="mr-1 h-3 w-3" />
            Tornar principal
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Carregando contatos…</p>;
  }

  return (
    <div className="space-y-2">
      {contacts.length === 0 && editingId !== 'new' && (
        <p className="text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">Nenhum contato cadastrado.</p>
      )}

      {contacts.map(renderCard)}

      {editingId === 'new' && renderEditForm()}

      {editingId !== 'new' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center gap-1.5 text-xs"
          onClick={startAdd}
          disabled={isPending}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar contato
        </Button>
      )}

      {/* Telefones dos sócios (enriquecidos do CNPJ) — só leitura, referência. */}
      {sociosPhones.length > 0 && (
        <details className="mt-1 border-t border-[var(--border)] pt-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] dark:text-[var(--foreground)]">
            Telefones dos sócios (enriquecido) · {sociosPhones.length}
          </summary>
          <div className="mt-2 space-y-1.5">
            {sociosPhones.map((p, i) => (
              <div key={`socio-phone-${i}`} className="flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-3 py-1.5 text-base">
                <a href={p.href} className="shrink-0 text-[var(--primary)] hover:underline">{p.numero}</a>
                {p.whatsapp && (
                  <span className="shrink-0 rounded bg-green-100 px-1 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-400">WhatsApp</span>
                )}
                {p.nome && (
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)] dark:text-[var(--foreground)]">· {p.nome}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(p.numero)}
                  className="ml-auto shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  title="Copiar telefone"
                  aria-label="Copiar telefone"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
