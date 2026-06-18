import { ReactNode } from 'react';
import { GraduationCap, Video, Calendar, ChartBar as BarChart3, BookOpen, Hop as Home } from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Inicio', path: '/seguros-education', icon: Home, exact: true },
  { label: 'Cédula A', path: '/seguros-education/cedula-a', icon: GraduationCap },
  { label: 'On Demand', path: '/seguros-education/on-demand', icon: Video },
  { label: 'Aula Virtual', path: '/seguros-education/aula-virtual', icon: Calendar },
  { label: 'Manuales', path: '/seguros-education/manuales', icon: BookOpen },
  { label: 'Analytics', path: '/seguros-education/analytics', icon: BarChart3, adminOnly: true },
];

// Also match /manuales as Manuales tab
export const ALIAS_MAP: Record<string, string> = {
  '/manuales': '/seguros-education/manuales',
};

interface Props {
  children: ReactNode;
  sectionTitle?: string;
  sectionDescription?: string;
}

export function SegurosEducationLayout({ children, sectionTitle, sectionDescription }: Props) {
  return (
    <div className="space-y-5">
      {sectionTitle && (
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">{sectionTitle}</h1>
          {sectionDescription && (
            <p className="text-sm text-neutral-500 dark:text-white/40 mt-0.5">{sectionDescription}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
