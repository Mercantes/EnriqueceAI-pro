import { Building2, Linkedin, Mail, MessageSquare, Phone, Search } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

const timelineSteps = [
  { day: 'Dia 01', icons: [Search, Building2] },
  { day: 'Dia 02', icons: [Phone, Mail] },
  { day: 'Dia 05', icons: [MessageSquare] },
  { day: 'Dia 10', icons: [Linkedin] },
  { day: 'Dia 15', icons: [MessageSquare, Mail] },
];

const funnelLayers = [
  {
    label: 'Automação de Marketing',
    description: 'Geração de demanda e nutrição de leads',
    highlight: false,
    width: 'w-full',
  },
  {
    label: 'Sales Engagement',
    description: 'Prospecção e qualificação através de cadências',
    highlight: true,
    width: 'w-[82%]',
  },
  {
    label: 'CRM',
    description: 'Reuniões de diagnóstico, demonstrações e negociações',
    highlight: false,
    width: 'w-[64%]',
  },
];

export function SalesEngagementSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Part 1 — What is Sales Engagement */}
        <div className="mb-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            O que é Sales Engagement?
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[var(--muted-foreground)]">
            O método utiliza cadências personalizadas que combinam pesquisa, ligação, e-mail,
            WhatsApp e social-point. Esse é o segredo dos pré-vendedores top performers do mercado
            que executam, em média, <strong className="text-[var(--foreground)]">96 atividades</strong>{' '}
            de prospecção em modo rápido, diariamente.
          </p>

          {/* Timeline */}
          <div className="mt-14 flex items-center justify-center gap-0 overflow-x-auto px-4">
            {timelineSteps.map((step, i) => (
              <div key={step.day} className="flex items-center">
                {/* Connector line (before, except first) */}
                {i > 0 && (
                  <div className="h-0.5 w-8 bg-[var(--primary)] sm:w-12" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">{step.day}</span>
                  <div className="flex items-center gap-1.5">
                    {step.icons.map((Icon, j) => (
                      <div
                        key={j}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-sm"
                      >
                        <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Connector line (after last — dashed) */}
                {i === timelineSteps.length - 1 && (
                  <div className="flex items-center gap-0.5 pl-2">
                    <div className="h-0.5 w-2 rounded bg-[var(--primary)] opacity-60" />
                    <div className="h-0.5 w-2 rounded bg-[var(--primary)] opacity-40" />
                    <div className="h-0.5 w-2 rounded bg-[var(--primary)] opacity-20" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Button size="lg" className="h-14 px-10 text-base font-bold" asChild>
              <a href="#cadastro">Quero acelerar o trabalho dos SDRs</a>
            </Button>
          </div>
        </div>

        {/* Part 2 — Where Enriquece AI fits */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ok, mas onde o Enriquece AI se encaixa?
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[var(--muted-foreground)]">
              Imagine um esporte como a natação praticado com um equipamento do futebol. Não dá pra
              ser competitivo. Se você tem um time de pré-vendedores, esse é o momento de implementar
              a ferramenta certa para eles.
            </p>
            <div className="mt-6">
              <Button variant="link" className="h-auto p-0 font-bold text-[var(--primary)]" asChild>
                <a href="#cadastro">Peça uma demonstração &rarr;</a>
              </Button>
            </div>
          </div>

          {/* Funnel diagram */}
          <div className="flex flex-col items-center gap-5 py-4">
            {funnelLayers.map((layer) => (
              <div key={layer.label} className={`${layer.width} flex flex-col items-center gap-2`}>
                <div
                  className={`w-full rounded-xl px-6 py-4 text-center text-sm font-semibold shadow-sm ${
                    layer.highlight
                      ? 'bg-[var(--primary)] text-white ring-2 ring-[var(--primary)]/30 ring-offset-2 ring-offset-[var(--background)]'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {layer.label}
                </div>
                <p className="text-center text-xs leading-snug text-[var(--muted-foreground)]/70">
                  {layer.description}
                </p>
              </div>
            ))}

            {/* Arrow → Vendas */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="flex flex-col items-center gap-1">
                <div className="h-2 w-0.5 rounded bg-[var(--border)]" />
                <div className="h-2 w-0.5 rounded bg-[var(--border)]" />
                <div className="h-2 w-0.5 rounded bg-[var(--border)]" />
              </div>
              <svg width="16" height="10" viewBox="0 0 16 10" className="text-[var(--border)]">
                <polygon points="0,0 8,10 16,0" fill="currentColor" />
              </svg>
              <span className="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">
                Vendas
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
