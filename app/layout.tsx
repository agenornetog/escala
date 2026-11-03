import type { Metadata } from 'next';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import './globals.css';
export const metadata: Metadata = { title: 'Escala · Gestão de equipes', description: 'Planeje turnos, acompanhe a cobertura e valide regras de jornada da sua equipe.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
