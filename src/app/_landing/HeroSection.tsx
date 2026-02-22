import { Button } from '@/shared/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center bg-gradient-to-b from-background to-primary-50/50 pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="animate-fade-in-up mb-6 inline-flex items-center rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
          Plataforma de Sales Engagement com IA
        </div>

        <h1 className="animate-fade-in-up animate-delay-100 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Sua equipe de vendas
          <br />
          fechando <span className="text-primary">3x mais reuniões</span>.
        </h1>

        <p className="animate-fade-in-up animate-delay-200 mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Prospecção multicanal com IA, cadências automatizadas e enriquecimento de leads por CNPJ
          &mdash; tudo em uma plataforma.
        </p>

        <div className="animate-fade-in-up animate-delay-300 mt-10">
          <Button size="lg" asChild>
            <a href="#cadastro">Começar gratuitamente</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
