'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ChevronDown, HelpCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { UserMenu } from '@/features/auth/components/UserMenu';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

export interface NavDropdownItem {
  label: string;
  href?: string;
  placeholder?: string;
}

export interface NavSection {
  label: string;
  href?: string;
  items?: NavDropdownItem[];
  placeholder?: string;
}

export const navSections: NavSection[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
  },
  {
    label: 'Prospecção',
    items: [
      { label: 'Execução', href: '/atividades' },
      { label: 'Atividades', href: '/activities' },
      { label: 'Cadências', href: '/cadences' },
      { label: 'Leads', href: '/leads' },
      { label: 'Ajustes', href: '/settings' },
    ],
  },
  {
    label: 'Ligações',
    items: [
      { label: 'Painel de Ligações', placeholder: 'Em breve' },
      { label: 'Lista de Ligações', href: '/calls' },
    ],
  },
  {
    label: 'Estatística',
    items: [
      { label: 'Atividades', placeholder: 'Em breve' },
      { label: 'Conversão', placeholder: 'Em breve' },
      { label: 'Ligações', placeholder: 'Em breve' },
      { label: 'Equipe', placeholder: 'Em breve' },
    ],
  },
];

function NavDropdownMenu({ section }: { section: NavSection }) {
  const pathname = usePathname();
  const isActive = section.items?.some(
    (item) => item.href && (pathname === item.href || pathname.startsWith(item.href + '/')),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {section.label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {section.items?.map((item) =>
          item.placeholder ? (
            <DropdownMenuItem key={item.label} disabled>
              <span className="text-muted-foreground">
                {item.label} — {item.placeholder}
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} asChild>
              <Link
                href={item.href!}
                className={cn(
                  pathname === item.href && 'font-medium text-primary',
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-background">
      {/* Main bar */}
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Mobile hamburger */}
        <MobileNav />

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logos/logo-ea-red.png" alt="Enriquece AI" width={32} height={32} className="rounded-full" />
          <span className="text-xl font-bold text-primary">Enriquece AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {navSections.map((section) =>
            section.href ? (
              <Link
                key={section.label}
                href={section.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === section.href ||
                    pathname.startsWith(section.href + '/')
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
              </Link>
            ) : (
              <NavDropdownMenu key={section.label} section={section} />
            ),
          )}
        </nav>

        {/* Right area */}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Ajuda">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>

    </div>
  );
}
