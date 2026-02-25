import Image from 'next/image';

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Image
            src="/logos/logo-ea-red.png"
            alt="Enriquece AI"
            width={24}
            height={24}
            className="rounded-full"
            unoptimized
          />
          <span className="text-sm font-medium">Enriquece AI</span>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          &copy; 2026 Enriquece AI. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
