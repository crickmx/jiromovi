import { Inbox, Send, PenSquare, MailOpen, ChevronRight, Paperclip } from 'lucide-react';
import { cnSistema as cn } from '@/lib/utils';
import { fechaRelativa } from '@/lib/correo/filtrosCorreo';
import { type EmailHeader, getInitials, tonoAvatar } from './tipos';

interface Props {
  nombre: string;
  sinLeer: number;
  enRecibidos: number;
  recientes: EmailHeader[];
  cargando: boolean;
  onBandeja: () => void;
  onEnviados: (() => void) | null;
  onRedactar: () => void;
  onAbrir: (m: EmailHeader) => void;
}

function saludo(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export function InicioCorreo(p: Props) {
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const primerNombre = (p.nombre || '').split(' ')[0];
  const nombreBonito = primerNombre ? primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase() : '';

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 movi-stagger">
        <header>
          <p className="movi-eyebrow text-accent-ink first-letter:uppercase">{hoy}</p>
          <h2 className="font-display text-title-lg font-semibold text-neutral-900 dark:text-white mt-1">
            {saludo()}{nombreBonito ? `, ${nombreBonito}` : ''}
          </h2>
        </header>

        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:gap-4">
          {[
            { label: 'Sin leer', valor: p.sinLeer, icon: MailOpen, acento: true },
            { label: 'En recibidos', valor: p.enRecibidos, icon: Inbox, acento: false },
          ].map(k => (
            <button
              key={k.label}
              type="button"
              onClick={p.onBandeja}
              className={cn(
                'text-left rounded-[var(--radius-lg)] p-4 sm:p-5 border transition-shadow duration-base hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                k.acento ? 'bg-accent text-accent-foreground border-transparent shadow-accent' : 'bg-surface-card border-soft shadow-e1',
              )}
            >
              <k.icon className={cn('w-5 h-5 mb-3', k.acento ? 'opacity-90' : 'text-accent-ink')} aria-hidden />
              <p className={cn('font-display text-metric font-semibold tabular-nums', !k.acento && 'text-neutral-900 dark:text-white')}>
                {p.cargando ? '—' : k.valor.toLocaleString('es-MX')}
              </p>
              <p className={cn('text-body-sm mt-0.5', k.acento ? 'opacity-90' : 'text-neutral-500 dark:text-neutral-400')}>{k.label}</p>
            </button>
          ))}
        </section>

        <section aria-label="Accesos rápidos" className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Bandeja', icon: Inbox, on: p.onBandeja },
            { label: 'Enviados', icon: Send, on: p.onEnviados },
            { label: 'Redactar', icon: PenSquare, on: p.onRedactar },
          ].map(a => (
            <button
              key={a.label}
              type="button"
              onClick={a.on || undefined}
              disabled={!a.on}
              className="min-h-[72px] flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-surface-card border border-soft shadow-e1 hover:shadow-e2 hover:border-strong disabled:opacity-50 transition-all duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="w-9 h-9 rounded-full bg-accent-soft dark:bg-accent/20 text-accent-ink flex items-center justify-center">
                <a.icon className="w-[18px] h-[18px]" aria-hidden />
              </span>
              <span className="text-caption font-semibold text-neutral-700 dark:text-neutral-200">{a.label}</span>
            </button>
          ))}
        </section>

        <section aria-labelledby="recientes-titulo" className="rounded-[var(--radius-lg)] bg-surface-card border border-soft shadow-e1 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-soft">
            <h3 id="recientes-titulo" className="font-display text-body font-semibold text-neutral-900 dark:text-white">Últimos recibidos</h3>
            <button type="button" onClick={p.onBandeja} className="min-h-[36px] flex items-center gap-1 px-2 rounded-[var(--radius-xs)] text-caption font-semibold text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Ver todos <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          </div>
          {p.cargando ? (
            <ul aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-surface-muted" />
                  <div className="flex-1 space-y-2"><div className="h-2.5 w-1/3 rounded bg-surface-muted" /><div className="h-2 w-2/3 rounded bg-surface-muted" /></div>
                </li>
              ))}
            </ul>
          ) : p.recientes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Inbox className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" aria-hidden />
              <p className="text-body-sm font-semibold text-neutral-700 dark:text-neutral-200">Tu bandeja está vacía</p>
              <p className="text-caption text-neutral-500 dark:text-neutral-400">Cuando te escriban, lo verás aquí.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--border-soft)]">
              {p.recientes.map(m => (
                <li key={m.uid}>
                  <button
                    type="button"
                    onClick={() => p.onAbrir(m)}
                    className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    <span aria-hidden className={cn('w-9 h-9 rounded-full flex items-center justify-center text-caption font-bold flex-shrink-0', tonoAvatar(m.fromEmail))}>
                      {getInitials(m.from || m.fromEmail)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className={cn('truncate text-body-sm', m.seen ? 'font-medium text-neutral-700 dark:text-neutral-200' : 'font-bold text-neutral-900 dark:text-white')}>
                          {m.from || m.fromEmail}
                        </span>
                        <span className="ml-auto text-micro text-neutral-500 dark:text-neutral-400 flex-shrink-0 tabular-nums">{fechaRelativa(m.date)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        {!m.seen && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" aria-label="No leído" />}
                        <span className="truncate text-caption text-neutral-500 dark:text-neutral-400">{m.subject || '(Sin asunto)'}</span>
                        {m.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" aria-label="Con adjunto" />}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
