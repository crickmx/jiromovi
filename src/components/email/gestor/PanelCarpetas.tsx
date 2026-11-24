import { Home, PenSquare, SlidersHorizontal, ContactRound, Settings, LayoutPanelLeft, HardDrive, Building2, Mail } from 'lucide-react';
import { cnSistema as cn } from '@/lib/utils';
import { type ImapFolder, etiquetaCarpeta, iconoCarpeta, ordenarCarpetas, formatSize } from './tipos';

export interface Cuota { usedBytes: number | null; limitBytes: number | null }

export interface CuentaExternaMenu { id: string; nombre: string; email: string }

interface Props {
  carpetas: ImapFolder[];
  actual: string | null; // null = Inicio
  correo: string;
  cuota: Cuota | null;
  onInicio: () => void;
  onCarpeta: (path: string) => void;
  onRedactar: () => void;
  onContactos: () => void;
  onReglas: () => void;
  onConfiguracion: () => void;
  onVistaAlternativa: () => void;
  abriendoAlternativa?: boolean;
  /** Cuentas externas (POP3/SMTP). Si no se pasan, la sección no aparece. */
  cuentasExternas?: CuentaExternaMenu[];
  /** Cuenta externa que se está viendo; null = la de JIRO. */
  cuentaExternaActiva?: string | null;
  onCuentaExterna?: (id: string) => void;
  onVolverAJiro?: () => void;
  onAdministrarCuentas?: () => void;
}

const item = 'w-full min-h-[44px] flex items-center gap-3 px-3 rounded-[var(--radius-sm)] text-body-sm transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function PanelCarpetas(p: Props) {
  const carpetas = ordenarCarpetas(p.carpetas);
  const usado = p.cuota?.usedBytes ?? null;
  const limite = p.cuota?.limitBytes ?? null;
  const pct = usado !== null && limite ? Math.min(100, Math.round((usado / limite) * 100)) : null;

  return (
    <nav aria-label="Carpetas de correo" className="h-full flex flex-col bg-surface-card">
      <div className="p-3 pb-2">
        <button
          type="button"
          onClick={p.onRedactar}
          aria-keyshortcuts="c"
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent text-accent-foreground font-display font-semibold text-body shadow-accent hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <PenSquare className="w-5 h-5" aria-hidden /> Redactar
        </button>
        <p className="mt-2 px-1 text-micro text-neutral-500 dark:text-neutral-400 truncate" title={p.correo}>{p.correo}</p>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2 space-y-0.5">
        <button
          type="button"
          onClick={p.onInicio}
          aria-current={p.actual === null ? 'page' : undefined}
          className={cn(item, p.actual === null ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold' : 'text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}
        >
          <Home className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
          <span className="flex-1 text-left truncate">Inicio</span>
        </button>

        {/* Cuentas: la de JIRO (IONOS, la de siempre) y las externas (POP3/SMTP).
            Cada cuenta tiene su propio buzón; no se mezclan. */}
        {p.onCuentaExterna && (
          <>
            <p className="movi-eyebrow text-neutral-400 dark:text-neutral-500 px-3 pt-3 pb-1">Cuentas</p>
            <button
              type="button"
              onClick={p.onVolverAJiro}
              aria-current={!p.cuentaExternaActiva ? 'page' : undefined}
              className={cn(item, !p.cuentaExternaActiva ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold' : 'text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}
            >
              <Building2 className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
              <span className="flex-1 text-left truncate">JIRO (IONOS)</span>
            </button>
            {(p.cuentasExternas ?? []).map(c => {
              const activa = p.cuentaExternaActiva === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => p.onCuentaExterna?.(c.id)}
                  aria-current={activa ? 'page' : undefined}
                  title={`${c.nombre} — ${c.email}`}
                  className={cn(item, activa ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold' : 'text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}
                >
                  <Mail className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
                  <span className="flex-1 text-left truncate">{c.nombre || c.email}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={p.onAdministrarCuentas}
              className={cn(item, 'text-neutral-600 dark:text-neutral-300 hover:bg-surface-muted')}
            >
              <Settings className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
              <span className="flex-1 text-left truncate">Cuentas externas</span>
            </button>
          </>
        )}

        <p className="movi-eyebrow text-neutral-400 dark:text-neutral-500 px-3 pt-3 pb-1">Carpetas</p>
        {carpetas.map(f => {
          const Icon = iconoCarpeta(f);
          const activo = p.actual === f.path;
          const nombre = etiquetaCarpeta(f);
          return (
            <button
              key={f.path}
              type="button"
              onClick={() => p.onCarpeta(f.path)}
              aria-current={activo ? 'page' : undefined}
              aria-label={f.unseen > 0 ? `${nombre}, ${f.unseen} sin leer` : nombre}
              className={cn(item, activo ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink font-semibold' : 'text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
              <span className="flex-1 text-left truncate">{nombre}</span>
              {f.unseen > 0 && (
                <span aria-hidden className={cn(
                  'text-micro font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0',
                  activo ? 'bg-accent text-accent-foreground' : 'bg-surface-muted text-neutral-600 dark:text-neutral-300',
                )}>
                  {f.unseen > 999 ? '999+' : f.unseen}
                </span>
              )}
            </button>
          );
        })}

        <p className="movi-eyebrow text-neutral-400 dark:text-neutral-500 px-3 pt-4 pb-1">Herramientas</p>
        {[
          { icon: ContactRound, label: 'Contactos', on: p.onContactos },
          { icon: SlidersHorizontal, label: 'Reglas', on: p.onReglas },
          { icon: Settings, label: 'Configurar cuenta', on: p.onConfiguracion },
          { icon: LayoutPanelLeft, label: p.abriendoAlternativa ? 'Abriendo…' : 'Vista alternativa', on: p.onVistaAlternativa },
        ].map(b => (
          <button key={b.label} type="button" onClick={b.on} className={cn(item, 'text-neutral-600 dark:text-neutral-300 hover:bg-surface-muted')}>
            <b.icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
            <span className="flex-1 text-left truncate">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-soft px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 mb-2 text-caption text-neutral-600 dark:text-neutral-300">
          <HardDrive className="w-4 h-4 flex-shrink-0" aria-hidden />
          <span className="font-semibold">Espacio</span>
        </div>
        {pct !== null ? (
          <>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Espacio usado del buzón"
              className="h-1.5 rounded-full bg-surface-muted overflow-hidden"
            >
              <div
                className={cn('h-full rounded-full transition-all duration-slow', pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-accent')}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <p className="mt-1.5 text-micro text-neutral-500 dark:text-neutral-400 tabular-nums">
              {formatSize(usado!)} usados · {formatSize(Math.max(0, limite! - usado!))} libres
            </p>
          </>
        ) : (
          <p className="text-micro text-neutral-500 dark:text-neutral-400">
            {p.cuota ? 'El servidor no informa el espacio.' : 'Consultando…'}
          </p>
        )}
      </div>
    </nav>
  );
}
