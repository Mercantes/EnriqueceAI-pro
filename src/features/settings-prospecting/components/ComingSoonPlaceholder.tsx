import { Clock } from 'lucide-react';

interface ComingSoonPlaceholderProps {
  title: string;
}

export function ComingSoonPlaceholder({ title }: ComingSoonPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--muted)]">
        <Clock className="h-8 w-8 text-[var(--muted-foreground)]" />
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Em breve — esta funcionalidade está sendo desenvolvida.
      </p>
    </div>
  );
}
