import { Button } from '@/shared/components/ui/button';

const metrics = [
  { value: '3x', description: 'mais reuniões agendadas pelo seu time' },
  { value: '80%', description: 'de redução no tempo de enriquecimento de leads' },
  { value: '2x', description: 'mais leads qualificados por SDR ao mês' },
];

export function MetricsSection() {
  return (
    <section className="bg-[var(--muted)]/50 py-24">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Motivos não faltam para escolher o Enriquece AI
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[var(--muted-foreground)]">
          Tenha controle total da prospecção: com o dashboard do Enriquece AI, você acompanha os
          indicadores que realmente movem os ponteiros. Monitore o progresso diário de cada SDR e
          os resultados de pré-vendas mês a mês.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.value}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-10 shadow-sm"
            >
              <p className="text-5xl font-bold text-[var(--primary)]">{metric.value}</p>
              <p className="mt-3 text-sm leading-snug text-[var(--muted-foreground)]">
                {metric.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Button size="lg" className="h-14 px-10 text-base font-bold" asChild>
            <a href="#cadastro">Quero ter controle da operação</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
