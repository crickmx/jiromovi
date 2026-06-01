import { useMemo } from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';

interface Props {
  usuario: Usuario;
}

const ROLE_LABELS: Record<string, string> = {
  Administrador: 'Administrador',
  Gerente: 'Gerente de Oficina',
  Empleado: 'Empleado',
  Agente: 'Agente de Seguros',
  Ejecutivo: 'Ejecutivo',
};

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
  const roleLabel = ROLE_LABELS[usuario.rol] ?? usuario.rol;
  const oficina = (usuario.oficina as any);
  const oficinaNombre = oficina?.nombre;
  const logoUrl = oficina?.logo_url;

  // Build initials fallback
  const initials = nombre.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
      {/* Left: greeting */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--movi-accent-rgb))] flex items-center justify-center text-[rgb(var(--movi-accent-foreground-rgb))] font-bold text-lg shadow-lg shadow-[rgb(var(--movi-accent-rgb))]/20 overflow-hidden">
            {usuario.avatar_url ? (
              <img
                src={usuario.avatar_url}
                alt={nombre}
                className="w-full h-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              initials
            )}
          </div>
          {/* Online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-neutral-950" />
        </div>

        {/* Text */}
        <div>
          <p className="text-xs text-neutral-400 dark:text-white/40 font-medium">{greeting}</p>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">
            {nombre}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-xs text-neutral-500 dark:text-white/40 font-medium">{roleLabel}</span>
            {oficinaNombre && (
              <>
                <span className="text-neutral-200 dark:text-white/15">·</span>
                <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/40">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {oficinaNombre}
                </span>
              </>
            )}
          </div>
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
