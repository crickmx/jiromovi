import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Receipt, Target, Plus, Trash2, Calendar, BarChart3, PieChart
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { supabase } from '../lib/supabase';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import type { StoreGastoGeneral, StoreMetaUtilidad } from '../lib/storeTypes';
import { TIPO_GASTO_OPTIONS } from '../lib/storeTypes';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

type PeriodoFiltro = 'este_mes' | 'mes_anterior' | 'anio' | 'personalizado';

interface ResumenFinanciero {
  ingresosTotales: number;
  costoProductos: number;
  gastosOperativos: number;
  gastosGenerales: number;
  gananciaNeta: number;
  margen: number;
  pedidosCount: number;
  pedidosCobrados: number;
}

interface ProductoRentabilidad {
  titulo: string;
  categoria: string;
  unidadesVendidas: number;
  ingresos: number;
  costos: number;
  ganancia: number;
  margen: number;
}

export default function StorePedidosReporte() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('este_mes');
  const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  const [resumen, setResumen] = useState<ResumenFinanciero>({
    ingresosTotales: 0,
    costoProductos: 0,
    gastosOperativos: 0,
    gastosGenerales: 0,
    gananciaNeta: 0,
    margen: 0,
    pedidosCount: 0,
    pedidosCobrados: 0,
  });

  const [topProductos, setTopProductos] = useState<ProductoRentabilidad[]>([]);
  const [gastosPorTipo, setGastosPorTipo] = useState<Record<string, number>>({});

  const [metas, setMetas] = useState<StoreMetaUtilidad[]>([]);
  const [gastosGenerales, setGastosGenerales] = useState<StoreGastoGeneral[]>([]);

  const [showNuevaMeta, setShowNuevaMeta] = useState(false);
  const [showNuevoGasto, setShowNuevoGasto] = useState(false);
  const [nuevaMeta, setNuevaMeta] = useState({ nombre: '', descripcion: '', monto_objetivo: 0, fecha_inicio: '', fecha_fin: '' });
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', tipo: 'otro', descripcion: '', monto: 0, fecha: format(new Date(), 'yyyy-MM-dd') });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tienePermisoAdminEnModulo(usuario, MODULOS.STORE)) {
      navigate('/store');
      return;
    }
    actualizarFechasPorPeriodo(periodo);
  }, [usuario]);

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin]);

  function actualizarFechasPorPeriodo(p: PeriodoFiltro) {
    const hoy = new Date();
    switch (p) {
      case 'este_mes':
        setFechaInicio(format(startOfMonth(hoy), 'yyyy-MM-dd'));
        setFechaFin(format(endOfMonth(hoy), 'yyyy-MM-dd'));
        break;
      case 'mes_anterior':
        const mesAnt = subMonths(hoy, 1);
        setFechaInicio(format(startOfMonth(mesAnt), 'yyyy-MM-dd'));
        setFechaFin(format(endOfMonth(mesAnt), 'yyyy-MM-dd'));
        break;
      case 'anio':
        setFechaInicio(format(startOfYear(hoy), 'yyyy-MM-dd'));
        setFechaFin(format(endOfYear(hoy), 'yyyy-MM-dd'));
        break;
      case 'personalizado':
        break;
    }
  }

  async function cargarDatos() {
    setLoading(true);
    try {
      await Promise.all([
        cargarResumenFinanciero(),
        cargarTopProductos(),
        cargarMetas(),
        cargarGastosGenerales(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarResumenFinanciero() {
    const { data: pedidos } = await supabase
      .from('store_pedidos')
      .select('id, cobrado, created_at')
      .gte('created_at', fechaInicio + 'T00:00:00')
      .lte('created_at', fechaFin + 'T23:59:59');

    if (!pedidos || pedidos.length === 0) {
      setResumen({ ingresosTotales: 0, costoProductos: 0, gastosOperativos: 0, gastosGenerales: 0, gananciaNeta: 0, margen: 0, pedidosCount: 0, pedidosCobrados: 0 });
      setGastosPorTipo({});
      return;
    }

    const pedidoIds = pedidos.map(p => p.id);

    const { data: detalles } = await supabase
      .from('store_pedidos_detalle')
      .select('pedido_id, cantidad, precio_unitario, costo_unitario_override, producto_id')
      .in('pedido_id', pedidoIds);

    const { data: productosData } = await supabase
      .from('store_productos')
      .select('id, costo_base');

    const costoBaseMap = new Map<string, number>();
    productosData?.forEach(p => costoBaseMap.set(p.id, p.costo_base || 0));

    let ingresosTotales = 0;
    let costoProductos = 0;

    detalles?.forEach(d => {
      const precio = typeof d.precio_unitario === 'string' ? parseFloat(d.precio_unitario) : (d.precio_unitario || 0);
      const costo = d.costo_unitario_override || costoBaseMap.get(d.producto_id) || 0;
      ingresosTotales += d.cantidad * precio;
      costoProductos += d.cantidad * costo;
    });

    const { data: gastosOp } = await supabase
      .from('store_pedido_gastos')
      .select('monto, tipo')
      .in('pedido_id', pedidoIds);

    let gastosOperativos = 0;
    const tipoAcumulado: Record<string, number> = {};
    gastosOp?.forEach(g => {
      const monto = typeof g.monto === 'string' ? parseFloat(g.monto) : (g.monto || 0);
      gastosOperativos += monto;
      tipoAcumulado[g.tipo] = (tipoAcumulado[g.tipo] || 0) + monto;
    });

    const { data: gastosDetalle } = await supabase
      .from('store_pedido_detalle_gastos')
      .select('monto, tipo, detalle_id');

    const detalleIdsSet = new Set(detalles?.map(d => d.pedido_id ? `${d.pedido_id}` : ''));
    gastosDetalle?.forEach(g => {
      const monto = typeof g.monto === 'string' ? parseFloat(g.monto) : (g.monto || 0);
      gastosOperativos += monto;
      tipoAcumulado[g.tipo] = (tipoAcumulado[g.tipo] || 0) + monto;
    });

    const { data: gastosGen } = await supabase
      .from('store_gastos_generales')
      .select('monto, tipo')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin);

    let gastosGeneralesTotal = 0;
    gastosGen?.forEach(g => {
      const monto = typeof g.monto === 'string' ? parseFloat(g.monto) : (g.monto || 0);
      gastosGeneralesTotal += monto;
      tipoAcumulado[g.tipo] = (tipoAcumulado[g.tipo] || 0) + monto;
    });

    const gananciaNeta = ingresosTotales - costoProductos - gastosOperativos - gastosGeneralesTotal;
    const margen = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;

    setResumen({
      ingresosTotales,
      costoProductos,
      gastosOperativos,
      gastosGenerales: gastosGeneralesTotal,
      gananciaNeta,
      margen,
      pedidosCount: pedidos.length,
      pedidosCobrados: pedidos.filter(p => p.cobrado).length,
    });

    setGastosPorTipo(tipoAcumulado);
  }

  async function cargarTopProductos() {
    const { data: pedidos } = await supabase
      .from('store_pedidos')
      .select('id')
      .gte('created_at', fechaInicio + 'T00:00:00')
      .lte('created_at', fechaFin + 'T23:59:59');

    if (!pedidos || pedidos.length === 0) {
      setTopProductos([]);
      return;
    }

    const pedidoIds = pedidos.map(p => p.id);

    const { data: detalles } = await supabase
      .from('store_pedidos_detalle')
      .select('producto_id, cantidad, precio_unitario, costo_unitario_override')
      .in('pedido_id', pedidoIds);

    const { data: productosData } = await supabase
      .from('store_productos')
      .select('id, titulo, costo_base, categoria:store_categorias(nombre)');

    const productosMap = new Map<string, any>();
    productosData?.forEach(p => productosMap.set(p.id, p));

    const acumulado = new Map<string, { unidades: number; ingresos: number; costos: number }>();

    detalles?.forEach(d => {
      const prev = acumulado.get(d.producto_id) || { unidades: 0, ingresos: 0, costos: 0 };
      const precio = typeof d.precio_unitario === 'string' ? parseFloat(d.precio_unitario) : (d.precio_unitario || 0);
      const prod = productosMap.get(d.producto_id);
      const costo = d.costo_unitario_override || prod?.costo_base || 0;

      prev.unidades += d.cantidad;
      prev.ingresos += d.cantidad * precio;
      prev.costos += d.cantidad * costo;
      acumulado.set(d.producto_id, prev);
    });

    const productos: ProductoRentabilidad[] = Array.from(acumulado.entries()).map(([id, data]) => {
      const prod = productosMap.get(id);
      const ganancia = data.ingresos - data.costos;
      return {
        titulo: prod?.titulo || 'Producto eliminado',
        categoria: (prod?.categoria as any)?.nombre || 'Sin categoria',
        unidadesVendidas: data.unidades,
        ingresos: data.ingresos,
        costos: data.costos,
        ganancia,
        margen: data.ingresos > 0 ? (ganancia / data.ingresos) * 100 : 0,
      };
    });

    productos.sort((a, b) => b.ganancia - a.ganancia);
    setTopProductos(productos.slice(0, 10));
  }

  async function cargarMetas() {
    const { data } = await supabase
      .from('store_metas_utilidad')
      .select('*')
      .eq('activa', true)
      .order('fecha_fin', { ascending: true });

    setMetas(data || []);
  }

  async function cargarGastosGenerales() {
    const { data } = await supabase
      .from('store_gastos_generales')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false });

    setGastosGenerales(data || []);
  }

  async function guardarMeta() {
    if (!nuevaMeta.nombre || !nuevaMeta.monto_objetivo || !nuevaMeta.fecha_inicio || !nuevaMeta.fecha_fin) return;
    setSaving(true);
    try {
      await supabase.from('store_metas_utilidad').insert({
        nombre: nuevaMeta.nombre,
        descripcion: nuevaMeta.descripcion || null,
        monto_objetivo: nuevaMeta.monto_objetivo,
        fecha_inicio: nuevaMeta.fecha_inicio,
        fecha_fin: nuevaMeta.fecha_fin,
        activa: true,
        creado_por: usuario?.id,
      });
      setShowNuevaMeta(false);
      setNuevaMeta({ nombre: '', descripcion: '', monto_objetivo: 0, fecha_inicio: '', fecha_fin: '' });
      await cargarMetas();
    } finally {
      setSaving(false);
    }
  }

  async function eliminarMeta(id: string) {
    await supabase.from('store_metas_utilidad').update({ activa: false }).eq('id', id);
    await cargarMetas();
  }

  async function guardarGasto() {
    if (!nuevoGasto.concepto || !nuevoGasto.monto || !nuevoGasto.fecha) return;
    setSaving(true);
    try {
      await supabase.from('store_gastos_generales').insert({
        concepto: nuevoGasto.concepto,
        tipo: nuevoGasto.tipo,
        descripcion: nuevoGasto.descripcion || null,
        monto: nuevoGasto.monto,
        fecha: nuevoGasto.fecha,
        creado_por: usuario?.id,
      });
      setShowNuevoGasto(false);
      setNuevoGasto({ concepto: '', tipo: 'otro', descripcion: '', monto: 0, fecha: format(new Date(), 'yyyy-MM-dd') });
      await Promise.all([cargarGastosGenerales(), cargarResumenFinanciero()]);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarGasto(id: string) {
    await supabase.from('store_gastos_generales').delete().eq('id', id);
    await Promise.all([cargarGastosGenerales(), cargarResumenFinanciero()]);
  }

  function formatMoney(val: number) {
    return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calcularProgresoMeta(meta: StoreMetaUtilidad): number {
    return resumen.gananciaNeta > 0
      ? Math.min((resumen.gananciaNeta / meta.monto_objetivo) * 100, 100)
      : 0;
  }

  function diasRestantes(fechaFin: string): number {
    const diff = new Date(fechaFin).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Reporte de Ganancias"
          description="Análisis financiero de MOVI Store"
          icon={BarChart3}
          backTo="/store/pedidos"
          backLabel="Volver a Pedidos"
          className="mb-6"
        />

        {/* Filtros de periodo */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="w-5 h-5 text-neutral-500 dark:text-white/50" />
            {(['este_mes', 'mes_anterior', 'anio', 'personalizado'] as PeriodoFiltro[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriodo(p); actualizarFechasPorPeriodo(p); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodo === p
                    ? 'bg-accent text-white'
                    : 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
                }`}
              >
                {p === 'este_mes' ? 'Este Mes' : p === 'mes_anterior' ? 'Mes Anterior' : p === 'anio' ? 'Este Anio' : 'Personalizado'}
              </button>
            ))}
            {periodo === 'personalizado' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="px-3 py-1.5 border border-neutral-300 dark:border-white/20 rounded-lg text-sm"
                />
                <span className="text-neutral-500 dark:text-white/50">a</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="px-3 py-1.5 border border-neutral-300 dark:border-white/20 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-500 dark:text-white/50">Ingresos Totales</p>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatMoney(resumen.ingresosTotales)}</p>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">{resumen.pedidosCount} pedidos | {resumen.pedidosCobrados} cobrados</p>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-500 dark:text-white/50">Costo de Productos</p>
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatMoney(resumen.costoProductos)}</p>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">
              {resumen.ingresosTotales > 0 ? ((resumen.costoProductos / resumen.ingresosTotales) * 100).toFixed(1) : 0}% de ingresos
            </p>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-500 dark:text-white/50">Gastos Totales</p>
              <Receipt className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatMoney(resumen.gastosOperativos + resumen.gastosGenerales)}</p>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">
              Operativos: {formatMoney(resumen.gastosOperativos)} | Generales: {formatMoney(resumen.gastosGenerales)}
            </p>
          </div>

          <div className={`bg-white rounded-xl border p-6 ${resumen.gananciaNeta >= 0 ? 'border-green-200' : 'border-red-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-500 dark:text-white/50">Ganancia Neta</p>
              {resumen.gananciaNeta >= 0
                ? <TrendingUp className="w-5 h-5 text-green-600" />
                : <TrendingDown className="w-5 h-5 text-red-600" />
              }
            </div>
            <p className={`text-2xl font-bold ${resumen.gananciaNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatMoney(resumen.gananciaNeta)}
            </p>
            <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">Margen: {resumen.margen.toFixed(1)}%</p>
          </div>
        </div>

        {/* P&L Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Estado de Resultados</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5">
                <span className="text-sm text-neutral-700 dark:text-white/70 font-medium">Ingresos por Ventas</span>
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">{formatMoney(resumen.ingresosTotales)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 pl-4">
                <span className="text-sm text-neutral-500 dark:text-white/50">(-) Costo de Productos Vendidos</span>
                <span className="text-sm text-red-600">{formatMoney(resumen.costoProductos)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-3 rounded">
                <span className="text-sm font-semibold text-neutral-700 dark:text-white/70">= Utilidad Bruta</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{formatMoney(resumen.ingresosTotales - resumen.costoProductos)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 pl-4">
                <span className="text-sm text-neutral-500 dark:text-white/50">(-) Gastos por Pedido</span>
                <span className="text-sm text-red-600">{formatMoney(resumen.gastosOperativos)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-white/5 pl-4">
                <span className="text-sm text-neutral-500 dark:text-white/50">(-) Gastos Generales del Negocio</span>
                <span className="text-sm text-red-600">{formatMoney(resumen.gastosGenerales)}</span>
              </div>
              <div className={`flex justify-between items-center py-3 px-3 rounded-lg ${resumen.gananciaNeta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">= GANANCIA NETA</span>
                <span className={`text-base font-bold ${resumen.gananciaNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMoney(resumen.gananciaNeta)}
                </span>
              </div>
            </div>
          </div>

          {/* Gastos por Tipo */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
            <div className="flex items-center gap-2 mb-5">
              <PieChart className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Desglose de Gastos</h2>
            </div>
            {Object.keys(gastosPorTipo).length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-white/50">
                <Receipt className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/30" />
                <p className="text-sm">Sin gastos en este periodo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(gastosPorTipo)
                  .sort(([,a], [,b]) => b - a)
                  .map(([tipo, monto]) => {
                    const totalGastos = resumen.gastosOperativos + resumen.gastosGenerales;
                    const porcentaje = totalGastos > 0 ? (monto / totalGastos) * 100 : 0;
                    const label = TIPO_GASTO_OPTIONS.find(o => o.value === tipo)?.label || tipo;
                    return (
                      <div key={tipo}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-neutral-700 dark:text-white/70">{label}</span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-white">{formatMoney(monto)}</span>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-white/10 rounded-full h-2">
                          <div
                            className="bg-accent rounded-full h-2 transition-all duration-300"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-neutral-400 dark:text-white/40 mt-0.5">{porcentaje.toFixed(1)}%</p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Top Productos */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Top Productos por Ganancia</h2>
          {topProductos.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-white/50">
              <Package className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/30" />
              <p className="text-sm">Sin datos de productos en este periodo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
                <thead className="bg-neutral-50 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Uds</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Ingresos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Costos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Ganancia</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                  {topProductos.map((prod, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:bg-white/5">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">{prod.titulo}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500 dark:text-white/50">{prod.categoria}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-white/70 text-right">{prod.unidadesVendidas}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-white/70 text-right">{formatMoney(prod.ingresos)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-white/70 text-right">{formatMoney(prod.costos)}</td>
                      <td className={`px-4 py-3 text-sm font-semibold text-right ${prod.ganancia >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatMoney(prod.ganancia)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          prod.margen >= 30 ? 'bg-green-100 text-green-800' :
                          prod.margen >= 10 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {prod.margen.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gastos Generales */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Gastos Generales del Negocio</h2>
            <button
              onClick={() => setShowNuevoGasto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Gasto
            </button>
          </div>
          {gastosGenerales.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-white/50 text-center py-6">Sin gastos generales en este periodo</p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-white/5">
              {gastosGenerales.map(g => (
                <div key={g.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{g.concepto}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/50">
                      {TIPO_GASTO_OPTIONS.find(o => o.value === g.tipo)?.label || g.tipo}
                      {g.descripcion && ` - ${g.descripcion}`}
                      {' | '}{format(new Date(g.fecha), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">{formatMoney(g.monto)}</span>
                    <button
                      onClick={() => eliminarGasto(g.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metas de Utilidad */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Metas de Utilidad</h2>
            </div>
            <button
              onClick={() => setShowNuevaMeta(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva Meta
            </button>
          </div>
          {metas.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-white/50">
              <Target className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-white/30" />
              <p className="text-sm">Sin metas activas. Define una meta de utilidad para dar seguimiento.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {metas.map(meta => {
                const progreso = calcularProgresoMeta(meta);
                const dias = diasRestantes(meta.fecha_fin);
                const completada = progreso >= 100;
                return (
                  <div key={meta.id} className={`border rounded-lg p-4 ${completada ? 'border-green-300 bg-green-50' : 'border-neutral-200 dark:border-white/10'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                          {meta.nombre}
                          {completada && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-200 text-green-800">
                              LOGRADA
                            </span>
                          )}
                        </h3>
                        {meta.descripcion && <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">{meta.descripcion}</p>}
                      </div>
                      <button onClick={() => eliminarMeta(meta.id)} className="text-neutral-400 dark:text-white/40 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-white/50 mb-2">
                      <span>
                        {format(new Date(meta.fecha_inicio), 'd MMM', { locale: es })} - {format(new Date(meta.fecha_fin), 'd MMM yyyy', { locale: es })}
                      </span>
                      <span>{dias > 0 ? `${dias} dias restantes` : 'Periodo finalizado'}</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-white/15 rounded-full h-3 mb-1">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${completada ? 'bg-green-500' : 'bg-accent'}`}
                        style={{ width: `${Math.min(progreso, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-600 dark:text-white/60">{formatMoney(resumen.gananciaNeta)} actual</span>
                      <span className="font-medium text-neutral-700 dark:text-white/70">Meta: {formatMoney(meta.monto_objetivo)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Gasto */}
      {showNuevoGasto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Nuevo Gasto General</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Concepto</label>
                <input
                  type="text"
                  value={nuevoGasto.concepto}
                  onChange={e => setNuevoGasto(prev => ({ ...prev, concepto: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  placeholder="Ej: Renta de bodega"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Tipo</label>
                  <select
                    value={nuevoGasto.tipo}
                    onChange={e => setNuevoGasto(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  >
                    {TIPO_GASTO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Monto</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={nuevoGasto.monto || ''}
                    onChange={e => setNuevoGasto(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Fecha</label>
                <input
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={e => setNuevoGasto(prev => ({ ...prev, fecha: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Descripcion (opcional)</label>
                <input
                  type="text"
                  value={nuevoGasto.descripcion}
                  onChange={e => setNuevoGasto(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  placeholder="Detalle adicional"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowNuevoGasto(false)}
                className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={guardarGasto}
                disabled={saving || !nuevoGasto.concepto || !nuevoGasto.monto}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-800 font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Meta */}
      {showNuevaMeta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Nueva Meta de Utilidad</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nuevaMeta.nombre}
                  onChange={e => setNuevaMeta(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  placeholder="Ej: Meta Mayo 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Monto Objetivo</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevaMeta.monto_objetivo || ''}
                  onChange={e => setNuevaMeta(prev => ({ ...prev, monto_objetivo: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  placeholder="$0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={nuevaMeta.fecha_inicio}
                    onChange={e => setNuevaMeta(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={nuevaMeta.fecha_fin}
                    onChange={e => setNuevaMeta(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">Descripcion (opcional)</label>
                <input
                  type="text"
                  value={nuevaMeta.descripcion}
                  onChange={e => setNuevaMeta(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-accent"
                  placeholder="Descripcion de la meta"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowNuevaMeta(false)}
                className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/15 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={guardarMeta}
                disabled={saving || !nuevaMeta.nombre || !nuevaMeta.monto_objetivo || !nuevaMeta.fecha_inicio || !nuevaMeta.fecha_fin}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-primary-800 font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear Meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
