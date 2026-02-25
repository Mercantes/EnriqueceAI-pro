import type { ActivityLead } from '../types';

export interface ResolvedPhone {
  formatted: string;
  raw: string;
  label: string;
  source: 'socio_whatsapp' | 'socio_celular' | 'lead_telefone';
}

function formatPhone(ddd: number, numero: string): { formatted: string; raw: string } {
  const cleaned = numero.replace(/\D/g, '');
  return {
    formatted: `(${ddd}) ${cleaned}`,
    raw: `55${ddd}${cleaned}`,
  };
}

/**
 * Extracts all phone numbers from a lead, prioritizing:
 * 1. Sócio celulares with whatsapp: true (sorted by ranking)
 * 2. Sócio celulares without whatsapp flag (sorted by ranking)
 * 3. lead.telefone as last resort
 */
export function getAllLeadPhones(lead: ActivityLead): ResolvedPhone[] {
  const phones: ResolvedPhone[] = [];
  const seen = new Set<string>();

  const whatsappPhones: Array<{ ddd: number; numero: string; ranking: number; socioNome: string }> = [];
  const otherPhones: Array<{ ddd: number; numero: string; ranking: number; socioNome: string }> = [];

  for (const socio of lead.socios ?? []) {
    for (const cel of socio.celulares ?? []) {
      if (cel.whatsapp) {
        whatsappPhones.push({ ...cel, socioNome: socio.nome });
      } else {
        otherPhones.push({ ...cel, socioNome: socio.nome });
      }
    }
  }

  // Sort by ranking (lower = better)
  whatsappPhones.sort((a, b) => a.ranking - b.ranking);
  otherPhones.sort((a, b) => a.ranking - b.ranking);

  for (const p of whatsappPhones) {
    const { formatted, raw } = formatPhone(p.ddd, p.numero);
    if (!seen.has(raw)) {
      seen.add(raw);
      phones.push({ formatted, raw, label: `${formatted} - ${p.socioNome} (WhatsApp)`, source: 'socio_whatsapp' });
    }
  }

  for (const p of otherPhones) {
    const { formatted, raw } = formatPhone(p.ddd, p.numero);
    if (!seen.has(raw)) {
      seen.add(raw);
      phones.push({ formatted, raw, label: `${formatted} - ${p.socioNome}`, source: 'socio_celular' });
    }
  }

  if (lead.telefone) {
    const cleaned = lead.telefone.replace(/\D/g, '');
    if (!seen.has(cleaned)) {
      phones.push({
        formatted: lead.telefone,
        raw: cleaned,
        label: `${lead.telefone} (Fixo empresa)`,
        source: 'lead_telefone',
      });
    }
  }

  return phones;
}

/**
 * Returns the best phone number for a lead, or null if none available.
 */
export function resolveWhatsAppPhone(lead: ActivityLead): ResolvedPhone | null {
  const phones = getAllLeadPhones(lead);
  return phones[0] ?? null;
}
