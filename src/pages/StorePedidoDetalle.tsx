import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, User, MapPin, FileText, Clock, MessageSquare, History, CreditCard, Download, Save, CheckCircle } from 'lucide-react';
import { obtenerPedidoCompleto, actualizarEstatusPedido, agregarNotaPedido, obtenerEstatus } from '../lib/storeUtils';
import type { StorePedidoCompleto, StoreEstatusPedido, FormaPagoOC, MetodoPagoOC } from '../lib/storeTypes';
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

  // Estados para Orden de Compra
  const [responsablePagoId, setResponsablePagoId] = useState('');
  const [usuariosOficina, setUsuariosOficina] = useState<any[]>([]);
  const [formaPago, setFormaPago] = useState<FormaPagoOC | ''>('');
  const [metodoPago, setMetodoPago] = useState<MetodoPagoOC | ''>('');
  const [metodoPagoOtroDetalle, setMetodoPagoOtroDetalle] = useState('');
  const [observacionesOC, setObservacionesOC] = useState('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [generandoOC, setGenerandoOC] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (pedidoId) {
      cargarDatos();
    }
  }, [pedidoId]);

  useEffect(() => {
    if (pedido) {
      setResponsablePagoId(pedido.responsable_pago_id || '');
      setFormaPago(pedido.forma_pago || '');
      setMetodoPago(pedido.metodo_pago || '');
      setMetodoPagoOtroDetalle(pedido.metodo_pago_otro_detalle || '');
      setObservacionesOC(pedido.observaciones_oc || '');
      cargarUsuariosOficina();
    }
  }, [pedido]);

  const cargarUsuariosOficina = async () => {
    if (!pedido?.usuario_id) return;

    try {
      const { data: usuarioPedido, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('oficina_id')
        .eq('id', pedido.usuario_id)
        .maybeSingle();

      if (errorUsuario || !usuarioPedido?.oficina_id) return;

      const { data: usuarios, error: errorUsuarios } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, nombre_completo')
        .eq('oficina_id', usuarioPedido.oficina_id)
        .eq('estado', 'activo')
        .order('nombre_completo');

      if (!errorUsuarios && usuarios) {
        setUsuariosOficina(usuarios);
      }
    } catch (error) {
      console.error('Error cargando usuarios de oficina:', error);
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
      alert('Error al cargar pedido');
      navigate('/store/mis-pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstatus = async (nuevoEstatusId: string) => {
    if (!pedidoId || !isAdmin) return;

    if (!confirm('¿Cambiar el estatus de este pedido?')) return;

    try {
      setActualizandoEstatus(true);
      await actualizarEstatusPedido(pedidoId, nuevoEstatusId);
      alert('Estatus actualizado exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error actualizando estatus:', error);
      alert('Error al actualizar estatus');
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
      alert('Nota agregada exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error agregando nota:', error);
      alert('Error al agregar nota');
    } finally {
      setAgregandoNota(false);
    }
  };

  const handleGuardarPago = async () => {
    if (!pedidoId || !isAdmin) return;

    if (!formaPago || !metodoPago) {
      alert('Debe seleccionar forma y método de pago');
      return;
    }

    if (metodoPago === 'Otro' && !metodoPagoOtroDetalle.trim()) {
      alert('Debe especificar el detalle del método de pago "Otro"');
      return;
    }

    try {
      setGuardandoPago(true);
      const { error } = await supabase
        .from('store_pedidos')
        .update({
          responsable_pago_id: responsablePagoId || null,
          forma_pago: formaPago,
          metodo_pago: metodoPago,
          metodo_pago_otro_detalle: metodoPago === 'Otro' ? metodoPagoOtroDetalle : null,
          observaciones_oc: observacionesOC || null,
        })
        .eq('id', pedidoId);

      if (error) throw error;

      alert('Información de pago guardada exitosamente');
      await cargarDatos();
    } catch (error) {
      console.error('Error guardando pago:', error);
      alert('Error al guardar información de pago');
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleDescargarOC = async () => {
    if (!pedidoId || !pedido || !isAdmin) return;

    // Validar que tenga datos de pago completos
    const validacion = validarDatosPagoCompletos(pedido);
    if (!validacion.valido) {
      alert('Error: ' + validacion.errores.join('\n'));
      return;
    }

    try {
      setGenerandoOC(true);

      // Generar folio si no existe
      let folio = pedido.folio_oc;
      if (!folio) {
        folio = await generarFolioOC();

        const { error } = await supabase
          .from('store_pedidos')
          .update({
            folio_oc: folio,
            oc_generada_por: usuario?.id,
            oc_generada_en: new Date().toISOString(),
          })
          .eq('id', pedidoId);

        if (error) throw error;

        // Recargar datos para obtener el folio
        await cargarDatos();
      }

      // Generar PDF con datos actualizados
      const pedidoActualizado = { ...pedido, folio_oc: folio };
      await generarPDFOrdenCompra(pedidoActualizado as StorePedidoCompleto);

      alert('Orden de Compra descargada exitosamente');
    } catch (error) {
      console.error('Error generando OC:', error);
      alert('Error al generar Orden de Compra');
    } finally {
      setGenerandoOC(false);
    }
  };

  const calcularTotal = () => {
    if (!pedido) return 0;
    return pedido.detalle.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  };

  const getEstatusColor = (estatusNombre: string) => {
    const colors: Record<string, string> = {
      'Pendiente': 'bg-yellow-100 text-yellow-800',
      'Procesando': 'bg-primary-100 text-primary-800',
      'Enviado': 'bg-purple-100 text-purple-800',
      'Entregado': 'bg-green-100 text-green-800',
      'Cancelado': 'bg-red-100 text-red-800'
    };
    return colors[estatusNombre] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
                <span className="font-semibold text-primary-600">{pedido.folio_oc}</span>
              ) : (
                <span className="text-gray-400 italic">Pendiente de asignación</span>
              )}
            </p>
          </div>
          <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${getEstatusColor(pedido.estatus?.nombre || 'Pendiente')}`}>
            {pedido.estatus?.nombre || 'Pendiente'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
              </h2>
              <div className="space-y-4">
                {pedido.detalle.map(item => (
                  <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <img
                      src={item.producto?.imagen_url}
                      alt={item.producto?.titulo}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.producto?.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">Cantidad: {item.cantidad}</p>
                      <p className="text-sm text-gray-600">Precio unitario: ${item.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${(item.precio_unitario * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-primary-600">
                    ${calcularTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {pedido.historial && pedido.historial.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Cambios
                </h2>
                <div className="space-y-3">
                  {pedido.historial.map(item => (
                    <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          Cambio a: <span className="font-semibold">{item.estatus?.nombre}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {item.usuario && (
                          <p className="text-xs text-gray-500">Por: {item.usuario.nombre}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 mb-1">
                    Nombre Completo
                    {isAdmin && pedido.usuario?.nombre_sicas && (
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        (Usuario SICAS: <span className="font-mono font-semibold text-primary-600">{pedido.usuario.nombre_sicas}</span>)
                      </span>
                    )}
                  </p>
                  <p className="text-gray-700">
                    {pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">Oficina</p>
                  <p className="text-gray-700">
                    {pedido.usuario?.oficina || 'Sin oficina asignada'}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">Teléfono</p>
                  <p className="text-gray-700">
                    {pedido.usuario?.telefono || 'Sin teléfono'}
                  </p>
                  {pedido.usuario?.celular_laboral && pedido.usuario?.celular_personal &&
                   pedido.usuario.celular_laboral !== pedido.usuario.celular_personal && (
                    <p className="text-xs text-gray-500 mt-1">
                      Personal: {pedido.usuario.celular_personal}
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="font-medium text-gray-900 mb-1">Fecha del Pedido</p>
                  <p className="text-gray-700">
                    {format(new Date(pedido.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            {pedido.direccion_entrega && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Entrega
                </h2>
                <p className="text-sm text-gray-600">{pedido.direccion_entrega}</p>
              </div>
            )}

            {pedido.notas_usuario && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notas del Cliente
                </h2>
                <p className="text-sm text-gray-600">{pedido.notas_usuario}</p>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Estatus</h2>
                <select
                  value={pedido.estatus_id}
                  onChange={(e) => handleCambiarEstatus(e.target.value)}
                  disabled={actualizandoEstatus}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {estatus.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Información de Pago
                </h2>

                {pedido.folio_oc && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-900">OC Generada</p>
                      <p className="text-xs text-green-700 font-mono">Folio: {pedido.folio_oc}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4 mb-4">
                  {usuariosOficina.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Responsable de Pago (opcional)
                      </label>
                      <select
                        value={responsablePagoId}
                        onChange={(e) => setResponsablePagoId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Seleccionar...</option>
                        {usuariosOficina.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre_completo || `${u.nombre} ${u.apellidos || ''}`.trim()}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Usuarios de la misma oficina del solicitante
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Forma de Pago *
                    </label>
                    <select
                      value={formaPago}
                      onChange={(e) => setFormaPago(e.target.value as FormaPagoOC)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Contado">Contado</option>
                      <option value="Mensual">Mensual</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Método de Pago *
                    </label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value as MetodoPagoOC)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Cargo a Oficina">Cargo a Oficina</option>
                      <option value="Cargo a Bono de Agente">Cargo a Bono de Agente</option>
                      <option value="Pago Directo">Pago Directo</option>
                      <option value="Descuento de Comisiones">Descuento de Comisiones</option>
                      <option value="Cargo a Nómina">Cargo a Nómina</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {metodoPago === 'Otro' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Especificar método *
                      </label>
                      <input
                        type="text"
                        value={metodoPagoOtroDetalle}
                        onChange={(e) => setMetodoPagoOtroDetalle(e.target.value)}
                        placeholder="Especifique el método de pago..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones (opcional)
                    </label>
                    <textarea
                      value={observacionesOC}
                      onChange={(e) => setObservacionesOC(e.target.value)}
                      placeholder="Observaciones sobre el pedido..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleGuardarPago}
                    disabled={guardandoPago || !formaPago || !metodoPago}
                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {guardandoPago ? 'Guardando...' : 'Guardar Información de Pago'}
                  </button>

                  <button
                    onClick={handleDescargarOC}
                    disabled={generandoOC || !pedido.forma_pago || !pedido.metodo_pago}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    title={!pedido.forma_pago || !pedido.metodo_pago ? 'Debe guardar la información de pago primero' : ''}
                  >
                    <Download className="w-4 h-4" />
                    {generandoOC ? 'Generando...' : 'Descargar Orden de Compra'}
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Notas Internas
                </h2>

                {pedido.notas && pedido.notas.length > 0 && (
                  <div className="space-y-3 mb-4">
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

                <textarea
                  value={nuevaNota}
                  onChange={(e) => setNuevaNota(e.target.value)}
                  placeholder="Agregar nota interna..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
                  rows={3}
                />
                <button
                  onClick={handleAgregarNota}
                  disabled={agregandoNota || !nuevaNota.trim()}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
                >
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
