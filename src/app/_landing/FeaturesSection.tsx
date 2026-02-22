import { BarChart3, Brain, Building2, Phone, Target, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Cadências multicanal',
    description: 'Email e WhatsApp em sequências automatizadas com timing inteligente.',
  },
  {
    icon: Brain,
    title: 'IA generativa',
    description: 'Mensagens personalizadas geradas por IA para cada lead.',
  },
  {
    icon: Building2,
    title: 'Enriquecimento CNPJ',
    description: 'Dados completos da empresa: sócios, faturamento, contatos.',
  },
  {
    icon: BarChart3,
    title: 'Estatísticas em tempo real',
    description: 'Métricas de atividade, conversão e performance do time.',
  },
  {
    icon: Phone,
    title: 'Gestão de ligações',
    description: 'Rastreie ligações, duração e resultados de cada SDR.',
  },
  {
    icon: Target,
    title: 'Qualificação de leads',
    description: 'Fit Score automático e pipeline de qualificação.',
  },
];

const delayClasses = [
  '',
  'animate-delay-100',
  'animate-delay-200',
  'animate-delay-100',
  'animate-delay-200',
  'animate-delay-300',
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que sua equipe precisa para prospectar
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Uma plataforma completa de sales engagement para times B2B.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-fade-in-up ${delayClasses[i]} group rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md`}
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
