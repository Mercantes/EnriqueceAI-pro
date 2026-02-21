import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logos/logo-ea-red.png" alt="Enriquece AI" width={56} height={56} className="rounded-full" />
          <h2 className="text-3xl font-bold tracking-tight">Enriquece AI</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
