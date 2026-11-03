import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Escala · Gestão de equipes', description: 'Planeje turnos, acompanhe a cobertura e valide regras de jornada da sua equipe.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
