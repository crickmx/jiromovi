import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, User, MapPin, FileText, Clock, MessageSquare, History, CreditCard, Download, Save, CheckCircle, Plus, X, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { obtenerPedidoCompleto, actualizarEstatusPedido, agregarNotaPedido, obtenerEstatus } from '../lib/storeUtils';
import type { StorePedidoCompleto, StoreEstatusPedido, FormaPagoOC, MetodoPagoOC, StorePedidoGasto, StorePedidoDetalleGasto } from '../lib/storeTypes';
import { TIPO_GASTO_OPTIONS } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generarFolioOC, generarPDFOrdenCompra, validarDatosPagoCompletos } from '../lib/storePdfOrdenCompra';
import { supabase } from '../lib/supabase';

export default function StorePedidoDetalle() {
  const { usuario } = useAuth();
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<StorePedidoCompleto | null>(null);
  const [estatus, setEstatus] = useState<StoreEstatusPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizandoEstatus, setActualizandoEstatus] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [agregandoNota, setAgregandoNota] = useState(false);

  // Payment fields
  const [responsablePagoId, setResponsablePagoId] = useState('');
  const [usuariosOficina, setUsuariosOficina] = useState<any[]>([]);
  const [formaPago, setFormaPago] = useState<FormaPagoOC | ''>('');
  const [metodoPago, setMetodoPago] = useState<MetodoPagoOC | ''>('');
  const [metodoPagoOtroDetalle, setMetodoPagoOtroDetalle] = useState('');
  const [observacionesOC, setObservacionesOC] = useState('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [generandoOC, setGenerandoOC] = useState(false);

  // Review & collection fields
  const [revisadoPor, setRevisadoPor] = useState('');
  const [cobrado, setCobrado] = useState(false);

  // Order expenses
  const [pedidoGastos, setPedidoGastos] = useState<StorePedidoGasto[]>([]);
  const [newGastoConcepto, setNewGastoConcepto] = useState('');
  const [newGastoTipo, setNewGastoTipo] = useState('otro');
  const [newGastoMonto, setNewGastoMonto] = useState('');

  // Line-item expenses
  const [detalleGastos, setDetalleGastos] = useState<Record<string, StorePedidoDetalleGasto[]>>({});
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [costoOverrides, setCostoOverrides] = useState<Record<string, string>>({});

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (pedidoId) cargarDatos();
  }, [pedidoId]);

  useEffect(() => {
    if (pedido) {
      setResponsablePagoId(pedido.responsable_pago_id || '');
      setFormaPago(pedido.forma_pago || '');
      setMetodoPago(pedido.metodo_pago || '');
      setMetodoPagoOtroDetalle(pedido.metodo_pago_otro_detalle || '');
      setObservacionesOC(pedido.observaciones_oc || '');
      setRevisadoPor(pedido.revisado_por || '');
      setCobrado(pedido.cobrado || false);
      cargarUsuariosOficina();
      if (isAdmin) {
        cargarGastosPedido();
        cargarGastosDetalle();
        const overrides: Record<string, string> = {};
        pedido.detalle.forEach(d => {
          if (d.costo_unitario_override != null) {
            overrides[d.id] = d.costo_unitario_override.toString();
          }
        });
        setCostoOverrides(overrides);
      }
    }
  }, [pedido]);

  const cargarUsuariosOficina = async () => {
    if (!pedido?.usuario_id) return;
    const { data: usuarioPedido } = await supabase
      .from('usuarios')
      .select('oficina_id')
      .eq('id', pedido.usuario_id)
      .maybeSingle();
    if (!usuarioPedido?.oficina_id) return;
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, nombre_completo')
      .eq('oficina_id', usuarioPedido.oficina_id)
      .eq('estado', 'activo')
      .order('nombre_completo');
    if (usuarios) setUsuariosOficina(usuarios);
  };

  const cargarGastosPedido = async () => {
    if (!pedidoId) return;
    const { data } = await supabase
      .from('store_pedido_gastos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('created_at');
    if (data) setPedidoGastos(data);
  };

  const cargarGastosDetalle = async () => {
    if (!pedido) return;
    const detalleIds = pedido.detalle.map(d => d.id);
    if (detalleIds.length === 0) return;
    const { data } = await supabase
      .from('store_pedido_detalle_gastos')
      .select('*')
      .in('detalle_id', detalleIds)
      .order('created_at');
    if (data) {
      const grouped: Record<string, StorePedidoDetalleGasto[]> = {};
      data.forEach(g => {
        if (!grouped[g.detalle_id]) grouped[g.detalle_id] = [];
        grouped[g.detalle_id].push(g);
      });
      setDetalleGastos(grouped);
    }
  };

  const cargarDatos = async () => {
    if (!pedidoId) return;
    try {
      setLoading(true);
      const [pedidoData, estatusData] = await Promise.all([
        obtenerPedidoCompleto(pedidoId),
        obtenerEstatus()
      ]);
      setPedido(pedidoData);
      setEstatus(estatusData);
    } catch (error) {
      console.error('Error cargando pedido:', error);
      navigate('/store/mis-pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstatus = async (nuevoEstatusId: string) => {
    if (!pedidoId || !isAdmin) return;
    if (!confirm('Cambiar el estatus de este pedido?')) return;
    try {
      setActualizandoEstatus(true);
      await actualizarEstatusPedido(pedidoId, nuevoEstatusId);
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando estatus:', error);
    } finally {
      setActualizandoEstatus(false);
    }
  };

  const handleAgregarNota = async () => {
    if (!pedidoId || !isAdmin || !nuevaNota.trim()) return;
    try {
      setAgregandoNota(true);
      await agregarNotaPedido(pedidoId, nuevaNota.trim());
      setNuevaNota('');
      await cargarDatos();
    } catch (error) {
      console.error('Error agregando nota:', error);
    } finally {
      setAgregandoNota(false);
    }
  };

  const handleGuardarRevision = async () => {
    if (!pedidoId || !isAdmin) return;
    const updates: any = { revisado_por: revisadoPor || null, cobrado };
    if (cobrado && !pedido?.cobrado) {
      updates.cobrado_en = new Date().toISOString();
      updates.cobrado_por = usuario?.id;
    }
    if (!cobrado) {
      updates.cobrado_en = null;
      updates.cobrado_por = null;
    }
    await supabase.from('store_pedidos').update(updates).eq('id', pedidoId);
    await cargarDatos();
  };

  const handleGuardarPago = async () => {
    if (!pedidoId || !isAdmin || !formaPago || !metodoPago) return;
    try {
      setGuardandoPago(true);
      await supabase.from('store_pedidos').update({
        responsable_pago_id: responsablePagoId || null,
        forma_pago: formaPago,
        metodo_pago: metodoPago,
        metodo_pago_otro_detalle: metodoPago === 'Otro' ? metodoPagoOtroDetalle : null,
        observaciones_oc: observacionesOC || null,
      }).eq('id', pedidoId);
      await cargarDatos();
    } catch (error) {
      console.error('Error guardando pago:', error);
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleDescargarOC = async () => {
    if (!pedidoId || !pedido || !isAdmin) return;
    const validacion = validarDatosPagoCompletos(pedido);
    if (!validacion.valido) {
      alert('Error: ' + validacion.errores.join('\n'));
      return;
    }
    try {
      setGenerandoOC(true);
      let folio = pedido.folio_oc;
      if (!folio) {
        folio = await generarFolioOC();
        await supabase.from('store_pedidos').update({
          folio_oc: folio,
          oc_generada_por: usuario?.id,
          oc_generada_en: new Date().toISOString(),
        }).eq('id', pedidoId);
        await cargarDatos();
      }
      await generarPDFOrdenCompra({ ...pedido, folio_oc: folio } as StorePedidoCompleto);
    } catch (error) {
      console.error('Error generando OC:', error);
    } finally {
      setGenerandoOC(false);
    }
  };

  // Expenses management
  const handleAddPedidoGasto = async () => {
    if (!pedidoId || !newGastoConcepto || !newGastoMonto) return;
    const { data } = await supabase
      .from('store_pedido_gastos')
      .insert({ pedido_id: pedidoId, concepto: newGastoConcepto, tipo: newGastoTipo, monto: parseFloat(newGastoMonto), creado_por: usuario?.id })
      .select().single();
    if (data) {
      setPedidoGastos(prev => [...prev, data]);
      setNewGastoConcepto('');
      setNewGastoTipo('otro');
      setNewGastoMonto('');
    }
  };

  const handleRemovePedidoGasto = async (id: string) => {
    await supabase.from('store_pedido_gastos').delete().eq('id', id);
    setPedidoGastos(prev => prev.filter(g => g.id !== id));
  };

  const handleAddDetalleGasto = async (detalleId: string, concepto: string, tipo: string, monto: string) => {
    if (!concepto || !monto) return;
    const { data } = await supabase
      .from('store_pedido_detalle_gastos')
      .insert({ detalle_id: detalleId, concepto, tipo, monto: parseFloat(monto), creado_por: usuario?.id })
      .select().single();
    if (data) {
      setDetalleGastos(prev => ({ ...prev, [detalleId]: [...(prev[detalleId] || []), data] }));
    }
  };

  const handleRemoveDetalleGasto = async (detalleId: string, gastoId: string) => {
    await supabase.from('store_pedido_detalle_gastos').delete().eq('id', gastoId);
    setDetalleGastos(prev => ({ ...prev, [detalleId]: (prev[detalleId] || []).filter(g => g.id !== gastoId) }));
  };

  const handleSaveCostoOverride = async (detalleId: string) => {
    const val = costoOverrides[detalleId];
    const numVal = val ? parseFloat(val) : null;
    await supabase.from('store_pedidos_detalle').update({ costo_unitario_override: numVal }).eq('id', detalleId);
  };

  // Calculations
  const calcularTotal = () => pedido?.detalle.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0) || 0;

  const calcularCostoProductos = () => {
    if (!pedido) return 0;
    return pedido.detalle.reduce((sum, item) => {
      const costo = item.costo_unitario_override ?? item.producto?.costo_base ?? 0;
      return sum + (costo * item.cantidad);
    }, 0);
  };

  const calcularGastosLineas = () => {
    return Object.values(detalleGastos).flat().reduce((sum, g) => sum + g.monto, 0);
  };

  const calcularGastosTotales = () => {
    return pedidoGastos.reduce((sum, g) => sum + g.monto, 0) + calcularGastosLineas();
  };

  const getEstatusColor = (estatusNombre: string) => {
    const colors: Record<string, string> = {
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Procesando': 'bg-blue-100 text-blue-800',
      'Enviado': 'bg-cyan-100 text-cyan-800',
      'Entregado': 'bg-green-100 text-green-800',
      'Cancelado': 'bg-red-100 text-red-800'
    };
    return colors[estatusNombre] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </Layout>
    );
  }

  if (!pedido) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Pedido no encontrado</p>
        </div>
      </Layout>
    );
  }

  const ingresos = calcularTotal();
  const costoProductos = calcularCostoProductos();
  const gastosTotales = calcularGastosTotales();
  const gananciaNeta = ingresos - costoProductos - gastosTotales;
  const margen = ingresos > 0 ? (gananciaNeta / ingresos) * 100 : 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(isAdmin ? '/store/pedidos' : '/store/mis-pedidos')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{isAdmin ? 'Volver a Pedidos' : 'Volver a Mis Pedidos'}</span>
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Detalle de Pedido</h1>
            <p className="text-gray-600 mt-1">
              Folio: {pedido.folio_oc ? (
                <span className="font-semibold text-accent">{pedido.folio_oc}</span>
              ) : (
                <span className="text-gray-400 italic">Pendiente de asignacion</span>
              )}
            </p>
          </div>
          <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${getEstatusColor(pedido.estatus?.nombre || 'Pendiente')}`}>
            {pedido.estatus?.nombre || 'Pendiente'}
          </span>
        </div>

        {/* Profitability KPIs - Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Ingresos</p>
              <p className="text-xl font-bold text-gray-900 mt-1">${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Costo Productos</p>
              <p className="text-xl font-bold text-gray-900 mt-1">${costoProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase">Gastos</p>
              <p className="text-xl font-bold text-amber-600 mt-1">${gastosTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`rounded-xl border p-4 ${gananciaNeta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase">Ganancia Neta</p>
              <p className={`text-xl font-bold mt-1 ${gananciaNeta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${gananciaNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-xs ${gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600'}`}>Margen: {margen.toFixed(1)}%</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Products section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
              </h2>
              <div className="space-y-4">
                {pedido.detalle.map(item => {
                  const lineGastos = detalleGastos[item.id] || [];
                  const expanded = expandedLines[item.id];
                  const costoUnit = item.costo_unitario_override ?? item.producto?.costo_base ?? 0;

                  return (
                    <div key={item.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex gap-4">
                        <img
                          src={item.producto?.imagen_url}
                          alt={item.producto?.titulo}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">{item.producto?.titulo}</h3>
                          <p className="text-sm text-gray-600 mt-0.5">Cantidad: {item.cantidad} x ${item.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                          {isAdmin && (
                            <div className="flex items-center gap-3 mt-1.5">
                              <label className="text-xs text-gray-500">Costo unit.:</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={costoOverrides[item.id] ?? costoUnit.toString()}
                                onChange={e => setCostoOverrides(prev => ({ ...prev, [item.id]: e.target.value }))}
                                onBlur={() => handleSaveCostoOverride(item.id)}
                                className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-md"
                              />
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            ${(item.precio_unitario * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          {isAdmin && costoUnit > 0 && (
                            <p className="text-xs text-gray-400">Costo: ${(costoUnit * item.cantidad).toFixed(2)}</p>
                          )}
                        </div>
                      </div>

                      {/* Line expenses toggle - Admin only */}
                      {isAdmin && (
                        <div className="mt-2 ml-20">
                          <button
                            onClick={() => setExpandedLines(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Gastos ({lineGastos.length})
                          </button>
                          {expanded && (
                            <LineGastosEditor
                              gastos={lineGastos}
                              detalleId={item.id}
                              onAdd={handleAddDetalleGasto}
                              onRemove={handleRemoveDetalleGasto}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-accent">
                    ${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Order-level expenses - Admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Gastos generales del pedido
                </h2>
                {pedidoGastos.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {pedidoGastos.map(g => (
                      <li key={g.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{g.concepto}</span>
                          <span className="text-xs text-gray-400 ml-2">({TIPO_GASTO_OPTIONS.find(t => t.value === g.tipo)?.label})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">${g.monto.toFixed(2)}</span>
                          <button onClick={() => handleRemovePedidoGasto(g.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 items-end">
                  <input type="text" value={newGastoConcepto} onChange={e => setNewGastoConcepto(e.target.value)} placeholder="Concepto" className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg" />
                  <select value={newGastoTipo} onChange={e => setNewGastoTipo(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg">
                    {TIPO_GASTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0" value={newGastoMonto} onChange={e => setNewGastoMonto(e.target.value)} placeholder="$0.00" className="w-24 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg" />
                  <button onClick={handleAddPedidoGasto} disabled={!newGastoConcepto || !newGastoMonto} className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm disabled:opacity-40"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            {/* History */}
            {pedido.historial && pedido.historial.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Cambios
                </h2>
                <div className="space-y-3">
                  {pedido.historial.map(item => (
                    <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          Cambio a: <span className="font-semibold">{item.estatus?.nombre}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {item.usuario && <p className="text-xs text-gray-500">Por: {item.usuario.nombre}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Client info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 mb-0.5">Nombre</p>
                  <p className="text-gray-700 font-semibold">{pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A'}</p>
                </div>
                {pedido.usuario?.nombre_sicas && (
                  <div>
                    <p className="font-medium text-gray-900 mb-0.5">SICAS</p>
                    <p className="text-gray-700">{pedido.usuario.nombre_sicas}</p>
                  </div>
                )}
                {pedido.usuario?.oficina && (
                  <div>
                    <p className="font-medium text-gray-900 mb-0.5">Oficina</p>
                    <p className="text-gray-700">{pedido.usuario.oficina}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    {format(new Date(pedido.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            {pedido.direccion_entrega && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Direccion de Entrega
                </h2>
                <p className="text-sm text-gray-600">{pedido.direccion_entrega}</p>
              </div>
            )}

            {pedido.notas_usuario && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notas del Cliente
                </h2>
                <p className="text-sm text-gray-600">{pedido.notas_usuario}</p>
              </div>
            )}

            {/* Review & Collection - Admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Revision y Cobro
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Revisado por:</p>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="revisado" value="mesa_control" checked={revisadoPor === 'mesa_control'} onChange={e => setRevisadoPor(e.target.value)} className="text-accent" />
                        <span className="text-sm">Mesa de control</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="revisado" value="descuento_nomina" checked={revisadoPor === 'descuento_nomina'} onChange={e => setRevisadoPor(e.target.value)} className="text-accent" />
                        <span className="text-sm">Descuento de nomina</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="revisado" value="" checked={revisadoPor === ''} onChange={() => setRevisadoPor('')} className="text-accent" />
                        <span className="text-sm text-gray-400">Sin revision</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={cobrado} onChange={e => setCobrado(e.target.checked)} className="w-4 h-4 text-accent rounded" />
                      <span className="text-sm font-medium text-gray-700">Cobrado</span>
                    </label>
                    {pedido.cobrado && pedido.cobrado_en && (
                      <p className="text-xs text-gray-400 mt-1 ml-7">
                        {format(new Date(pedido.cobrado_en), "d MMM yyyy HH:mm", { locale: es })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleGuardarRevision}
                    className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Guardar revision
                  </button>
                </div>
              </div>
            )}

            {/* Status change - Admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Estatus</h2>
                <select
                  value={pedido.estatus_id}
                  onChange={(e) => handleCambiarEstatus(e.target.value)}
                  disabled={actualizandoEstatus}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  {estatus.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Payment Info - Admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Informacion de Pago
                </h2>
                {pedido.folio_oc && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-semibold text-green-900">OC: {pedido.folio_oc}</p>
                  </div>
                )}
                <div className="space-y-3 mb-4">
                  {usuariosOficina.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Responsable de Pago</label>
                      <select value={responsablePagoId} onChange={e => setResponsablePagoId(e.target.value)} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg">
                        <option value="">Seleccionar...</option>
                        {usuariosOficina.map(u => <option key={u.id} value={u.id}>{u.nombre_completo || u.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pago *</label>
                    <select value={formaPago} onChange={e => setFormaPago(e.target.value as FormaPagoOC)} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg">
                      <option value="">Seleccionar...</option>
                      <option value="Contado">Contado</option>
                      <option value="Mensual">Mensual</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Metodo de Pago *</label>
                    <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPagoOC)} className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg">
                      <option value="">Seleccionar...</option>
                      <option value="Cargo a Oficina">Cargo a Oficina</option>
                      <option value="Cargo a Bono de Agente">Cargo a Bono de Agente</option>
                      <option value="Pago Directo">Pago Directo</option>
                      <option value="Descuento de Comisiones">Descuento de Comisiones</option>
                      <option value="Cargo a Nómina">Cargo a Nomina</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  {metodoPago === 'Otro' && (
                    <input type="text" value={metodoPagoOtroDetalle} onChange={e => setMetodoPagoOtroDetalle(e.target.value)} placeholder="Especificar..." className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg" />
                  )}
                  <textarea value={observacionesOC} onChange={e => setObservacionesOC(e.target.value)} placeholder="Observaciones..." className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg" rows={2} />
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={handleGuardarPago} disabled={guardandoPago || !formaPago || !metodoPago} className="w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />{guardandoPago ? 'Guardando...' : 'Guardar Pago'}
                  </button>
                  <button onClick={handleDescargarOC} disabled={generandoOC || !pedido.forma_pago} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />{generandoOC ? 'Generando...' : 'Descargar OC'}
                  </button>
                </div>
              </div>
            )}

            {/* Internal Notes - Admin only */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Notas Internas
                </h2>
                {pedido.notas && pedido.notas.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {pedido.notas.map(nota => (
                      <div key={nota.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-900">{nota.nota}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {nota.admin?.nombre} - {format(new Date(nota.created_at), "d MMM yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Agregar nota interna..." className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm" rows={2} />
                <button onClick={handleAgregarNota} disabled={agregandoNota || !nuevaNota.trim()} className="w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover text-sm font-medium disabled:opacity-50">
                  {agregandoNota ? 'Agregando...' : 'Agregar Nota'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Sub-component for line item expenses
function LineGastosEditor({ gastos, detalleId, onAdd, onRemove }: {
  gastos: StorePedidoDetalleGasto[];
  detalleId: string;
  onAdd: (detalleId: string, concepto: string, tipo: string, monto: string) => void;
  onRemove: (detalleId: string, gastoId: string) => void;
}) {
  const [concepto, setConcepto] = useState('');
  const [tipo, setTipo] = useState('otro');
  const [monto, setMonto] = useState('');

  const handleAdd = () => {
    onAdd(detalleId, concepto, tipo, monto);
    setConcepto('');
    setTipo('otro');
    setMonto('');
  };

  return (
    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-100">
      {gastos.map(g => (
        <div key={g.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
          <span>{g.concepto} <span className="text-gray-400">({TIPO_GASTO_OPTIONS.find(t => t.value === g.tipo)?.label})</span></span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">${g.monto.toFixed(2)}</span>
            <button onClick={() => onRemove(detalleId, g.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
          </div>
        </div>
      ))}
      <div className="flex gap-1.5 items-center">
        <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Gasto" className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded" />
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-1.5 py-1 text-xs border border-gray-200 rounded">
          {TIPO_GASTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="$" className="w-16 px-2 py-1 text-xs border border-gray-200 rounded" />
        <button onClick={handleAdd} disabled={!concepto || !monto} className="px-1.5 py-1 bg-accent text-white rounded text-xs disabled:opacity-40"><Plus className="w-3 h-3" /></button>
      </div>
    </div>
  );
}
