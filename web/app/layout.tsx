import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../src/providers/Providers';

export const metadata: Metadata = {
  title: 'Carvão Connect | Portal',
  description: 'Portal web para siderúrgicas, fornecedores e administradores'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--bg)] text-ink-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
