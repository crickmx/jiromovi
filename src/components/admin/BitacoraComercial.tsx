// Tabla de bitácora compartida entre MOVI Store y Marketing Premium.
//
// Mismo criterio que TriggersPanel.tsx: un solo componente, un objeto de
// configuración por módulo (ver src/lib/bitacoraConfig.ts). El permiso de
// quién la ve es el MISMO que ya usa el admin de cada módulo -- no se crea
// ninguna regla nueva. Los datos salen de una vista de BD por módulo
// (security_invoker=true), así que la RLS real de cada tabla sigue
// aplicando tal cual.

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { pesos } from '../../lib/cobroDesglose';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { normalizarTexto } from '../../lib/utils';
import type { ConfigBitacora, BitacoraRow } from '../../lib/bitacoraConfig';

const ESTADO_BADGE: Record<BitacoraRow['estado_pago'], { label: string; clase: string }> = {
  al_corriente: { label: 'Al corriente', clase: 'bg-green-100 text-green-700' },
  debe:         { label: 'Debe',         clase: 'bg-amber-100 text-amber-700' },
  a_favor:      { label: 'A favor',      clase: 'bg-blue-100 text-blue-700' },
  sin_plan:     { label: 'Sin plan',     clase: 'bg-neutral-100 text-neutral-500' },
  sin_monto:    { label: 'Sin monto',    clase: 'bg-neutral-100 text-neutral-500' },
};

function soloFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function BitacoraComercial({ config }: { config: ConfigBitacora }) {
  const { usuario } = useAuth();
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<BitacoraRow[]>([]);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    (async () => {
      if (!usuario) { setVerificandoAcceso(false); return; }
      const acceso = await config.tieneAcceso(usuario);
      setTieneAcceso(acceso);
      setVerificandoAcceso(false);
    })();
  }, [usuario?.id, config]);

  useEffect(() => {
    if (!tieneAcceso) return;
    setLoading(true);
    supabase.from(config.vista).select('*').order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(`[BitacoraComercial:${config.vista}]`, error);
        setFilas((data ?? []) as BitacoraRow[]);
        setLoading(false);
      });
  }, [tieneAcceso, config.vista]);

  const filasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    if (!termino) return filas;
    return filas.filter(f =>
      normalizarTexto(f.folio ?? '').includes(termino) ||
      normalizarTexto(f.solicitante_nombre ?? '').includes(termino) ||
      normalizarTexto(f.responsable_nombre ?? '').includes(termino)
    );
  }, [filas, busqueda]);

  const filasParaExportar = () => filasFiltradas.map(f => ({
    [config.labelFolio]: f.folio,
    'Fecha': soloFecha(f.fecha),
    'Agente Solicitante': f.solicitante_nombre ?? '',
    'Responsable': f.responsable_nombre ?? '',
    [config.labelCantidad]: f.cantidad,
    [config.labelFormaPago]: f.forma_pago ?? '',
    'Método de pago': f.metodo_pago ?? '',
    'Monto': f.monto,
    'Pagado': f.pagado,
    'Saldo': f.saldo,
    'Estado': ESTADO_BADGE[f.estado_pago]?.label ?? f.estado_pago,
    ...(config.mostrarActivo ? { 'Activo': f.activo ? 'Sí' : 'No' } : {}),
  }));

  const exportarXlsx = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filasParaExportar());
    XLSX.utils.book_append_sheet(wb, ws, 'Bitácora');
    XLSX.writeFile(wb, `${config.nombreArchivoExport}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarCsv = () => {
    const ws = XLSX.utils.json_to_sheet(filasParaExportar());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.nombreArchivoExport}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (verificandoAcceso) return null;
  if (!tieneAcceso) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={config.titulo} description={config.descripcion} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar folio, solicitante o responsable..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 dark:border-white/10 rounded-xl bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarXlsx}
            disabled={filasFiltradas.length === 0}
            className="flex items-center gap-2 text-xs px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={exportarCsv}
            disabled={filasFiltradas.length === 0}
            className="flex items-center gap-2 text-xs px-3 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filasFiltradas.length === 0 ? (
        <EmptyState title="Sin registros" description="No hay nada que mostrar con los filtros actuales." />
      ) : (
        <div className="overflow-x-auto border border-neutral-200 dark:border-white/10 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-500 dark:text-white/55 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">{config.labelFolio}</th>
                <th className="px-3 py-2.5 text-left">Fecha</th>
                <th className="px-3 py-2.5 text-left">Agente Solicitante</th>
                <th className="px-3 py-2.5 text-left">Responsable</th>
                <th className="px-3 py-2.5 text-right">{config.labelCantidad}</th>
                <th className="px-3 py-2.5 text-left">{config.labelFormaPago}</th>
                <th className="px-3 py-2.5 text-right">Pagado / Saldo</th>
                <th className="px-3 py-2.5 text-left">Estado</th>
                {config.mostrarActivo && <th className="px-3 py-2.5 text-left">Activo</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {filasFiltradas.map(f => {
                const badge = ESTADO_BADGE[f.estado_pago] ?? ESTADO_BADGE.sin_monto;
                return (
                  <tr key={f.id} className="hover:bg-neutral-50 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5 font-mono text-xs">{f.folio}</td>
                    <td className="px-3 py-2.5 text-neutral-600 dark:text-white/70">{soloFecha(f.fecha)}</td>
                    <td className="px-3 py-2.5">{f.solicitante_nombre ?? '—'}</td>
                    <td className="px-3 py-2.5">{f.responsable_nombre ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">{f.cantidad}</td>
                    <td className="px-3 py-2.5">{f.forma_pago ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-medium">{pesos(f.pagado)}</span>
                      <span className="text-neutral-400"> / {pesos(f.saldo)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.clase}`}>{badge.label}</span>
                    </td>
                    {config.mostrarActivo && (
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${f.activo ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {f.activo ? 'Activo' : 'Cerrado'}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BitacoraComercial;
