import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3">
        <Image src="/logos/logo-ea-red.png" alt="Enriquece AI" width={48} height={48} className="rounded-full" />
        <h1 className="text-3xl font-bold">Enriquece AI</h1>
      </div>
    </main>
  );
}
