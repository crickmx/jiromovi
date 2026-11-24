import type { ReactNode } from 'react';
import { GraduationCap, Video, Calendar, ChartBar as BarChart3, BookOpen, Hop as Home } from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Inicio', path: '/seguros-education', icon: Home, exact: true },
  { label: 'Cédula A', path: '/seguros-education/cedula-a', icon: GraduationCap },
  { label: 'On Demand', path: '/seguros-education/on-demand', icon: Video },
  { label: 'Aula Virtual', path: '/seguros-education/aula-virtual', icon: Calendar },
  { label: 'Manuales', path: '/manuales', icon: BookOpen },
  { label: 'Analytics', path: '/seguros-education/analytics', icon: BarChart3, adminOnly: true },
];

export const ALIAS_MAP: Record<string, string> = {};

/** Logo oficial de Seguros Education (activo del repo: `public/movirecurso_11.png`). */
export const SEGUROS_EDUCATION_LOGO = '/movirecurso_11.png';

interface Props {
  children: ReactNode;
  sectionTitle?: string;
  sectionDescription?: string;
}

/**
 * Cabecera de identidad compartida por todas las secciones de Seguros Education.
 * El logo oficial es blanco sobre transparente, así que vive sobre el degradado
 * navy de la marca (el mismo que usan las portadas del Aula Virtual).
 */
export function SegurosEducationLayout({ children, sectionTitle, sectionDescription }: Props) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-gradient-to-r from-[#101a3a] via-[#242553] to-[#1C37E0] px-4 py-3 shadow-sm">
        <img
          src={SEGUROS_EDUCATION_LOGO}
          alt="Seguros Education"
          className="h-9 w-auto shrink-0 select-none"
        />
        {(sectionTitle || sectionDescription) && (
          <div className="min-w-0 border-l border-white/15 pl-5">
            {sectionTitle && (
              <h1 className="truncate text-title-sm font-bold leading-tight text-white">{sectionTitle}</h1>
            )}
            {sectionDescription && (
              <p className="truncate text-caption text-white/65">{sectionDescription}</p>
            )}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
