import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, User, MapPin, FileText, Clock, MessageSquare, History, CreditCard, Download, Save, CircleCheck as CheckCircle, Circle as XCircle, Plus, X, DollarSign, TrendingUp, ChevronDown, ChevronUp, Loader as Loader2, Wallet, Trash2, Settings } from 'lucide-react';
import { BaseModal } from '../components/BaseModal';
import { PageHeader } from '@/components/ui/page-header';
import { obtenerPedidoCompleto, actualizarEstatusPedido, agregarNotaPedido, obtenerEstatus, obtenerPagosPedido, registrarPago, eliminarPago, tieneAccesoEquipoStore, obtenerMapeoCamposTrigger, resolverTemplatePedido, obtenerCamposTramiteTipo, parsearLogoTransform } from '../lib/storeUtils';
import type { StorePedidoCompleto, StoreEstatusPedido, StoreMetodoPago, StoreParcialidad, StoreFrecuenciaPago, StoreMetodoPagoCombinacion, StorePedidoGasto, StorePedidoDetalleGasto, StorePedidoPago } from '../lib/storeTypes';
import { TIPO_GASTO_OPTIONS, METODO_PAGO_OPCIONES } from '../lib/storeTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generarFolioOC, generarPDFOrdenCompra, subirPDFOrdenCompra, validarDatosPagoCompletos } from '../lib/storePdfOrdenCompra';
import { supabase } from '../lib/supabase';

