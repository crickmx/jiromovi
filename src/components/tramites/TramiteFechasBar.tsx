// Las fechas del trámite, en una franja entre el encabezado y las pestañas.
//
// Estaban al final de "Detalles" como un bloque de 4 tarjetas a dos columnas
// (~200px), tan abajo que había que hacer scroll para ver cuándo se creó el
// trámite. Son datos que se consultan de un vistazo y nunca se editan: una
// franja compacta arriba es su lugar.

import { Calendar, Clock, CircleCheck as CheckCircle, Truck } from 'lucide-react';
import type { ReactNode } from 'react';

interface UsuarioMin { nombre_completo?: string | null }

interface Props {
  fechaCreacion: string;
  ultimaModificacion: string;
  fechaPromesaEntrega?: string | null;
  cerradoEn?: string | null;
  creadoPor?: UsuarioMin | null;
  modificadoPor?: UsuarioMin | null;
  cerradoPor?: UsuarioMin | null;
}

function fechaYHora(valor: string): string {
  return new Date(valor).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Solo día. `fecha_promesa_entrega` viene como 'YYYY-MM-DD' y se le agrega la
 * hora local a propósito: `new Date('2026-01-31')` se interpreta en UTC y en
 * México muestra el día anterior.
 */
function soloDia(valor: string): string {
  return new Date(valor + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function Dato({ icono, etiqueta, valor, por }: { icono: ReactNode; etiqueta: string; valor: string; por?: string | null }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="text-neutral-400 mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide leading-tight">{etiqueta}</p>
        <p className="text-xs text-neutral-700 dark:text-neutral-200 leading-tight">
          {valor}
          {por && <span className="text-neutral-400"> · {por}</span>}
        </p>
      </div>
    </div>
  );
}

export function TramiteFechasBar({
  fechaCreacion, ultimaModificacion, fechaPromesaEntrega, cerradoEn,
  creadoPor, modificadoPor, cerradoPor,
}: Props) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700">
      <Dato
        icono={<Calendar className="w-3.5 h-3.5" />}
        etiqueta="Creado"
        valor={fechaYHora(fechaCreacion)}
        por={creadoPor?.nombre_completo}
      />
      <Dato
        icono={<Clock className="w-3.5 h-3.5" />}
        etiqueta="Última modificación"
        valor={fechaYHora(ultimaModificacion)}
        por={modificadoPor?.nombre_completo}
      />
      {fechaPromesaEntrega && (
        <Dato
          icono={<Truck className="w-3.5 h-3.5" />}
          etiqueta="Promesa de entrega"
          valor={soloDia(fechaPromesaEntrega)}
        />
      )}
      {cerradoEn && (
        <Dato
          icono={<CheckCircle className="w-3.5 h-3.5" />}
          etiqueta="Terminado"
          valor={fechaYHora(cerradoEn)}
          por={cerradoPor?.nombre_completo}
        />
      )}
    </div>
  );
}

export default TramiteFechasBar;
