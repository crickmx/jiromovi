// Selector de vehículo del catálogo AMIS, en cascada y en ambos sentidos.
//
// Por qué son cuatro niveles y no tres: marca + modelo + versión NO identifica
// una clave AMIS. De las 6,790 combinaciones del catálogo, 2,842 (42%) apuntan a
// más de una clave, porque lo que las distingue —transmisión, motor, puertas—
// vive en la descripción. Ejemplo real: NISSAN/VERSA/SENSE son dos claves, una
// manual y otra automática. Cuando la versión tiene una sola clave, el cuarto
// paso se resuelve solo y no se muestra.

import { useEffect, useState } from 'react';
import { AlertCircle, Car, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface VehiculoSeleccionado {
  clave_amis?: string;
  marca?: string;
  modelo?: string;
  version?: string;
  descripcion?: string;
  /** Escrito a mano porque no está en el catálogo. */
  manual?: boolean;
}

const OTRO = '__otro__';

type Nivel = 'marca' | 'modelo' | 'version';

async function opciones(nivel: Nivel, sel: VehiculoSeleccionado): Promise<string[]> {
  const { data, error } = await supabase.rpc('catalogo_vehiculos_opciones', {
    p_nivel: nivel,
    p_marca: sel.marca || null,
    p_modelo: sel.modelo || null,
    p_version: sel.version || null,
  });
  if (error) { console.error('[SelectorVehiculo] opciones', nivel, error); return []; }
  return (data ?? []).map((r: { valor: string }) => r.valor).filter(Boolean);
}

export function SelectorVehiculo({
  value,
  onChange,
  disabled,
}: {
  value: VehiculoSeleccionado | undefined;
  onChange: (v: VehiculoSeleccionado) => void;
  disabled?: boolean;
}) {
  const sel = value ?? {};
  const [marcas, setMarcas] = useState<string[]>([]);
  const [modelos, setModelos] = useState<string[]>([]);
  const [versiones, setVersiones] = useState<string[]>([]);
  const [claves, setClaves] = useState<{ clave_amis: string; descripcion: string; transmision: string | null; carroceria: string | null }[]>([]);
  const [cargando, setCargando] = useState(false);

  // Cada nivel se recalcula con lo elegido en los OTROS: por eso elegir un modelo
  // sin marca acota las marcas, y no solo al revés.
  useEffect(() => {
    if (sel.manual) return;
    let vivo = true;
    setCargando(true);
    Promise.all([
      opciones('marca', sel),
      opciones('modelo', sel),
      opciones('version', sel),
    ]).then(([ma, mo, ve]) => {
      if (!vivo) return;
      setMarcas(ma); setModelos(mo); setVersiones(ve);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [sel.marca, sel.modelo, sel.version, sel.manual]);

  // Las claves concretas solo tienen sentido con los tres niveles elegidos.
  useEffect(() => {
    if (sel.manual || !sel.marca || !sel.modelo || !sel.version) { setClaves([]); return; }
    let vivo = true;
    supabase
      .from('catalogo_vehiculos')
      .select('clave_amis, descripcion, transmision, carroceria')
      .eq('activo', true).eq('marca', sel.marca).eq('modelo', sel.modelo).eq('version', sel.version)
      .order('descripcion')
      .then(({ data }) => {
        if (!vivo) return;
        const filas = data ?? [];
        setClaves(filas);
        // Si solo hay una, se elige sola: pedirla sería un clic sin decisión.
        if (filas.length === 1 && sel.clave_amis !== filas[0].clave_amis) {
          onChange({ ...sel, clave_amis: filas[0].clave_amis, descripcion: filas[0].descripcion });
        }
      });
    return () => { vivo = false; };
  }, [sel.marca, sel.modelo, sel.version, sel.manual]);

  const cambiar = (nivel: Nivel, valor: string) => {
    if (valor === OTRO) {
      onChange({ manual: true, marca: '', modelo: '', version: '', descripcion: '' });
      return;
    }
    // Al cambiar un nivel se sueltan la clave y la descripción: ya no corresponden.
    const base: VehiculoSeleccionado = { ...sel, clave_amis: undefined, descripcion: undefined };
    if (nivel === 'marca')   onChange({ ...base, marca: valor || undefined });
    if (nivel === 'modelo')  onChange({ ...base, modelo: valor || undefined });
    if (nivel === 'version') onChange({ ...base, version: valor || undefined });
  };

  const clase = 'w-full px-4 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface-card disabled:opacity-50';

  if (sel.manual) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 flex-1">
            Vehículo fuera del catálogo AMIS. Escribe los datos; no habrá clave AMIS.
          </p>
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-amber-600 hover:text-amber-800 shrink-0"
            title="Volver al catálogo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {(['marca', 'modelo', 'version'] as const).map(n => (
          <input
            key={n}
            type="text"
            value={sel[n] ?? ''}
            onChange={e => onChange({ ...sel, [n]: e.target.value })}
            placeholder={n === 'version' ? 'Versión' : n === 'marca' ? 'Marca' : 'Modelo'}
            disabled={disabled}
            className="w-full px-4 py-2.5 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-surface-card"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Marca, modelo y versión son UNA sola pregunta: apiladas medían ~190px
          dentro de una celda cuyo vecino mide 70, y estiraban la fila entera.
          El desempate sí va debajo, a lo ancho: sus descripciones son largas. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <select value={sel.marca ?? ''} onChange={e => cambiar('marca', e.target.value)} disabled={disabled} className={clase}>
        <option value="">{cargando ? 'Cargando marcas…' : 'Marca…'}</option>
        {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        <option value={OTRO}>Otro — no está en el catálogo</option>
      </select>

      <select value={sel.modelo ?? ''} onChange={e => cambiar('modelo', e.target.value)} disabled={disabled} className={clase}>
        <option value="">Modelo…</option>
        {modelos.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <select value={sel.version ?? ''} onChange={e => cambiar('version', e.target.value)} disabled={disabled} className={clase}>
        <option value="">Versión…</option>
        {versiones.map(v => <option key={v} value={v}>{v}</option>)}
      </select>

      </div>

      {/* Cuarto nivel: solo aparece cuando de verdad hay que desempatar. */}
      {claves.length > 1 && (
        <select
          value={sel.clave_amis ?? ''}
          onChange={e => {
            const c = claves.find(x => x.clave_amis === e.target.value);
            onChange({ ...sel, clave_amis: c?.clave_amis, descripcion: c?.descripcion });
          }}
          disabled={disabled}
          className={clase}
        >
          <option value="">Elige la versión exacta ({claves.length} opciones)…</option>
          {claves.map(c => (
            <option key={c.clave_amis} value={c.clave_amis}>
              {c.descripcion}{c.transmision ? ` · ${c.transmision}` : ''}
            </option>
          ))}
        </select>
      )}

      {sel.clave_amis && (
        <p className="text-xs text-neutral-500 flex items-start gap-1.5">
          <Car className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Clave AMIS <span className="font-mono">{sel.clave_amis}</span> — {sel.descripcion}</span>
        </p>
      )}
    </div>
  );
}
