import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Enriquece AI',
  description: 'Plataforma de Sales Engagement para equipes de vendas B2B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
