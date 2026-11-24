// Altas de usuario que esperan el visto bueno de un Administrador.
//
// Quien no es Administrador no puede quitarle el correo a nadie, así que su
// alta se detiene aquí en vez de perderse: los datos que capturó quedan
// guardados enteros y el Administrador crea al usuario tal cual, de un clic.

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { quienOcupaCorreo, liberarCorreoOcupado, nombreDeOcupante } from '../../lib/correoOcupado';

interface Solicitud {
  id: string;
  datos: Record<string, unknown>;
  email_solicitado: string;
  created_at: string;
  solicitante?: { nombre: string | null; apellidos: string | null } | null;
}

interface Props {
  isAdmin: boolean;
  /** Para refrescar el directorio cuando una solicitud se convierte en usuario. */
  onResuelta: () => void;
}

export function SolicitudesAltaPanel({ isAdmin, onResuelta }: Props) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios_solicitudes_alta')
      .select('id, datos, email_solicitado, created_at, solicitante:usuarios!usuarios_solicitudes_alta_solicitado_por_fkey(nombre, apellidos)')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });
    if (error) {
      // La tabla puede no existir todavía si falta correr la migración.
      console.error('No se pudieron cargar las solicitudes de alta:', error);
      return;
    }
    setSolicitudes((data ?? []) as unknown as Solicitud[]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function resolver(s: Solicitud, estado: 'aprobada' | 'rechazada', usuarioCreado?: string, nota?: string) {
    await supabase.from('usuarios_solicitudes_alta').update({
      estado,
      resuelto_en: new Date().toISOString(),
      nota_resolucion: nota ?? null,
      usuario_creado: usuarioCreado ?? null,
    }).eq('id', s.id);
    setSolicitudes(prev => prev.filter(x => x.id !== s.id));
    onResuelta();
  }

  async function autorizar(s: Solicitud) {
    setTrabajando(s.id);
    try {
      // El correo pudo liberarse por otro lado desde que se pidió, así que se
      // vuelve a mirar en vez de confiar en lo que decía la solicitud.
      const ocupante = await quienOcupaCorreo(s.email_solicitado);
      if (ocupante) {
        const aviso = ocupante.visible
          ? `⚠ El correo ${s.email_solicitado} lo usa ${nombreDeOcupante(ocupante)} (${ocupante.rol ?? 'sin rol'}), que SÍ aparece en MOVI.\n\nSi continúas, esa persona se queda SIN PODER INICIAR SESIÓN.`
          : `El correo ${s.email_solicitado} lo tiene ${nombreDeOcupante(ocupante)}, que ya no aparece en MOVI.\n\nLiberarlo no afecta a nadie: su historial se conserva.`;
        if (!confirm(`${aviso}\n\n¿Liberarlo y crear al usuario?`)) return;

        const liberado = await liberarCorreoOcupado(s.email_solicitado, ocupante.visible);
        if (!liberado.success) {
          alert(`No se pudo liberar el correo: ${liberado.error ?? ''}`);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userData: s.datos }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`No se pudo crear el usuario: ${result?.error ?? res.statusText}`);
        return;
      }

      await resolver(s, 'aprobada', result?.user?.id ?? undefined);
      alert('Usuario creado.');
    } finally {
      setTrabajando(null);
    }
  }

  async function rechazar(s: Solicitud) {
    const nota = prompt('¿Por qué se rechaza? (lo verá quien la pidió)');
    if (nota === null) return;
    setTrabajando(s.id);
    try {
      await resolver(s, 'rechazada', undefined, nota);
    } finally {
      setTrabajando(null);
    }
  }

  if (solicitudes.length === 0) return null;
  const varias = solicitudes.length > 1;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 overflow-hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
          <CircleAlert className="w-4 h-4 shrink-0" />
          {solicitudes.length} alta{varias ? 's' : ''} de usuario esperando autorización
          {!isAdmin && ` (la${varias ? 's' : ''} tiene que revisar un Administrador)`}
        </span>
        {abierto ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-2">
          {solicitudes.map(s => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-white dark:bg-neutral-800 border border-amber-200 dark:border-white/10 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">
                  {String(s.datos?.nombre ?? '')} {String(s.datos?.apellidos ?? '')}
                </p>
                <p className="text-xs text-neutral-500 dark:text-white/50 truncate">
                  {s.email_solicitado} · {String(s.datos?.rol ?? '—')}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pedida por {s.solicitante?.nombre ?? '—'} {s.solicitante?.apellidos ?? ''} ·{' '}
                  {new Date(s.created_at).toLocaleDateString('es-MX')}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => autorizar(s)}
                    disabled={trabajando === s.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Autorizar
                  </button>
                  <button
                    onClick={() => rechazar(s)}
                    disabled={trabajando === s.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SolicitudesAltaPanel;
