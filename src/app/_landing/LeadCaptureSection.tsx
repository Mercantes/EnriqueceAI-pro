'use client';

import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

import { submitLandingLead } from './submit-landing-lead';

const employeeOptions = [
  '1 a 10',
  '11 a 50',
  '51 a 200',
  '201 a 500',
  '501 a 1000',
  'Mais de 1000',
];

const roleOptions = [
  'CEO / Fundador',
  'VP de Vendas',
  'Diretor(a) de Vendas',
  'Gerente de Vendas',
  'Head de Vendas / Pré-vendas',
  'Coordenador(a)',
  'Analista',
  'Outro',
];

const sdrOptions = [
  'Ainda não tenho',
  '1 a 2',
  '3 a 5',
  '6 a 10',
  '11 a 20',
  'Mais de 20',
];

const crmOptions = [
  'HubSpot',
  'Pipedrive',
  'RD Station CRM',
  'Salesforce',
  'Zoho',
  'Outro',
  'Não utilizo CRM',
];

const inputClasses =
  'w-full rounded-full bg-white px-5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-white/50';

const selectClasses =
  'w-full appearance-none rounded-full bg-white px-5 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-white/50';

function RequiredMark() {
  return <span className="text-red-300">*</span>;
}

export function LeadCaptureSection() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const result = await submitLandingLead(payload);

    setLoading(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  }

  if (submitted) {
    return (
      <section id="cadastro" className="bg-primary py-24 text-white">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Obrigado pelo interesse!
          </h2>
          <p className="mt-4 text-lg opacity-80">
            Recebemos seus dados e entraremos em contato em breve.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="cadastro" className="bg-primary py-24 text-white">
      <div className="mx-auto max-w-xl px-6">
        <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Preencha o formulário para receber nosso contato:
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Digite seu nome
              <RequiredMark />
            </label>
            <input
              type="text"
              name="name"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Empresa
              <RequiredMark />
            </label>
            <input
              type="text"
              name="company"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Email de trabalho
              <RequiredMark />
            </label>
            <input
              type="email"
              name="email"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Digite seu telefone
              <RequiredMark />
            </label>
            <input
              type="tel"
              name="phone"
              required
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Site da empresa
              <RequiredMark />
            </label>
            <input
              type="url"
              name="website"
              required
              placeholder="https://"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Total de funcionários na empresa
              <RequiredMark />
            </label>
            <div className="relative">
              <select name="employees" required className={selectClasses} defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {employeeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Qual é o seu cargo?
              <RequiredMark />
            </label>
            <div className="relative">
              <select name="role" required className={selectClasses} defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {roleOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Número de SDRs/BDRs
              <RequiredMark />
            </label>
            <div className="relative">
              <select name="sdr_count" required className={selectClasses} defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {sdrOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Qual CRM sua empresa utiliza atualmente?
              <RequiredMark />
            </label>
            <div className="relative">
              <select name="crm" required className={selectClasses} defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {crmOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-white/20 px-4 py-2 text-center text-sm font-medium">
              {error}
            </p>
          )}

          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full rounded-full bg-white text-primary font-semibold hover:bg-white/90 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Quero ser contatado'
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
