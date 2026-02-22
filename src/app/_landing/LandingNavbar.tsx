import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';

export function LandingNavbar() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logos/logo-ea-red.png"
            alt="Enriquece AI"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-lg font-semibold">Enriquece AI</span>
        </Link>

        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Features
          </a>
          <a
            href="#cadastro"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Contato
          </a>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Entrar
            </Link>
            <Button size="sm" asChild>
              <a href="#cadastro">Começar grátis</a>
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}
