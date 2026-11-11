import { useEffect, useState } from 'react';
import { Link2, Unlink, Search, Loader2, Mail, MessageCircle, Building2, UserCheck, UserX } from 'lucide-react';
import {
  asociarPedidoUsuario,
  buscarUsuariosParaAsociar,
  sugerirUsuariosParaPedido,
  type UsuarioAsociable,
} from '../../lib/storeUtils';
import type { StorePedido } from '../../lib/storeTypes';

interface Props {
  pedido: StorePedido;
  puedeAsociar: boolean;
  onCambio: () => void;
}

/**
 * Datos del invitado de un pedido hecho en tienda.movi.digital sin sesión y
 * acciones para asociarlo a un usuario MOVI (Admin / equipos Store).
 */
export function AsociarPedidoPublico({ pedido, puedeAsociar, onCambio }: Props) {
  const [sugeridos, setSugeridos] = useState<UsuarioAsociable[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioAsociable[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const asociado = Boolean(pedido.usuario_id);

  useEffect(() => {
    if (asociado || !puedeAsociar) return;
    sugerirUsuariosParaPedido(pedido.invitado_email, pedido.invitado_whatsapp).then(setSugeridos);
  }, [asociado, puedeAsociar, pedido.invitado_email, pedido.invitado_whatsapp]);

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      buscarUsuariosParaAsociar(busqueda)
        .then(setResultados)
        .catch(err => console.error('Error buscando usuarios:', err))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const asociar = async (u: UsuarioAsociable | null) => {
    const etiqueta = u ? (u.nombre_completo || u.nombre || 'este usuario') : null;
    const ok = u
      ? confirm(`¿Asociar el pedido ${pedido.folio_oc ?? ''} a ${etiqueta}? Aparecerá en sus "Mis pedidos".`)
      : confirm('¿Quitar la asociación? El pedido volverá a quedar como público sin asociar.');
    if (!ok) return;
    setGuardando(u?.id ?? 'quitar');
    try {
      await asociarPedidoUsuario(pedido.id, u?.id ?? null);
      onCambio();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo asociar el pedido.');
    } finally {
      setGuardando(null);
    }
  };

  const filaUsuario = (u: UsuarioAsociable) => (
    <li key={u.id} className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
          {u.nombre_completo || u.nombre}
          {u.coincide && (
            <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Coincide {u.coincide === 'email' ? 'correo' : 'WhatsApp'}
            </span>
          )}
        </p>
        <p className="text-xs text-neutral-500 dark:text-white/50 truncate">
          {[u.oficina_nombre, u.email_laboral || u.email_personal].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => asociar(u)}
        disabled={guardando !== null}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
      >
        {guardando === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        Asociar
      </button>
    </li>
  );

  return (
    <div className="bg-surface-card dark:bg-white/5 rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 p-6">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1 flex items-center gap-2">
        {asociado ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <UserX className="w-5 h-5 text-amber-600" />}
        Pedido público
      </h2>
      <p className="text-xs text-neutral-500 dark:text-white/50 mb-4">
        Hecho en tienda.movi.digital sin iniciar sesión.
      </p>

      <dl className="space-y-2 text-sm mb-4">
        <div>
          <dt className="text-xs text-neutral-500 dark:text-white/50">Nombre capturado</dt>
          <dd className="font-semibold text-neutral-900 dark:text-white">{pedido.invitado_nombre}</dd>
        </div>
        {pedido.invitado_email && (
          <div className="flex items-center gap-2 text-neutral-700 dark:text-white/70">
            <Mail className="w-4 h-4 shrink-0" />
            <a href={`mailto:${pedido.invitado_email}`} className="hover:underline break-all">{pedido.invitado_email}</a>
          </div>
        )}
        {pedido.invitado_whatsapp && (
          <div className="flex items-center gap-2 text-neutral-700 dark:text-white/70">
            <MessageCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <a
              href={`https://wa.me/${pedido.invitado_whatsapp.length === 10 ? '52' : ''}${pedido.invitado_whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {pedido.invitado_whatsapp}
            </a>
          </div>
        )}
        {pedido.invitado_oficina_nombre && (
          <div className="flex items-center gap-2 text-neutral-700 dark:text-white/70">
            <Building2 className="w-4 h-4 shrink-0" />
            <span>{pedido.invitado_oficina_nombre}</span>
          </div>
        )}
      </dl>

      <div className="mb-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3 text-xs">
        <p className="font-semibold text-neutral-700 dark:text-white/70 mb-1.5">Confirmación al cliente</p>
        {pedido.confirmacion_enviada_en ? (
          <div className="flex flex-wrap gap-1.5">
            <EstadoEnvio ok={pedido.confirmacion_email_ok} etiqueta="Correo" />
            <EstadoEnvio ok={pedido.confirmacion_whatsapp_ok} etiqueta="WhatsApp" />
          </div>
        ) : (
          <p className="text-neutral-500 dark:text-white/50">Pendiente de envío.</p>
        )}
        {pedido.confirmacion_error && (
          <p className="mt-1.5 text-rose-700 dark:text-rose-300 break-words">{pedido.confirmacion_error}</p>
        )}
      </div>

      {asociado ? (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-sm">
          <p className="text-emerald-900 dark:text-emerald-200">
            Asociado a <strong>{pedido.usuario?.nombre_completo || pedido.usuario?.nombre}</strong>
          </p>
          {puedeAsociar && (
            <button
              type="button"
              onClick={() => asociar(null)}
              disabled={guardando !== null}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" /> Quitar asociación
            </button>
          )}
        </div>
      ) : !puedeAsociar ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">Sin asociar a un usuario MOVI.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Asócialo a un usuario MOVI antes de avanzar el estatus, para que los trámites y la orden de compra queden a su nombre.
          </p>

          {sugeridos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-700 dark:text-white/70 mb-1">Coincidencias</p>
              <ul className="divide-y divide-neutral-100 dark:divide-white/10">{sugeridos.map(filaUsuario)}</ul>
            </div>
          )}

          <div>
            <label htmlFor="buscar-usuario-asociar" className="text-xs font-semibold text-neutral-700 dark:text-white/70">
              Buscar usuario MOVI
            </label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="buscar-usuario-asociar"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Nombre o correo"
                className="w-full pl-9 pr-8 py-2 text-sm border border-neutral-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white focus:ring-2 focus:ring-accent/40"
              />
              {buscando && <Loader2 className="w-4 h-4 animate-spin text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>
            {resultados.length > 0 && (
              <ul className="mt-1 divide-y divide-neutral-100 dark:divide-white/10 max-h-64 overflow-y-auto">
                {resultados.map(filaUsuario)}
              </ul>
            )}
            {!buscando && busqueda.trim().length >= 2 && resultados.length === 0 && (
              <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">Sin resultados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoEnvio({ ok, etiqueta }: { ok?: boolean | null; etiqueta: string }) {
  const clase =
    ok === true
      ? 'bg-emerald-100 text-emerald-800'
      : ok === false
        ? 'bg-rose-100 text-rose-800'
        : 'bg-neutral-100 text-neutral-600';
  return (
    <span className={`px-2 py-0.5 rounded-full font-semibold ${clase}`}>
      {etiqueta}: {ok === true ? 'enviado' : ok === false ? 'falló' : 'en proceso'}
    </span>
  );
}
