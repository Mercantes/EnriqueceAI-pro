import Image from 'next/image';
import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[var(--sidebar-background)] py-10 text-[var(--sidebar-foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Image
            src="/logos/logo-ea-red.png"
            alt="Enriquece AI"
            width={24}
            height={24}
            className="rounded-full"
          />
          <span className="text-sm font-medium">Enriquece AI</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#cadastro" className="text-sm opacity-60 transition-opacity hover:opacity-100">
            Cadastro
          </a>
          <Link href="/login" className="text-sm opacity-60 transition-opacity hover:opacity-100">
            Entrar
          </Link>
        </div>

        <p className="text-xs opacity-50">
          &copy; 2026 Enriquece AI. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
