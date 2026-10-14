// Bitácora comercial: pedidos de MOVI Store y periodos de Marketing Premium.
//
// Una sola tabla con filtros por módulo, oficina y nombre. Cada fila lleva al
// control de pagos de ese registro — que es para lo que se consulta: ver quién
// debe y poder ir a cobrarlo sin buscarlo a mano en otra pantalla.

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, FileSpreadsheet, Download, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { normalizarTexto } from '../../lib/utils';
import {
  VISTA_BITACORA, ETIQUETA_MODULO, ETIQUETA_ESTADO,
  modulosVisibles,
  type BitacoraRow, type ModuloBitacora,
} from '../../lib/bitacoraConfig';
import { ModalPagosBitacora } from './ModalPagosBitacora';

const pesos = (n: number) =>
  `$${(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BitacoraComercial() {
  const { usuario } = useAuth();
  // El control de pagos se abre ENCIMA de la bitácora: navegar a otra pantalla
  // perdía la lista, los filtros y el lugar donde ibas, y revisar la cartera es
  // ir fila por fila.
  const [filaAbierta, setFilaAbierta] = useState<BitacoraRow | null>(null);

  const [filas, setFilas] = useState<BitacoraRow[]>([]);
  const [permitidos, setPermitidos] = useState<ModuloBitacora[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<'' | ModuloBitacora>('');
  const [filtroOficina, setFiltroOficina] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargar = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);
    setError(null);

    const modulos = await modulosVisibles(usuario as never);
    setPermitidos(modulos);
    if (modulos.length === 0) {
      setFilas([]);
      setCargando(false);
      return;
    }

    const { data, error: err } = await supabase
      .from(VISTA_BITACORA)
      .select('*')
      .in('modulo', modulos)
      .order('fecha', { ascending: false });

    // Sin esto, un error de la consulta se ve igual que "no hay nada": la tabla
    // sale vacía y manda a buscar el problema al lugar equivocado.
    if (err) {
      console.error('[Bitácora] no se pudo cargar:', err);
      setError(err.message);
      setFilas([]);
    } else {
      setFilas((data ?? []) as BitacoraRow[]);
    }
    setCargando(false);
  }, [usuario]);

  useEffect(() => { cargar(); }, [cargar]);

  const oficinas = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of filas) if (f.oficina_id && f.oficina_nombre) m.set(f.oficina_id, f.oficina_nombre);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [filas]);

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return filas.filter(f =>
      (!filtroModulo  || f.modulo === filtroModulo) &&
      (!filtroOficina || f.oficina_id === filtroOficina) &&
      (!filtroEstado  || f.estado_pago === filtroEstado) &&
      (!q || [f.folio, f.solicitante_nombre, f.responsable_nombre, f.oficina_nombre]
              .some(v => normalizarTexto(v).includes(q))),
    );
  }, [filas, busqueda, filtroModulo, filtroOficina, filtroEstado]);

  const totales = useMemo(() => ({
    monto:  visibles.reduce((s, f) => s + Number(f.monto ?? 0), 0),
    pagado: visibles.reduce((s, f) => s + Number(f.pagado ?? 0), 0),
    saldo:  visibles.reduce((s, f) => s + Number(f.saldo ?? 0), 0),
  }), [visibles]);

  const paraExportar = () => visibles.map(f => ({
    Módulo: ETIQUETA_MODULO[f.modulo],
    Folio: f.folio ?? '',
    Fecha: new Date(f.fecha).toLocaleDateString('es-MX'),
    Solicitante: f.solicitante_nombre ?? '',
    Oficina: f.oficina_nombre ?? '',
    Responsable: f.responsable_nombre ?? '',
    Cantidad: f.cantidad,
    'Forma de pago': f.forma_pago ?? '',
    'Método de pago': f.metodo_pago ?? '',
    Monto: Number(f.monto ?? 0),
    Pagado: Number(f.pagado ?? 0),
    Saldo: Number(f.saldo ?? 0),
    Estado: ETIQUETA_ESTADO[f.estado_pago]?.texto ?? f.estado_pago,
    Activo: f.activo ? 'Sí' : 'No',
  }));

  const nombreArchivo = `bitacora_comercial_${new Date().toISOString().slice(0, 10)}`;

  const exportarXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paraExportar()), 'Bitácora');
    XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
  };

  const exportarCsv = () => {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(paraExportar()));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${nombreArchivo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (permitidos.length === 0 && !cargando) {
    return <p className="text-sm text-neutral-500 p-6">No tienes acceso a la bitácora.</p>;
  }

  const selectCls = 'px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-accent/20';

  return (
    <div className="bg-surface-card dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-white/10 overflow-hidden">
      <div className="p-5 border-b border-neutral-100 dark:border-white/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Bitácora comercial</h2>
            <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">
              Pedidos de MOVI Store y periodos de Marketing Premium. Haz clic en una fila para ir a su control de pagos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportarXlsx} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button onClick={exportarCsv} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5">
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Folio, solicitante, responsable u oficina..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* El filtro de módulo solo aparece si de verdad se puede ver más de uno. */}
          {permitidos.length > 1 && (
            <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value as '' | ModuloBitacora)} className={selectCls}>
              <option value="">Store y Marketing Premium</option>
              <option value="store">Solo MOVI Store</option>
              <option value="premium">Solo Marketing Premium</option>
            </select>
          )}

          <select value={filtroOficina} onChange={e => setFiltroOficina(e.target.value)} className={selectCls}>
            <option value="">Todas las oficinas</option>
            {oficinas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>

          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={selectCls}>
            <option value="">Cualquier estado de pago</option>
            <option value="debe">Debe</option>
            <option value="al_corriente">Al corriente</option>
            <option value="a_favor">A favor</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500 dark:text-white/50">
          <span>{visibles.length} de {filas.length} registros</span>
          <span>Monto: <strong className="text-neutral-700 dark:text-white/80">{pesos(totales.monto)}</strong></span>
          <span>Pagado: <strong className="text-emerald-600">{pesos(totales.pagado)}</strong></span>
          <span>Saldo: <strong className="text-amber-600">{pesos(totales.saldo)}</strong></span>
        </div>
      </div>

      {error && (
        <div className="m-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          No se pudo cargar la bitácora: {error}
        </div>
      )}

      {cargando ? (
        <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
              <tr className="text-left text-xs font-medium text-neutral-500 uppercase">
                <th className="px-5 py-3">Módulo</th>
                <th className="px-5 py-3">Folio</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Oficina</th>
                <th className="px-5 py-3 text-center">Cant.</th>
                <th className="px-5 py-3">Forma de pago</th>
                <th className="px-5 py-3 text-right">Monto</th>
                <th className="px-5 py-3 text-right">Pagado / Saldo</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {visibles.map(f => {
                const estado = ETIQUETA_ESTADO[f.estado_pago] ?? { texto: f.estado_pago, clase: 'bg-neutral-100 text-neutral-500' };
                return (
                  <tr
                    key={`${f.modulo}-${f.id}`}
                    onClick={() => setFilaAbierta(f)}
                    className="hover:bg-neutral-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${f.modulo === 'store' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                        {ETIQUETA_MODULO[f.modulo]}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-neutral-700 dark:text-white/80">{f.folio ?? '—'}</td>
                    <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{new Date(f.fecha).toLocaleDateString('es-MX')}</td>
                    <td className="px-5 py-3 text-neutral-800 dark:text-white/90">{f.solicitante_nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-neutral-500">{f.oficina_nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-center text-neutral-600">{f.cantidad}</td>
                    <td className="px-5 py-3 text-neutral-600">{f.forma_pago ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-neutral-800 dark:text-white/90">{pesos(Number(f.monto ?? 0))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-neutral-500">
                      {pesos(Number(f.pagado ?? 0))} <span className="text-neutral-300">/</span> {pesos(Number(f.saldo ?? 0))}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${estado.clase}`}>{estado.texto}</span>
                    </td>
                    <td className="px-5 py-3 text-neutral-300"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                );
              })}
              {visibles.length === 0 && !error && (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-neutral-400">Sin registros que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {filaAbierta && (
        <ModalPagosBitacora
          row={filaAbierta}
          onCerrar={() => { setFilaAbierta(null); cargar(); }}
        />
      )}
    </div>
  );
}

export default BitacoraComercial;