export default function StorePedidoDetalle() {
  const { usuario } = useAuth();
  const { id: pedidoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<StorePedidoCompleto | null>(null);
  const [estatus, setEstatus] = useState<StoreEstatusPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizandoEstatus, setActualizandoEstatus] = useState(false);
  const [nuevaNota, setNuevaNota] = useState('');
  const [agregandoNota, setAgregandoNota] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Payment fields
  const [responsablePagoId, setResponsablePagoId] = useState('');
  const [usuariosOficina, setUsuariosOficina] = useState<any[]>([]);
  const [oficinasList, setOficinasList] = useState<{ id: string; nombre: string }[]>([]);
  const [filtroOficinaId, setFiltroOficinaId] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [metodoPagoOtroDetalle, setMetodoPagoOtroDetalle] = useState('');
  const [metodosPago, setMetodosPago] = useState<StoreMetodoPago[]>([]);
  const [parcialidades, setParcialidades] = useState<StoreParcialidad[]>([]);
  const [frecuenciasPago, setFrecuenciasPago] = useState<StoreFrecuenciaPago[]>([]);
  const [combinaciones, setCombinaciones] = useState<StoreMetodoPagoCombinacion[]>([]);
  const [mostrarConfigCombinaciones, setMostrarConfigCombinaciones] = useState(false);
  const [nuevaCombMetodo, setNuevaCombMetodo] = useState('');
  const [nuevaCombParcialidad, setNuevaCombParcialidad] = useState('');
  const [nuevaCombFrecuencia, setNuevaCombFrecuencia] = useState('');
  const [observacionesOC, setObservacionesOC] = useState('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [generandoOC, setGenerandoOC] = useState(false);


  // Order expenses
  const [pedidoGastos, setPedidoGastos] = useState<StorePedidoGasto[]>([]);
  const [newGastoConcepto, setNewGastoConcepto] = useState('');
  const [newGastoTipo, setNewGastoTipo] = useState('otro');
  const [newGastoMonto, setNewGastoMonto] = useState('');

  // Line-item expenses
  const [detalleGastos, setDetalleGastos] = useState<Record<string, StorePedidoDetalleGasto[]>>({});
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [costoOverrides, setCostoOverrides] = useState<Record<string, string>>({});
  const [savingCostoOverride, setSavingCostoOverride] = useState<Record<string, boolean>>({});
  const [costoOverrideSaved, setCostoOverrideSaved] = useState<Record<string, boolean>>({});

  const esAdminOGerente = usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente';
  const [tieneAccesoEquipo, setTieneAccesoEquipo] = useState(false);
  const isAdmin = esAdminOGerente || tieneAccesoEquipo;
  const [savingPedidoGasto, setSavingPedidoGasto] = useState(false);
  const [gastoError, setGastoError] = useState<string | null>(null);

  // Payment tracking (pagos parciales/totales)
  const [pagos, setPagos] = useState<StorePedidoPago[]>([]);
  const [nuevoPagoFecha, setNuevoPagoFecha] = useState(new Date().toISOString().split('T')[0]);
  const [nuevoPagoMetodo, setNuevoPagoMetodo] = useState('');
  const [nuevoPagoMonto, setNuevoPagoMonto] = useState('');
  const [nuevoPagoComentario, setNuevoPagoComentario] = useState('');
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [pagoError, setPagoError] = useState<string | null>(null);

  useEffect(() => {
    if (pedidoId) cargarDatos();
  }, [pedidoId]);

  useEffect(() => {
    if (esAdminOGerente || !usuario) return;
    tieneAccesoEquipoStore(usuario.id).then(setTieneAccesoEquipo);
  }, [usuario, esAdminOGerente]);

  useEffect(() => {
    if (pedido) {
      setResponsablePagoId(pedido.responsable_pago_id || '');
      setFormaPago(pedido.forma_pago || '');
      setMetodoPago(pedido.metodo_pago || '');
      setMetodoPagoOtroDetalle(pedido.metodo_pago_otro_detalle || '');
      setObservacionesOC(pedido.observaciones_oc || '');
      cargarUsuariosOficina();
      if (isAdmin) {
        cargarGastosPedido();
        cargarGastosDetalle();
        cargarPagos();
        const overrides: Record<string, string> = {};
        pedido.detalle.forEach(d => {
          if (d.costo_unitario_override != null) {
            overrides[d.id] = d.costo_unitario_override.toString();
          }
        });
        setCostoOverrides(overrides);
      }
    }
  }, [pedido, isAdmin]);

  useEffect(() => {
    const cargarMetodosYCombinacionesPago = async () => {
      const [{ data: metodos }, { data: parcialidadesData }, { data: frecuenciasData }, { data: combos }] = await Promise.all([
        supabase.from('store_metodos_pago').select('id, nombre, orden, activo').eq('activo', true).order('orden'),
        supabase.from('store_parcialidades').select('id, cantidad, orden, activo').eq('activo', true).order('orden'),
        supabase.from('store_frecuencias_pago').select('id, nombre, orden, activo').eq('activo', true).order('orden'),
        supabase.from('store_metodo_pago_combinacion').select('id, metodo_id, parcialidad_id, frecuencia_id'),
      ]);
      if (metodos) setMetodosPago(metodos);
      if (parcialidadesData) setParcialidades(parcialidadesData);
      if (frecuenciasData) setFrecuenciasPago(frecuenciasData);
      if (combos) setCombinaciones(combos);
    };
    cargarMetodosYCombinacionesPago();
  }, []);

  const getFormasParaMetodo = (nombreMetodo: string): string[] => {
    const metodo = metodosPago.find(m => m.nombre === nombreMetodo);
    if (!metodo) return [];
    return combinaciones
      .filter(c => c.metodo_id === metodo.id)
      .map(c => {
        const p = parcialidades.find(x => x.id === c.parcialidad_id);
        const f = frecuenciasPago.find(x => x.id === c.frecuencia_id);
        return p && f ? `${p.cantidad} ${f.nombre}` : null;
      })
      .filter((label): label is string => label !== null);
  };

  const agregarCombinacionPago = async () => {
    if (!nuevaCombMetodo || !nuevaCombParcialidad || !nuevaCombFrecuencia) return;
    const { data, error } = await supabase.from('store_metodo_pago_combinacion')
      .insert({ metodo_id: nuevaCombMetodo, parcialidad_id: nuevaCombParcialidad, frecuencia_id: nuevaCombFrecuencia })
      .select('id, metodo_id, parcialidad_id, frecuencia_id')
      .single();
    if (error || !data) return;
    setCombinaciones(prev => [...prev, data]);
  };

  const eliminarCombinacionPago = async (id: string) => {
    const { error } = await supabase.from('store_metodo_pago_combinacion').delete().eq('id', id);
    if (error) return;
    setCombinaciones(prev => prev.filter(c => c.id !== id));
  };

  const cargarUsuariosOficina = async () => {
    // Quien da seguimiento a pedidos debe ver todos los usuarios/oficinas de MOVI,
    // no solo los de la oficina del dueño del pedido.
    const [{ data: usuarios }, { data: oficinas }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, apellidos, nombre_completo, oficina_id')
        .eq('estado', 'activo').order('nombre_completo'),
      supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
    ]);
    if (usuarios) setUsuariosOficina(usuarios);
    if (oficinas) setOficinasList(oficinas);
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

  const cargarPagos = async () => {
    if (!pedidoId) return;
    try {
      const data = await obtenerPagosPedido(pedidoId);
      setPagos(data);
    } catch (err) {
      console.error('Error cargando pagos:', err);
    }
  };

  const handleRegistrarPago = async () => {
    if (!pedidoId) return;
    if (!nuevoPagoMetodo) { setPagoError('Selecciona un metodo de pago.'); return; }
    const monto = parseFloat(nuevoPagoMonto.replace(/[$,\s]/g, ''));
    if (isNaN(monto) || monto <= 0) { setPagoError('Ingresa un monto valido mayor a $0.'); return; }
    if (!nuevoPagoFecha) { setPagoError('Selecciona una fecha.'); return; }
    setPagoError(null);
    setRegistrandoPago(true);
    try {
      const nuevo = await registrarPago({
        pedido_id: pedidoId,
        fecha: nuevoPagoFecha,
        metodo: nuevoPagoMetodo,
        monto,
        comentario: nuevoPagoComentario.trim() || undefined,
      });
      setPagos(prev => [nuevo, ...prev]);
      setNuevoPagoFecha(new Date().toISOString().split('T')[0]);
      setNuevoPagoMetodo('');
      setNuevoPagoMonto('');
      setNuevoPagoComentario('');
    } catch (err: any) {
      console.error('Error registrando pago:', err);
      setPagoError(err?.message || 'Error al registrar el pago.');
    } finally {
      setRegistrandoPago(false);
    }
  };

  const handleEliminarPago = async (pagoId: string) => {
    if (!confirm('Eliminar este pago?')) return;
    try {
      await eliminarPago(pagoId);
      setPagos(prev => prev.filter(p => p.id !== pagoId));
    } catch (err: any) {
      console.error('Error eliminando pago:', err);
      alert('Error al eliminar: ' + (err?.message || 'error desconocido'));
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

    const estatusSeleccionado = estatus.find(e => e.id === nuevoEstatusId);
    if (estatusSeleccionado?.nombre === 'Confirmado' && pedido) {
      const faltantes: string[] = [];
      if (!pedido.responsable_pago_id) faltantes.push('Responsable de Pago');
      if (!pedido.metodo_pago) faltantes.push('Método de Pago');
      if (!pedido.forma_pago) faltantes.push('Forma de Pago');
      if (faltantes.length > 0) {
        alert(`No se puede marcar como Confirmado. Falta guardar en "Información de Pago": ${faltantes.join(', ')}.`);
        return;
      }
    }
    if (estatusSeleccionado?.nombre === 'Liquidado') {
      const total = calcularTotal();
      const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
      const saldoPendiente = total - totalPagado;
      if (saldoPendiente > 0.01) {
        alert('No se puede marcar como Liquidado. El pedido tiene un saldo pendiente de $' + saldoPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 }) + '. Debe estar completamente pagado.');
        return;
      }
    }

    if (!confirm('Cambiar el estatus de este pedido?')) return;
    try {
      setActualizandoEstatus(true);
      await actualizarEstatusPedido(pedidoId, nuevoEstatusId);

      // Verificar si el nuevo estatus es "Entregado"
      const nuevoEstatus = estatus.find(e => e.id === nuevoEstatusId);
      if (nuevoEstatus?.nombre === 'Entregado' && pedido) {
        await activarPremiumSiAplica(pedido);
      }

      // Disparar triggers: crear tramites automaticos vinculados al pedido
      const resultadoTriggers = await dispararTriggersEstatus(nuevoEstatusId, nuevoEstatus?.nombre ?? '');

      await cargarDatos();

      if (resultadoTriggers.creados.length > 0) {
        const detalle = resultadoTriggers.creados.map(c => `${c.tipoLabel} (${c.folio})`).join(', ');
        showToast(`Estatus actualizado. Trámite${resultadoTriggers.creados.length > 1 ? 's' : ''} creado${resultadoTriggers.creados.length > 1 ? 's' : ''}: ${detalle}`, 'success');
      } else if (resultadoTriggers.errores.length > 0) {
        showToast(`Estatus actualizado, pero falló la creación del trámite "${resultadoTriggers.errores[0].nombre}": ${resultadoTriggers.errores[0].error}`, 'error');
      } else if (resultadoTriggers.totalTriggers > resultadoTriggers.triggersAplicados) {
        showToast('Estatus actualizado. Ningún trigger aplicó: el método o forma de pago del pedido no coincide con lo configurado.', 'error');
      } else {
        showToast('Estatus actualizado correctamente.', 'success');
      }
    } catch (error) {
      console.error('Error actualizando estatus:', error);
      showToast('Error al actualizar el estatus del pedido.', 'error');
    } finally {
      setActualizandoEstatus(false);
    }
  };

  // Mismos "tipos de texto" que usa TramiteDetalle.tsx/NuevoTramiteModal.tsx para decidir en qué
  // columna de tramite_respuestas vive el valor de cada campo del FormBuilder. Si no coincide con
  // la columna que se lee al mostrar el campo, el campo aparece vacío aunque sí se haya guardado.
  const TEXTO_TIPOS_TRIGGER = ['texto_corto', 'texto_largo', 'area', 'equipo',
    'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
    'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];

  const construirRespuesta = (tramiteId: string, campoId: string, tipoCampo: string, valor: unknown) => ({
    tramite_id: tramiteId,
    campo_id: campoId,
    valor_texto: TEXTO_TIPOS_TRIGGER.includes(tipoCampo) ? String(valor) : null,
    valor_numerico: ['numerico', 'porcentaje'].includes(tipoCampo) ? Number(valor) : null,
    valor_fecha: tipoCampo === 'fecha' ? String(valor) : null,
    valor_booleano: tipoCampo === 'booleano' ? Boolean(valor) : null,
    valor_json: !TEXTO_TIPOS_TRIGGER.includes(tipoCampo) && !['numerico', 'porcentaje', 'fecha', 'booleano'].includes(tipoCampo) ? valor : null,
  });

  const dispararTriggersEstatus = async (nuevoEstatusId: string, nombreEstatus: string) => {
    const resultado = { creados: [] as { folio: string; tipoLabel: string }[], errores: [] as { nombre: string; error: string }[], totalTriggers: 0, triggersAplicados: 0 };
    if (!pedidoId || !usuario?.id || !pedido) return resultado;
    const { data: triggersRaw } = await supabase
      .from('store_tramite_triggers')
      .select('*, ticket_tipos!inner(id, value, label, area)')
      .eq('estatus_destino_id', nuevoEstatusId)
      .eq('activo', true);
    resultado.totalTriggers = triggersRaw?.length ?? 0;
    // Filtrar por método/forma de pago del pedido si el trigger los restringe
    // (null o arreglo vacío = cualquiera; ahora son arreglos, un trigger puede
    // aplicar a varios métodos/formas a la vez)
    const triggers = (triggersRaw ?? []).filter(t =>
      (!t.metodo_pago_filtro?.length || t.metodo_pago_filtro.includes(pedido.metodo_pago)) &&
      (!t.forma_pago_filtro?.length || t.forma_pago_filtro.includes(pedido.forma_pago))
    );
    resultado.triggersAplicados = triggers.length;
    if (triggers.length === 0) return resultado;

    const { data: estatusIniciado } = await supabase
      .from('ticket_estatus').select('id').eq('nombre', 'Iniciado').maybeSingle();
    if (!estatusIniciado) {
      resultado.errores.push({ nombre: '(config)', error: 'No se encontró el estatus "Iniciado" en el sistema' });
      return resultado;
    }

    const folio = pedido.folio_oc ?? pedidoId.slice(0, 8).toUpperCase();
    for (const trigger of triggers) {
      try {
        const tipoInfo = trigger.ticket_tipos as { id: string; value: string; label: string; area: string };
        const camposDelTipo = await obtenerCamposTramiteTipo(tipoInfo.id);
        const mapeo = await obtenerMapeoCamposTrigger(trigger.id as string);

        // Equipo/ejecutivo según las reglas de asignación del tipo de trámite, usando al
        // dueño del pedido como el "agente" que determina la regla (igual que Nuevo Trámite)
        const { data: grupoRow } = await supabase.rpc('get_grupo_para_ticket', {
          p_agente_id: pedido.usuario_id,
          p_tipo_tramite: tipoInfo.value,
        });
        const grupoResult = Array.isArray(grupoRow) && grupoRow.length > 0
          ? grupoRow[0] as { grupo_id: string; ejecutivo_id: string | null }
          : null;

        let nombreGrupo: string | null = null;
        if (grupoResult?.grupo_id) {
          const { data: grupoData } = await supabase
            .from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoResult.grupo_id).single();
          nombreGrupo = grupoData?.nombre ?? null;
        }
        let nombreEjecutivo: string | null = null;
        if (grupoResult?.ejecutivo_id) {
          const { data: ejecData } = await supabase
            .from('usuarios').select('nombre_completo, nombre').eq('id', grupoResult.ejecutivo_id).maybeSingle();
          nombreEjecutivo = ejecData?.nombre_completo || ejecData?.nombre || null;
        }

        // "Descripción / Notas" del FormBuilder tiene prioridad sobre la plantilla legacy del
        // trigger si el admin la mapeó explícitamente en la sección de campos
        const descripcionCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'descripcion');
        const mapeoDescripcion = descripcionCampo ? mapeo.find(m => m.campo_id === descripcionCampo.id) : undefined;
        const descripcionLegacy = (trigger.descripcion_template as string || '')
          .replace(/\{\{folio\}\}/g, folio)
          .replace(/\{\{estatus\}\}/g, nombreEstatus);
        const instrucciones = (mapeoDescripcion?.fuente === 'template' && mapeoDescripcion.valor_template)
          ? resolverTemplatePedido(mapeoDescripcion.valor_template, pedido)
          : (descripcionLegacy || `${trigger.nombre} — Pedido ${folio}`);

        const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
          tipo_tramite: tipoInfo.value,
          estatus_id: estatusIniciado.id,
          prioridad: 'Media',
          instrucciones,
          creado_por: usuario.id,
          modificado_por: usuario.id,
          agente_id: pedido.usuario_id,
          assigned_to_user_id: grupoResult?.ejecutivo_id ?? null,
          grupo_asignado_id: grupoResult?.grupo_id ?? null,
          store_pedido_id: pedidoId,
        }).select().single();
        if (ticketError || !ticket) throw ticketError;

        // Autofill de los campos fijos del FormBuilder (mismo criterio que "Nuevo Trámite"):
        // Área viene del tipo de trámite, Equipo/Asignar a de las reglas de asignación,
        // Creado Por es quien disparó el cambio de estatus (no el dueño del pedido)
        const respuestasAuto: ReturnType<typeof construirRespuesta>[] = [];
        const areaCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'area');
        if (areaCampo && tipoInfo.area) respuestasAuto.push(construirRespuesta(ticket.id, areaCampo.id, 'area', tipoInfo.area));
        const equipoCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'equipo');
        if (equipoCampo && nombreGrupo) respuestasAuto.push(construirRespuesta(ticket.id, equipoCampo.id, 'equipo', nombreGrupo));
        const creadoPorCampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'creado_por');
        if (creadoPorCampo) respuestasAuto.push(construirRespuesta(ticket.id, creadoPorCampo.id, 'creado_por', usuario.nombre_completo || usuario.nombre || ''));
        const asignadoACampo = (camposDelTipo ?? []).find((c: any) => c.sistema_key === 'asignado_a');
        if (asignadoACampo && nombreEjecutivo) respuestasAuto.push(construirRespuesta(ticket.id, asignadoACampo.id, 'asignado_a', nombreEjecutivo));

        // Mapeo manual del admin -- 'descripcion' también se guarda aquí (además de usarse arriba
        // para instrucciones) para que "Información del Trámite" la muestre igual que los demás campos
        const respuestasMapeo = mapeo
          .filter(m => m.fuente === 'template' && m.valor_template)
          .map(m => {
            const campoInfo = (camposDelTipo ?? []).find((c: any) => c.id === m.campo_id);
            const valor = resolverTemplatePedido(m.valor_template as string, pedido);
            return construirRespuesta(ticket.id, m.campo_id, campoInfo?.tipo ?? 'texto_corto', valor);
          });

        const todasRespuestas = [...respuestasAuto, ...respuestasMapeo];
        if (todasRespuestas.length > 0) {
          await supabase.from('tramite_respuestas').insert(todasRespuestas);
        }

        // Adjuntar PDF de Orden de Compra si algún campo está mapeado a 'adjunto_oc'
        const campoAdjuntoOC = mapeo.find(m => m.fuente === 'adjunto_oc');
        if (campoAdjuntoOC) {
          let folioOC = pedido.folio_oc;
          if (!folioOC) {
            folioOC = await generarFolioOC();
            await supabase.from('store_pedidos').update({
              folio_oc: folioOC,
              oc_generada_por: usuario.id,
              oc_generada_en: new Date().toISOString(),
            }).eq('id', pedidoId);
          }
          const archivo = await subirPDFOrdenCompra({ ...pedido, folio_oc: folioOC }, ticket.id);
          await supabase.from('ticket_archivos').insert({
            ticket_id: ticket.id,
            usuario_id: usuario.id,
            nombre: archivo.nombre,
            url: archivo.url,
            tipo: archivo.tipo,
            tamano: archivo.tamano,
          });
        }

        resultado.creados.push({ folio: ticket.folio, tipoLabel: tipoInfo.label });
      } catch (err: any) {
        console.error(`[Store] Error creando trámite del trigger "${trigger.nombre}":`, err);
        resultado.errores.push({ nombre: trigger.nombre as string, error: err?.message || 'error desconocido' });
      }
    }
    return resultado;
  };

  const activarPremiumSiAplica = async (pedidoData: StorePedidoCompleto) => {
    const METODO_MAP: Record<string, 'deposito_jiro' | 'bono_anual' | 'comisiones'> = {
      'Cargo a Bono de Agente': 'bono_anual',
      'Descuento de Comisiones': 'comisiones',
    };

    for (const detalle of pedidoData.detalle ?? []) {
      const tipo = detalle.producto?.tipo;
      if (tipo !== 'marketing_premium_mensual' && tipo !== 'marketing_premium_anual') continue;

      const plan = tipo === 'marketing_premium_anual' ? 'anual' : 'mensual';
      const metodoPagoMkt = METODO_MAP[pedidoData.metodo_pago ?? ''] ?? 'deposito_jiro';
      const hoy = new Date().toISOString().split('T')[0];

      await supabase
        .from('usuarios')
        .update({
          plan_mkt_premium: true,
          mkt_premium_plan: plan,
          mkt_premium_metodo_pago: metodoPagoMkt,
          mkt_premium_fecha_pago: hoy,
          mkt_premium_fecha_inicio: hoy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedidoData.usuario_id);

      break; // Solo activar una vez aunque haya varios ítems premium
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


  const handleGuardarPago = async () => {
    if (!pedidoId || !isAdmin || !formaPago || !metodoPago) return;
    try {
      setGuardandoPago(true);
      const { error } = await supabase.from('store_pedidos').update({
        responsable_pago_id: responsablePagoId || null,
        forma_pago: formaPago,
        metodo_pago: metodoPago,
        metodo_pago_otro_detalle: metodoPago === 'Otro' ? metodoPagoOtroDetalle : null,
        observaciones_oc: observacionesOC || null,
      }).eq('id', pedidoId);
      if (error) throw error;
      await cargarDatos();
      showToast('Información de pago guardada correctamente.', 'success');
    } catch (error: any) {
      console.error('Error guardando pago:', error);
      showToast(`Error al guardar la información de pago: ${error?.message || 'error desconocido'}`, 'error');
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
    if (!pedidoId || !newGastoConcepto.trim()) {
      setGastoError('El concepto es requerido.');
      return;
    }
    const parsedMonto = parseFloat(newGastoMonto.replace(/[$,\s]/g, ''));
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      setGastoError('El monto debe ser mayor a $0.');
      return;
    }
    setGastoError(null);
    setSavingPedidoGasto(true);
    try {
      const { data, error } = await supabase
        .from('store_pedido_gastos')
        .insert({ pedido_id: pedidoId, concepto: newGastoConcepto.trim(), tipo: newGastoTipo, monto: parsedMonto, creado_por: usuario?.id })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setPedidoGastos(prev => [...prev, data]);
        setNewGastoConcepto('');
        setNewGastoTipo('otro');
        setNewGastoMonto('');
      }
    } catch (err: any) {
      console.error('[Store] Error al agregar gasto del pedido:', err);
      setGastoError(err?.message || 'Error al guardar el gasto. Verifica tus permisos.');
    } finally {
      setSavingPedidoGasto(false);
    }
  };

  const handleRemovePedidoGasto = async (id: string) => {
    try {
      const { error } = await supabase.from('store_pedido_gastos').delete().eq('id', id);
      if (error) throw error;
      setPedidoGastos(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      console.error('[Store] Error al eliminar gasto:', err);
      alert('Error al eliminar el gasto: ' + (err?.message || 'error desconocido'));
    }
  };

  const handleAddDetalleGasto = async (detalleId: string, concepto: string, tipo: string, montoUnitario: string, cantidad: number): Promise<boolean> => {
    const parsedUnit = parseFloat(montoUnitario.replace(/[$,\s]/g, ''));
    if (!concepto.trim() || isNaN(parsedUnit) || parsedUnit <= 0) return false;
    const montoTotal = parsedUnit * cantidad;
    try {
      const { data, error } = await supabase
        .from('store_pedido_detalle_gastos')
        .insert({
          detalle_id: detalleId,
          concepto: concepto.trim(),
          tipo,
          monto_unitario: parsedUnit,
          monto: montoTotal,
          creado_por: usuario?.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setDetalleGastos(prev => ({ ...prev, [detalleId]: [...(prev[detalleId] || []), data] }));
      }
      return true;
    } catch (err: any) {
      console.error('[Store] Error al agregar gasto de detalle:', err);
      alert('Error al guardar el gasto: ' + (err?.message || 'error desconocido'));
      return false;
    }
  };

  const handleRemoveDetalleGasto = async (detalleId: string, gastoId: string) => {
    try {
      const { error } = await supabase.from('store_pedido_detalle_gastos').delete().eq('id', gastoId);
      if (error) throw error;
      setDetalleGastos(prev => ({ ...prev, [detalleId]: (prev[detalleId] || []).filter(g => g.id !== gastoId) }));
    } catch (err: any) {
      console.error('[Store] Error al eliminar gasto de detalle:', err);
      alert('Error al eliminar: ' + (err?.message || 'error desconocido'));
    }
  };

  const handleSaveCostoOverride = async (detalleId: string) => {
    const val = costoOverrides[detalleId];
    const numVal = val !== undefined && val !== '' ? parseFloat(val) : null;
    if (numVal !== null && (isNaN(numVal) || numVal < 0)) return;
    setSavingCostoOverride(prev => ({ ...prev, [detalleId]: true }));
    try {
      const { error } = await supabase
        .from('store_pedidos_detalle')
        .update({ costo_unitario_override: numVal })
        .eq('id', detalleId);
      if (error) throw error;
      setCostoOverrideSaved(prev => ({ ...prev, [detalleId]: true }));
      setTimeout(() => setCostoOverrideSaved(prev => ({ ...prev, [detalleId]: false })), 1500);
    } catch (err: any) {
      console.error('[Store] Error al guardar costo:', err);
      alert('Error al guardar el costo: ' + (err?.message || 'error desconocido'));
    } finally {
      setSavingCostoOverride(prev => ({ ...prev, [detalleId]: false }));
    }
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
    if (!pedido) return 0;
    return pedido.detalle.reduce((sum, item) => {
      const gastos = detalleGastos[item.id] || [];
      const gastoLinea = gastos.reduce((s, g) => s + (g.monto_unitario * item.cantidad), 0);
      return sum + gastoLinea;
    }, 0);
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
    return colors[estatusNombre] || 'bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/80';
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </>
    );
  }

  if (!pedido) {
    return (
      <>
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-white/50">Pedido no encontrado</p>
        </div>
      </>
    );
  }

  const ingresos = calcularTotal();
  const costoProductos = calcularCostoProductos();
  const gastosTotales = calcularGastosTotales();
  const gananciaNeta = ingresos - costoProductos - gastosTotales;
  const margen = ingresos > 0 ? (gananciaNeta / ingresos) * 100 : 0;

  return (
    <>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-md ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Detalle de Pedido"
          description={`Folio: ${pedido.folio_oc || 'Pendiente de asignación'}`}
          icon={Package}
          backTo={isAdmin ? '/store/pedidos' : '/store/mis-pedidos'}
          backLabel={isAdmin ? 'Volver a Pedidos' : 'Volver a Mis Pedidos'}
          badge={
            <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${getEstatusColor(pedido.estatus?.nombre || 'Pendiente')}`}>
              {pedido.estatus?.nombre || 'Pendiente'}
            </span>
          }
          className="mb-8"
        />

        {/* Profitability KPIs - Admin only */}
        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
              <p className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Ingresos</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
              <p className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Costo Productos</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">${costoProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-4">
              <p className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Gastos</p>
              <p className="text-xl font-bold text-amber-600 mt-1">${gastosTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`rounded-xl border p-4 ${gananciaNeta >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Ganancia Neta</p>
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
            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos
              </h2>
              <div className="space-y-4">
                {pedido.detalle.map(item => {
                  const lineGastos = detalleGastos[item.id] || [];
                  const expanded = expandedLines[item.id];
                  const costoUnit = item.costo_unitario_override ?? item.producto?.costo_base ?? 0;

                  return (
                    <div key={item.id} className="border-b border-neutral-100 dark:border-white/5 pb-4 last:border-0 last:pb-0">
                      <div className="flex gap-4">
                        <img
                          src={item.producto?.imagen_url}
                          alt={item.producto?.titulo}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-neutral-900 dark:text-white">{item.producto?.titulo}</h3>
                          <p className="text-sm text-neutral-600 dark:text-white/60 mt-0.5">Cantidad: {item.cantidad} x ${item.precio_unitario.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                          {item.atributos_seleccionados && Object.keys(item.atributos_seleccionados).length > 0 && (
                            <div className="mt-1 space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(item.atributos_seleccionados)
                                  .filter(([key]) => !key.startsWith('_'))
                                  .map(([key, value]) => (
                                    <span key={key} className="inline-flex items-center gap-1 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5 text-xs font-medium text-primary-800">
                                      {key}: {value}
                                    </span>
                                  ))}
                              </div>
                              {item.atributos_seleccionados._personalizacion && (
                                <p className="text-xs text-neutral-500 dark:text-white/50 italic">
                                  Personalización: {item.atributos_seleccionados._personalizacion}
                                </p>
                              )}
                              {(() => {
                                const logoTransform = parsearLogoTransform(item.atributos_seleccionados);
                                const imagenLienzo = item.producto?.imagen_personalizacion_url || item.producto?.imagen_url;
                                if (!logoTransform || !imagenLienzo) return null;
                                return (
                                  <div className="mt-2">
                                    <p className="text-xs text-neutral-500 dark:text-white/50 mb-1">Logo del asesor (referencia de posición):</p>
                                    <div className="relative inline-block border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden">
                                      <img src={imagenLienzo} alt="Producto" className="block max-h-40 max-w-[200px] object-contain" />
                                      <img
                                        src={logoTransform.logo_url}
                                        alt="Logo"
                                        className="absolute"
                                        style={{
                                          left: `${logoTransform.x}%`,
                                          top: `${logoTransform.y}%`,
                                          width: `${logoTransform.ancho}%`,
                                          transform: `translate(-50%, -50%) rotate(${logoTransform.rotacion}deg)`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          {isAdmin && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <label className="text-xs text-neutral-500 dark:text-white/50">Costo unit.:</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={costoOverrides[item.id] ?? costoUnit.toString()}
                                onChange={e => {
                                  setCostoOverrides(prev => ({ ...prev, [item.id]: e.target.value }));
                                  setCostoOverrideSaved(prev => ({ ...prev, [item.id]: false }));
                                }}
                                onBlur={() => handleSaveCostoOverride(item.id)}
                                className="w-24 px-2 py-1 text-xs border border-neutral-200 dark:border-white/10 rounded-md"
                              />
                              {savingCostoOverride[item.id] && (
                                <Loader2 className="w-3 h-3 animate-spin text-neutral-400 dark:text-white/40" />
                              )}
                              {costoOverrideSaved[item.id] && !savingCostoOverride[item.id] && (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            ${(item.precio_unitario * item.cantidad).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          {isAdmin && costoUnit > 0 && (
                            <p className="text-xs text-neutral-400 dark:text-white/40">Costo: ${(costoUnit * item.cantidad).toFixed(2)}</p>
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
                              cantidad={item.cantidad}
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
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-neutral-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-accent">
                    ${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Order-level expenses - Admin only */}
            {isAdmin && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Gastos generales del pedido
                </h2>
                {pedidoGastos.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {pedidoGastos.map(g => (
                      <li key={g.id} className="flex items-center justify-between bg-neutral-50 dark:bg-white/5 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{g.concepto}</span>
                          <span className="text-xs text-neutral-400 dark:text-white/40 ml-2">({TIPO_GASTO_OPTIONS.find(t => t.value === g.tipo)?.label})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">${g.monto.toFixed(2)}</span>
                          <button onClick={() => handleRemovePedidoGasto(g.id)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {gastoError && (
                  <p className="text-xs text-red-600 mb-2">{gastoError}</p>
                )}
                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={newGastoConcepto}
                    onChange={e => { setNewGastoConcepto(e.target.value); setGastoError(null); }}
                    placeholder="Concepto"
                    className="flex-1 px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                  />
                  <select
                    value={newGastoTipo}
                    onChange={e => setNewGastoTipo(e.target.value)}
                    className="px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                  >
                    {TIPO_GASTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newGastoMonto}
                    onChange={e => { setNewGastoMonto(e.target.value); setGastoError(null); }}
                    placeholder="$0.00"
                    className="w-24 px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                    onKeyDown={e => e.key === 'Enter' && handleAddPedidoGasto()}
                  />
                  <button
                    onClick={handleAddPedidoGasto}
                    disabled={savingPedidoGasto || !newGastoConcepto.trim() || !newGastoMonto}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm disabled:opacity-40 flex items-center justify-center min-w-[36px]"
                  >
                    {savingPedidoGasto ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Control (Pagos Parciales/Totales) - Admin only */}
            {isAdmin && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Control de Pagos
                </h2>

                {/* Balance summary */}
                {(() => {
                  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
                  const saldoPendiente = ingresos - totalPagado;
                  const porcentajePagado = ingresos > 0 ? (totalPagado / ingresos) * 100 : 0;
                  return (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-600 dark:text-white/60">Progreso de pago</span>
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">{porcentajePagado.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${saldoPendiente <= 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(porcentajePagado, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="text-center">
                          <p className="text-[10px] uppercase font-medium text-neutral-500 dark:text-white/50">Total</p>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase font-medium text-neutral-500 dark:text-white/50">Pagado</p>
                          <p className="text-sm font-bold text-green-600">${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase font-medium text-neutral-500 dark:text-white/50">Pendiente</p>
                          <p className={`text-sm font-bold ${saldoPendiente <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.max(saldoPendiente, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment history */}
                {pagos.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500 dark:text-white/50 mb-2">Historial de pagos</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {pagos.map(pago => (
                        <div key={pago.id} className="flex items-start justify-between bg-neutral-50 dark:bg-white/5 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                +${pago.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-white/70 px-1.5 py-0.5 rounded">
                                {pago.metodo}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
                              {format(new Date(pago.fecha + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                              {pago.registrado_por_usuario && ` - ${pago.registrado_por_usuario.nombre}`}
                            </p>
                            {pago.comentario && (
                              <p className="text-xs text-neutral-600 dark:text-white/60 mt-0.5 italic">"{pago.comentario}"</p>
                            )}
                          </div>
                          <button onClick={() => handleEliminarPago(pago.id)} className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0 mt-0.5">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Register new payment form */}
                <div className="border-t border-neutral-200 dark:border-white/10 pt-4">
                  <h3 className="text-xs font-semibold uppercase text-neutral-500 dark:text-white/50 mb-3">Registrar pago</h3>
                  {pagoError && <p className="text-xs text-red-600 mb-2">{pagoError}</p>}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-white/50 mb-0.5">Fecha</label>
                      <input
                        type="date"
                        value={nuevoPagoFecha}
                        onChange={e => { setNuevoPagoFecha(e.target.value); setPagoError(null); }}
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-white/50 mb-0.5">Metodo</label>
                      <select
                        value={nuevoPagoMetodo}
                        onChange={e => { setNuevoPagoMetodo(e.target.value); setPagoError(null); }}
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                      >
                        <option value="">Seleccionar...</option>
                        {METODO_PAGO_OPCIONES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-white/50 mb-0.5">Monto</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={nuevoPagoMonto}
                        onChange={e => { setNuevoPagoMonto(e.target.value); setPagoError(null); }}
                        placeholder="$0.00"
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 dark:text-white/50 mb-0.5">Comentario</label>
                      <input
                        type="text"
                        value={nuevoPagoComentario}
                        onChange={e => setNuevoPagoComentario(e.target.value)}
                        placeholder="Opcional..."
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleRegistrarPago}
                    disabled={registrandoPago || !nuevoPagoMetodo || !nuevoPagoMonto}
                    className="w-full mt-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {registrandoPago ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {registrandoPago ? 'Registrando...' : 'Registrar Pago'}
                  </button>
                </div>
              </div>
            )}

            {/* History */}
            {pedido.historial && pedido.historial.length > 0 && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Cambios
                </h2>
                <div className="space-y-3">
                  {pedido.historial.map(item => (
                    <div key={item.id} className="flex gap-3 pb-3 border-b border-neutral-100 dark:border-white/5 last:border-0">
                      <Clock className="w-5 h-5 text-neutral-400 dark:text-white/40 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-neutral-900 dark:text-white">
                          Cambio a: <span className="font-semibold">{item.estatus?.nombre}</span>
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-white/50">
                          {format(new Date(item.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {item.usuario && <p className="text-xs text-neutral-500 dark:text-white/50">Por: {item.usuario.nombre}</p>}
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
            <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white mb-0.5">Nombre</p>
                  <p className="text-neutral-700 dark:text-white/70 font-semibold">{pedido.usuario?.nombre_completo || pedido.usuario?.nombre || 'N/A'}</p>
                </div>
                {pedido.usuario?.nombre_sicas && (
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white mb-0.5">SICAS</p>
                    <p className="text-neutral-700 dark:text-white/70">{pedido.usuario.nombre_sicas}</p>
                  </div>
                )}
                {pedido.usuario?.oficina && (
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-white mb-0.5">Oficina</p>
                    <p className="text-neutral-700 dark:text-white/70">{pedido.usuario.oficina}</p>
                  </div>
                )}
                <div className="pt-2 border-t border-neutral-200 dark:border-white/10">
                  <p className="text-xs text-neutral-500 dark:text-white/50">
                    {format(new Date(pedido.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            {pedido.direccion_entrega && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Direccion de Entrega
                </h2>
                <p className="text-sm text-neutral-600 dark:text-white/60">{pedido.direccion_entrega}</p>
              </div>
            )}

            {pedido.notas_usuario && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notas del Cliente
                </h2>
                <p className="text-sm text-neutral-600 dark:text-white/60">{pedido.notas_usuario}</p>
              </div>
            )}

            {/* Status change - Admin only */}
            {isAdmin && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Cambiar Estatus</h2>
                <select
                  value={pedido.estatus_id}
                  onChange={(e) => handleCambiarEstatus(e.target.value)}
                  disabled={actualizandoEstatus}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg disabled:opacity-50"
                >
                  {estatus.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
                </select>
                <p className="text-xs text-neutral-500 dark:text-white/40 mt-2">
                  Liquidado solo se habilita cuando el saldo pendiente es $0.00
                </p>
              </div>
            )}

            {/* Payment Info - Admin only */}
            {isAdmin && (
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
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
                    <>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Oficina Jiro</label>
                        <select
                          value={filtroOficinaId}
                          onChange={e => {
                            const nuevaOficina = e.target.value;
                            setFiltroOficinaId(nuevaOficina);
                            const respActual = usuariosOficina.find(u => u.id === responsablePagoId);
                            if (nuevaOficina && respActual?.oficina_id !== nuevaOficina) setResponsablePagoId('');
                          }}
                          className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                        >
                          <option value="">Todas las oficinas</option>
                          {oficinasList.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Responsable de Pago</label>
                        <select
                          value={responsablePagoId}
                          onChange={e => {
                            const nuevoId = e.target.value;
                            setResponsablePagoId(nuevoId);
                            const u = usuariosOficina.find(u => u.id === nuevoId);
                            if (u?.oficina_id) setFiltroOficinaId(u.oficina_id);
                          }}
                          className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg"
                        >
                          <option value="">Seleccionar...</option>
                          {usuariosOficina
                            .filter(u => !filtroOficinaId || u.oficina_id === filtroOficinaId)
                            .map(u => <option key={u.id} value={u.id}>{u.nombre_completo || u.nombre}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-neutral-600 dark:text-white/60">Metodo de Pago *</label>
                      <button
                        type="button"
                        onClick={() => setMostrarConfigCombinaciones(true)}
                        title="Configurar combinaciones de Metodo/Forma de Pago"
                        className="text-neutral-400 hover:text-neutral-700 dark:text-white/40 dark:hover:text-white"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <select value={metodoPago} onChange={e => {
                      const nuevoMetodo = e.target.value;
                      setMetodoPago(nuevoMetodo);
                      const formasDisponibles = getFormasParaMetodo(nuevoMetodo);
                      if (formasDisponibles.length === 1) {
                        setFormaPago(formasDisponibles[0]);
                      } else if (formaPago && !formasDisponibles.includes(formaPago)) {
                        setFormaPago('');
                      }
                    }} className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg">
                      <option value="">Seleccionar...</option>
                      {metodosPago.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                    </select>
                  </div>
                  {metodoPago === 'Otro' && (
                    <input type="text" value={metodoPagoOtroDetalle} onChange={e => setMetodoPagoOtroDetalle(e.target.value)} placeholder="Especificar..." className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg" />
                  )}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Forma de Pago *</label>
                    <select
                      value={formaPago}
                      onChange={e => setFormaPago(e.target.value)}
                      disabled={!metodoPago}
                      className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg disabled:opacity-50"
                    >
                      <option value="">Seleccionar...</option>
                      {getFormasParaMetodo(metodoPago).map(fp => (
                        <option key={fp} value={fp}>{fp}</option>
                      ))}
                    </select>
                    {!metodoPago && (
                      <p className="text-[10px] text-neutral-400 dark:text-white/40 mt-0.5">Selecciona primero el metodo de pago</p>
                    )}
                  </div>
                  <textarea value={observacionesOC} onChange={e => setObservacionesOC(e.target.value)} placeholder="Observaciones..." className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-white/20 rounded-lg" rows={2} />
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
              <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Notas Internas
                </h2>
                {pedido.notas && pedido.notas.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {pedido.notas.map(nota => (
                      <div key={nota.id} className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3">
                        <p className="text-sm text-neutral-900 dark:text-white">{nota.nota}</p>
                        <p className="text-xs text-neutral-500 dark:text-white/50 mt-1">
                          {nota.admin?.nombre} - {format(new Date(nota.created_at), "d MMM yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Agregar nota interna..." className="w-full px-3 py-2 border border-neutral-300 dark:border-white/20 rounded-lg mb-2 text-sm" rows={2} />
                <button onClick={handleAgregarNota} disabled={agregandoNota || !nuevaNota.trim()} className="w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover text-sm font-medium disabled:opacity-50">
                  {agregandoNota ? 'Agregando...' : 'Agregar Nota'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BaseModal
        isOpen={mostrarConfigCombinaciones}
        onClose={() => setMostrarConfigCombinaciones(false)}
        title="Combinaciones de Metodo/Parcialidades/Frecuencia"
        maxWidth="2xl"
      >
        <p className="text-sm text-ios-gray-500 mb-4">
          Habilita combinaciones de Metodo + Parcialidades + Frecuencia disponibles en la Orden de Compra.
        </p>
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ios-gray-500 mb-1">Metodo</label>
            <select value={nuevaCombMetodo} onChange={e => setNuevaCombMetodo(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-ios-gray-300 rounded-lg">
              <option value="">Seleccionar...</option>
              {metodosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-ios-gray-500 mb-1">Parcialidades</label>
            <select value={nuevaCombParcialidad} onChange={e => setNuevaCombParcialidad(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-ios-gray-300 rounded-lg">
              <option value="">Seleccionar...</option>
              {parcialidades.map(p => <option key={p.id} value={p.id}>{p.cantidad}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-ios-gray-500 mb-1">Frecuencia</label>
            <select value={nuevaCombFrecuencia} onChange={e => setNuevaCombFrecuencia(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-ios-gray-300 rounded-lg">
              <option value="">Seleccionar...</option>
              {frecuenciasPago.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <button
            onClick={agregarCombinacionPago}
            disabled={!nuevaCombMetodo || !nuevaCombParcialidad || !nuevaCombFrecuencia}
            className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 border-b border-ios-gray-200/50">Metodo</th>
                <th className="text-left py-2 px-2 border-b border-ios-gray-200/50">Parcialidades</th>
                <th className="text-left py-2 px-2 border-b border-ios-gray-200/50">Frecuencia</th>
                <th className="border-b border-ios-gray-200/50"></th>
              </tr>
            </thead>
            <tbody>
              {combinaciones.map(c => {
                const metodo = metodosPago.find(m => m.id === c.metodo_id);
                const parcialidad = parcialidades.find(p => p.id === c.parcialidad_id);
                const frecuencia = frecuenciasPago.find(f => f.id === c.frecuencia_id);
                return (
                  <tr key={c.id}>
                    <td className="py-2 pr-3 border-b border-ios-gray-100">{metodo?.nombre}</td>
                    <td className="py-2 px-2 border-b border-ios-gray-100">{parcialidad?.cantidad}</td>
                    <td className="py-2 px-2 border-b border-ios-gray-100">{frecuencia?.nombre}</td>
                    <td className="py-2 px-2 border-b border-ios-gray-100 text-right">
                      <button onClick={() => eliminarCombinacionPago(c.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {combinaciones.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-ios-gray-400">Sin combinaciones habilitadas todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </BaseModal>
    </>
  );
}

// Sub-component for line item expenses (gastos por pieza)
function LineGastosEditor({ gastos, detalleId, cantidad, onAdd, onRemove }: {
  gastos: StorePedidoDetalleGasto[];
  detalleId: string;
  cantidad: number;
  onAdd: (detalleId: string, concepto: string, tipo: string, montoUnitario: string, cantidad: number) => Promise<boolean>;
  onRemove: (detalleId: string, gastoId: string) => void;
}) {
  const [concepto, setConcepto] = useState('');
  const [tipo, setTipo] = useState('otro');
  const [montoUnit, setMontoUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedUnit = parseFloat(montoUnit) || 0;
  const totalPreview = parsedUnit * cantidad;

  const handleAdd = async () => {
    if (!concepto.trim()) { setError('Ingresa un concepto.'); return; }
    const parsed = parseFloat(montoUnit.replace(/[$,\s]/g, ''));
    if (isNaN(parsed) || parsed <= 0) { setError('Monto por pieza invalido.'); return; }
    setError(null);
    setSaving(true);
    const ok = await onAdd(detalleId, concepto, tipo, montoUnit, cantidad);
    setSaving(false);
    if (ok) {
      setConcepto('');
      setTipo('otro');
      setMontoUnit('');
    }
  };

  return (
    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-neutral-100 dark:border-white/10">
      {gastos.map(g => {
        const unitCost = g.monto_unitario || g.monto;
        const total = unitCost * cantidad;
        return (
          <div key={g.id} className="flex items-center justify-between text-xs bg-neutral-50 dark:bg-white/5 rounded px-2 py-1.5">
            <div>
              <span>{g.concepto}</span>
              <span className="text-neutral-400 dark:text-white/40 ml-1">({TIPO_GASTO_OPTIONS.find(t => t.value === g.tipo)?.label})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 dark:text-white/40">${unitCost.toFixed(2)}/pza x {cantidad}</span>
              <span className="font-medium text-neutral-800 dark:text-white/80">= ${total.toFixed(2)}</span>
              <button onClick={() => onRemove(detalleId, g.id)} className="text-red-400 hover:text-red-600 ml-0.5"><X className="w-3 h-3" /></button>
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={concepto}
          onChange={e => { setConcepto(e.target.value); setError(null); }}
          placeholder="Concepto"
          className="flex-1 px-2 py-1 text-xs border border-neutral-200 dark:border-white/10 rounded"
        />
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-1.5 py-1 text-xs border border-neutral-200 dark:border-white/10 rounded">
          {TIPO_GASTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex flex-col items-end gap-0.5">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={montoUnit}
            onChange={e => { setMontoUnit(e.target.value); setError(null); }}
            placeholder="$/pza"
            className="w-20 px-2 py-1 text-xs border border-neutral-200 dark:border-white/10 rounded"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          {parsedUnit > 0 && cantidad > 1 && (
            <span className="text-[10px] text-neutral-400 dark:text-white/40">= ${totalPreview.toFixed(2)}</span>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !concepto.trim() || !montoUnit}
          className="px-1.5 py-1 bg-accent text-white rounded text-xs disabled:opacity-40 flex items-center justify-center min-w-[24px]"
        >
          {saving ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>
      {cantidad > 1 && (
        <p className="text-[10px] text-neutral-400 dark:text-white/40 pl-0.5">Ingresa el costo por pieza — se multiplica por {cantidad} piezas</p>
      )}
    </div>
  );
}
