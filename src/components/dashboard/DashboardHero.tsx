import { useMemo } from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';

interface Props {
  usuario: Usuario;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DashboardHero({ usuario }: Props) {
  const greeting = useMemo(() => getGreeting(), []);
  const dateStr = useMemo(() => capitalize(formatDate()), []);

  const nombre = usuario.nombre || usuario.nombre_completo?.split(' ')[0] || 'Usuario';
  const oficina = (usuario.oficina as any);
  const oficinaNombre = oficina?.nombre;
  const logoUrl = oficina?.logo_url;

  const initials = nombre.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
      {/* Left: greeting */}
      <div className="flex items-center gap-4">
        {/* Text */}
        <div>
          <p className="text-xs text-neutral-400 dark:text-white/40 font-medium">{greeting}</p>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
            {nombre}
          </h1>
          {oficinaNombre && (
            <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/40 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {oficinaNombre}
            </span>
          )}
        </div>
      </div>

      {/* Right: office logo + date */}
      <div className="flex items-center gap-4">
        {/* Date */}
        <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400 dark:text-white/35">
          <Calendar className="w-3.5 h-3.5" />
          <span>{dateStr}</span>
        </div>

        {/* Office logo */}
        {logoUrl && (
          <div className={cn(
            'h-10 max-w-[120px] flex items-center justify-center',
            'bg-neutral-50 dark:bg-white/5 rounded-xl px-3 border border-neutral-100 dark:border-white/8'
          )}>
            <img
              src={logoUrl}
              alt={oficinaNombre ?? 'Oficina'}
              className="h-6 w-auto max-w-[100px] object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
