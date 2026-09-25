import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { type TipoCampo, type TramiteSeccion, type CampoTipo, type RolVisibilidad, CAMPO_TIPOS, slugify } from './types';
import { logHistorial } from './logHistorial';

// Campos sistema que nunca se pueden mover ni eliminar
export const LOCKED_SISTEMA_KEYS = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'creado_por'];

// Defaults para re-agregar campos sistema configurables que el admin haya ocultado
export const SISTEMA_CAMPO_DEFAULTS: Record<string, { label: string; tipo: string; key: string; config: Record<string, any> }> = {
  estatus:              { label: 'Estatus',                   tipo: 'estatus',              key: 'estatus_tramite',      config: { opciones: [{ label: 'Iniciado', slug: 'iniciado', clasificacion: 'inicio' }, { label: 'Terminado', slug: 'terminado', clasificacion: 'terminacion' }] } },
  agente_vendedor:      { label: 'Agente / Vendedor',         tipo: 'agente_vendedor',      key: 'agente_vendedor',      config: {} },
  oficina_jiro:         { label: 'Oficina Jiro',              tipo: 'oficina_jiro',         key: 'oficina_jiro',         config: {} },
  asignado_a:           { label: 'Asignar a',                 tipo: 'asignado_a',           key: 'asignado_a',           config: {} },
  prioridad:            { label: 'Prioridad',                 tipo: 'prioridad',            key: 'prioridad',            config: {} },
  descripcion:          { label: 'Descripción / Notas',       tipo: 'descripcion',          key: 'descripcion',          config: {} },
  fecha_promesa_entrega:{ label: 'Fecha Promesa de Entrega',  tipo: 'fecha_promesa_entrega',key: 'fecha_promesa_entrega',config: {} },
  archivos_adjuntos:    { label: 'Archivos Adjuntos',         tipo: 'archivos_adjuntos',    key: 'archivos_adjuntos',    config: {} },
};

// Sistema keys que el admin puede agregar/quitar del formulario
export const CONFIGURABLE_SISTEMA_KEYS = Object.keys(SISTEMA_CAMPO_DEFAULTS);

type ShowToast = (msg: string, type?: 'success' | 'error') => void;

export function useFormBuilder(tipoId: string, showToast: ShowToast) {
  const { usuario } = useAuth();
  const [campos, setCampos] = useState<TipoCampo[]>([]);
  const [loadingCampos, setLoadingCampos] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingCampo, setEditingCampo] = useState<TipoCampo | null>(null);
  const [editCampoLabel, setEditCampoLabel] = useState('');
  const [editCampoReq, setEditCampoReq] = useState(false);
  const [editCampoConfig, setEditCampoConfig] = useState<Record<string, any>>({});
  const [editCampoAyuda, setEditCampoAyuda] = useState('');
  const [editCampoVisiblePara, setEditCampoVisiblePara] = useState<RolVisibilidad>('todos');
  const [editCampoEditablePara, setEditCampoEditablePara] = useState<RolVisibilidad>('todos');
  const [editCampoSeccionId, setEditCampoSeccionId] = useState<string | null>(null);
  const [savingCampo, setSavingCampo] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  // ── Secciones ─────────────────────────────────────────────────────────────
  const [secciones, setSecciones] = useState<TramiteSeccion[]>([]);
  const [loadingSecciones, setLoadingSecciones] = useState(false);
  const [editingSeccion, setEditingSeccion] = useState<TramiteSeccion | null>(null);
  const [showAddSeccion, setShowAddSeccion] = useState(false);

  const loadSecciones = async () => {
    setLoadingSecciones(true);
    const { data } = await supabase
      .from('tramite_tipo_secciones')
      .select('*')
      .eq('tramite_tipo_id', tipoId)
      .eq('activo', true)
      .order('orden');
    if (data) setSecciones(data as TramiteSeccion[]);
    setLoadingSecciones(false);
  };

  const handleSaveSeccion = async (form: {
    nombre: string; descripcion: string; opcional: boolean;
    depende_de_seccion_id: string | null;
    condicion_campo_id: string | null;
    condicion_operador: 'igual_a' | 'distinto_a' | 'tiene_valor' | null;
    condicion_valor: string | null;
    fondo?: Record<string, any>;
  }) => {
    if (!form.nombre.trim()) return;
    // Mutuamente excluyentes: si hay condición por campo, no depende de otra sección.
    const dependeDeSeccion = form.condicion_campo_id ? null : form.depende_de_seccion_id;
    if (editingSeccion) {
      const { error } = await supabase
        .from('tramite_tipo_secciones')
        .update({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          opcional: form.opcional,
          depende_de_seccion_id: dependeDeSeccion,
          condicion_campo_id: form.condicion_campo_id,
          condicion_operador: form.condicion_campo_id ? form.condicion_operador : null,
          condicion_valor: form.condicion_campo_id ? form.condicion_valor : null,
          // El fondo solo aplica a la sección header; en las demás el editor ni se muestra.
          ...(editingSeccion.sistema_key === 'header' ? { config: { ...(editingSeccion.config ?? {}), fondo: form.fondo ?? {} } } : {}),
        })
        .eq('id', editingSeccion.id);
      if (error) { showToast('Error al guardar la sección: ' + error.message, 'error'); return; }
      showToast('Sección actualizada');
    } else {
      const maxOrden = secciones.reduce((m, s) => Math.max(m, s.orden), 0);
      const { error } = await supabase.from('tramite_tipo_secciones').insert({
        tramite_tipo_id: tipoId,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        opcional: form.opcional,
        depende_de_seccion_id: dependeDeSeccion,
        condicion_campo_id: form.condicion_campo_id,
        condicion_operador: form.condicion_campo_id ? form.condicion_operador : null,
        condicion_valor: form.condicion_campo_id ? form.condicion_valor : null,
        orden: maxOrden + 1,
      });
      if (error) { showToast('Error al crear la sección: ' + error.message, 'error'); return; }
      showToast('Sección creada');
    }
    setEditingSeccion(null);
    setShowAddSeccion(false);
    await loadSecciones();
  };

  const handleMoveSeccion = async (seccion: TramiteSeccion, direccion: 'arriba' | 'abajo') => {
    const idx = secciones.findIndex(s => s.id === seccion.id);
    const vecinoIdx = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (idx === -1 || vecinoIdx < 0 || vecinoIdx >= secciones.length) return;
    const vecino = secciones[vecinoIdx];

    // Swap de orden — optimista en UI, persistido en BD
    const reordenadas = [...secciones];
    reordenadas[idx] = { ...vecino, orden: seccion.orden };
    reordenadas[vecinoIdx] = { ...seccion, orden: vecino.orden };
    reordenadas.sort((a, b) => a.orden - b.orden);
    setSecciones(reordenadas);

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('tramite_tipo_secciones').update({ orden: vecino.orden }).eq('id', seccion.id),
      supabase.from('tramite_tipo_secciones').update({ orden: seccion.orden }).eq('id', vecino.id),
    ]);
    if (e1 || e2) { showToast('Error al reordenar: ' + (e1 || e2)?.message, 'error'); await loadSecciones(); }
  };

  const handleDeleteSeccion = async (seccion: TramiteSeccion) => {
    // Las secciones de sistema existen en todos los tipos por diseño. Sí se pueden
    // renombrar y mover, pero no borrar — el trigger las volvería a crear y el tipo
    // quedaría con sus campos de personas sueltos hasta entonces.
    if (seccion.sistema_key) {
      showToast('Esta sección es parte del sistema y no se puede eliminar. Puedes renombrarla o moverla.', 'error');
      return;
    }
    if (!confirm(`¿Eliminar la sección "${seccion.nombre}"? Sus campos quedarán sin sección (no se eliminan).`)) return;
    const { error } = await supabase.from('tramite_tipo_secciones').delete().eq('id', seccion.id);
    if (error) { showToast('Error al eliminar la sección: ' + error.message, 'error'); return; }
    showToast('Sección eliminada');
    await Promise.all([loadSecciones(), loadCampos()]);
  };

  const loadCampos = async () => {
    setLoadingCampos(true);
    const { data } = await supabase
      .from('tramite_tipo_campos')
      .select('*')
      .eq('tramite_tipo_id', tipoId)
      .eq('activo', true)
      .order('display_order');
    if (data) setCampos(data as TipoCampo[]);
    setLoadingCampos(false);
  };

  const reset = () => {
    setCampos([]);
    setSecciones([]);
    setShowAddField(false);
    setShowPreview(false);
    setEditingCampo(null);
    setEditingSeccion(null);
    setShowAddSeccion(false);
  };

  const startEditCampo = (campo: TipoCampo) => {
    flushAutoSaveCampo();
    skipNextAutoSaveRef.current = true;
    setEditingCampo(campo);
    setEditCampoLabel(campo.label);
    setEditCampoReq(campo.requerido);
    setEditCampoConfig({ ...(campo.config || {}) });
    setEditCampoAyuda(campo.ayuda || '');
    setEditCampoVisiblePara((campo.visible_para_rol ?? 'todos') as RolVisibilidad);
    setEditCampoEditablePara((campo.editable_para_rol ?? 'todos') as RolVisibilidad);
    setEditCampoSeccionId(campo.seccion_id ?? null);
    setShowAddField(false);
    setShowPreview(false);
  };

  const handleAddCampo = async (tipo: CampoTipo, seccionId: string | null = null) => {
    const meta = CAMPO_TIPOS.find(t => t.tipo === tipo);
    const base = meta?.label || 'Campo';

    // La clave salía de `campos.length + 1`, pero `loadCampos` solo trae los activos:
    // un campo oculto —o uno borrado y vuelto a agregar— conserva su `key` en la base y
    // hacía chocar el índice único (tramite_tipo_id, key), con un error de Postgres crudo
    // en pantalla. Se consultan las claves realmente ocupadas, activas o no.
    const { data: existentes } = await supabase
      .from('tramite_tipo_campos')
      .select('key, display_order')
      .eq('tramite_tipo_id', tipoId);
    const ocupadas = new Set((existentes ?? []).map(c => c.key));
    let n = campos.length + 1;
    while (ocupadas.has(slugify(`${base} ${n}`))) n++;

    const label = `${base} ${n}`;
    const key = slugify(label);
    const siguienteOrden = Math.max(0, ...(existentes ?? []).map(c => c.display_order ?? 0)) + 1;
    const defaultConfig: Record<string, any> = {};
    if (tipo === 'texto_corto') defaultConfig.max_length = 255;
    if (tipo === 'texto_largo') defaultConfig.max_length = 2000;
    if (tipo === 'numerico') defaultConfig.formato = 'decimal';
    if (tipo === 'porcentaje') { defaultConfig.min = 0; defaultConfig.max = 100; }
    if (tipo === 'rfc') defaultConfig.tipo_persona = 'ambos';
    if (tipo === 'telefono') defaultConfig.formato = 'mx';
    if (tipo === 'ramo') defaultConfig.filtrar_por_aseguradora = true;
    if (tipo === 'adjunto') {
      defaultConfig.tipos_mime = ['application/pdf'];
      defaultConfig.max_archivos = 1;
      defaultConfig.max_mb = 10;
    }
    if (tipo === 'estatus') defaultConfig.opciones = [
      { label: 'Pendiente', slug: 'pendiente', clasificacion: 'inicio' },
      { label: 'Completado', slug: 'completado', clasificacion: 'terminacion' },
    ];
    if (tipo === 'dropdown' || tipo === 'seleccion_multiple') defaultConfig.opciones = [{ label: 'Opción 1', slug: 'opcion_1' }];

    const { data, error } = await supabase
      .from('tramite_tipo_campos')
      .insert({ tramite_tipo_id: tipoId, key, label, tipo, requerido: false, display_order: siguienteOrden, config: defaultConfig, activo: true, seccion_id: seccionId })
      .select()
      .single();

    if (error) { showToast('Error al agregar campo: ' + error.message, 'error'); return; }
    if (data) {
      const nuevo = data as TipoCampo;
      setCampos(prev => [...prev, nuevo]);
      setShowAddField(false);
      startEditCampo(nuevo);
      logHistorial(tipoId, 'campo_agregado', { campo_label: nuevo.label, campo_tipo: nuevo.tipo, campo_key: nuevo.key }, usuario?.id, usuario?.nombre_completo ?? null);
    }
  };

  const handleSaveCampo = async () => {
    if (!editingCampo || !editCampoLabel.trim()) return;
    setSavingCampo(true);
    const { error } = await supabase
      .from('tramite_tipo_campos')
      .update({
        label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig,
        ayuda: editCampoAyuda.trim() || null, visible_para_rol: editCampoVisiblePara,
        editable_para_rol: editCampoEditablePara, seccion_id: editCampoSeccionId,
      })
      .eq('id', editingCampo.id);

    if (error) { showToast('Error al guardar campo', 'error'); setSavingCampo(false); return; }
    const cambiosCampo: Record<string, any> = { campo_key: editingCampo.key };
    if (editCampoLabel.trim() !== editingCampo.label) {
      cambiosCampo.label_antes = editingCampo.label;
      cambiosCampo.label_despues = editCampoLabel.trim();
    }
    logHistorial(tipoId, 'campo_actualizado', cambiosCampo, usuario?.id, usuario?.nombre_completo);
    setCampos(prev => prev.map(c =>
      c.id === editingCampo.id
        ? { ...c, label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda || null, visible_para_rol: editCampoVisiblePara, editable_para_rol: editCampoEditablePara, seccion_id: editCampoSeccionId }
        : c
    ));
    showToast('Cambios guardados automáticamente');
    setSavingCampo(false);
  };

  // ── Autoguardado del campo en edición ───────────────────────────────────────
  // Guarda solos con debounce mientras el admin edita, sin necesidad de un botón.
  const handleSaveCampoRef = useRef(handleSaveCampo);
  handleSaveCampoRef.current = handleSaveCampo;
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveDirtyRef = useRef(false);
  const skipNextAutoSaveRef = useRef(false);

  const flushAutoSaveCampo = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (autoSaveDirtyRef.current) {
      autoSaveDirtyRef.current = false;
      handleSaveCampoRef.current();
    }
  };

  const closeCampoEditor = () => {
    flushAutoSaveCampo();
    setEditingCampo(null);
  };

  useEffect(() => {
    if (!editingCampo) return;
    if (skipNextAutoSaveRef.current) { skipNextAutoSaveRef.current = false; return; }
    autoSaveDirtyRef.current = true;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveDirtyRef.current = false;
      autoSaveTimeoutRef.current = null;
      handleSaveCampoRef.current();
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCampoLabel, editCampoReq, editCampoConfig, editCampoAyuda, editCampoVisiblePara, editCampoEditablePara, editCampoSeccionId]);

  useEffect(() => () => flushAutoSaveCampo(), []);

  const handleDeleteCampo = async (campo: TipoCampo) => {
    // Campos fijos del sistema: nunca se pueden eliminar
    if (campo.is_sistema && LOCKED_SISTEMA_KEYS.includes(campo.sistema_key ?? '')) return;

    // Campos sistema configurables: se desactivan (ocultan del form), no se borran
    if (campo.is_sistema) {
      if (!confirm(`¿Ocultar "${campo.label}" de este tipo de trámite? Podrás volver a agregarlo desde el FormBuilder.`)) return;
      await supabase.from('tramite_tipo_campos').update({ activo: false }).eq('id', campo.id);
      logHistorial(tipoId, 'campo_ocultado', { campo_label: campo.label, campo_key: campo.key }, usuario?.id, usuario?.nombre_completo);
      setCampos(prev => prev.filter(c => c.id !== campo.id));
      if (editingCampo?.id === campo.id) setEditingCampo(null);
      showToast('Campo ocultado');
      return;
    }

    const { count } = await supabase
      .from('tramite_respuestas')
      .select('*', { count: 'exact', head: true })
      .eq('campo_id', campo.id);

    const hasData = (count || 0) > 0;
    const msg = hasData
      ? `Este campo tiene ${count} respuestas registradas. Se desactivará en trámites nuevos pero los datos históricos se conservan. ¿Continuar?`
      : '¿Eliminar este campo? Esta acción no se puede deshacer.';

    if (!confirm(msg)) return;

    if (hasData) {
      await supabase.from('tramite_tipo_campos').update({ activo: false }).eq('id', campo.id);
    } else {
      await supabase.from('tramite_tipo_campos').delete().eq('id', campo.id);
    }
    logHistorial(tipoId, 'campo_eliminado', { campo_label: campo.label, campo_key: campo.key, tenia_datos: hasData }, usuario?.id, usuario?.nombre_completo);
    setCampos(prev => prev.filter(c => c.id !== campo.id));
    if (editingCampo?.id === campo.id) setEditingCampo(null);
    showToast('Campo eliminado');
  };

  const handleAddSistemaCampo = async (sistemaKey: string) => {
    const defaults = SISTEMA_CAMPO_DEFAULTS[sistemaKey];
    if (!defaults) return;
    // Intentar restaurar si existe desactivado; si no, insertar nuevo
    const { data: existing } = await supabase
      .from('tramite_tipo_campos')
      .select('id')
      .eq('tramite_tipo_id', tipoId)
      .eq('sistema_key', sistemaKey)
      .eq('activo', false)
      .maybeSingle();

    if (existing) {
      await supabase.from('tramite_tipo_campos').update({ activo: true }).eq('id', existing.id);
    } else {
      await supabase
        .from('tramite_tipo_campos')
        .insert({
          tramite_tipo_id: tipoId,
          key: defaults.key,
          label: defaults.label,
          tipo: defaults.tipo,
          requerido: false,
          display_order: campos.length + 1,
          config: defaults.config,
          activo: true,
          is_sistema: true,
          sistema_key: sistemaKey,
        });
    }
    await loadCampos();
    setShowAddField(false);
    showToast('Campo de sistema agregado');
  };

  const isLocked = (campo: TipoCampo | undefined) =>
    !!campo?.is_sistema && LOCKED_SISTEMA_KEYS.includes(campo.sistema_key ?? '');

  const handleDragStart = (_e: React.DragEvent, index: number) => {
    if (isLocked(campos[index])) return;
    dragIdx.current = index;
    setDragging(index);
    _e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  /**
   * Un solo drop decide sección Y posición.
   *
   * Antes eran dos caminos separados: `handleDrop` reordenaba con un índice plano sobre
   * la lista completa, y `handleDropOnSeccion` cambiaba la sección sin tocar el orden —
   * así que un campo movido a otra sección caía donde le tocara por el display_order que
   * traía. Con los campos anidados dentro de su sección eso ya no tiene sentido.
   *
   * `display_order` se mantiene GLOBAL (no relativo a la sección): es lo que leen las
   * otras 7 pantallas del proyecto, y `agruparCamposPorSeccion` ya parte por sección, así
   * que el orden relativo dentro de cada una se respeta igual.
   */
  const handleDropEnPosicion = async (
    e: React.DragEvent,
    seccionDestinoId: string | null,
    indexEnSeccion: number
  ) => {
    e.preventDefault();
    setDragging(null);
    const idx = dragIdx.current;
    dragIdx.current = null;
    if (idx === null) return;

    const movido = campos[idx];
    if (!movido || isLocked(movido)) return;

    // Un campo de una sección de sistema se reordena dentro de ella, pero no sale.
    const seccionActual = secciones.find(s => s.id === movido.seccion_id);
    if (seccionActual?.sistema_key && seccionDestinoId !== movido.seccion_id) {
      showToast(`"${movido.label}" pertenece a "${seccionActual.nombre}" y no puede moverse fuera.`, 'error');
      return;
    }
    // Y tampoco se le meten campos ajenos.
    const seccionDestino = secciones.find(s => s.id === seccionDestinoId);
    if (seccionDestino?.sistema_key && seccionDestinoId !== movido.seccion_id) {
      showToast(`"${seccionDestino.nombre}" es una sección del sistema: sus campos son fijos.`, 'error');
      return;
    }

    // Orden visual actual: primero los sin sección, luego cada sección por su `orden`
    // — el mismo criterio de agruparCamposPorSeccion, para que lo que se ve coincida.
    const movibles = campos.filter(c => !isLocked(c));
    const claveGrupo = (seccionId: string | null | undefined) =>
      seccionId ? (secciones.find(s => s.id === seccionId)?.orden ?? 9999) + 1 : 0;
    const ordenVisual = [...movibles].sort((a, b) =>
      claveGrupo(a.seccion_id) - claveGrupo(b.seccion_id) || a.display_order - b.display_order
    );

    const sinMovido = ordenVisual.filter(c => c.id !== movido.id);
    const delDestino = sinMovido.filter(c => (c.seccion_id ?? null) === seccionDestinoId);
    const anclaPos = indexEnSeccion >= delDestino.length
      ? sinMovido.length
      : sinMovido.findIndex(c => c.id === delDestino[indexEnSeccion].id);

    const reordenado = [...sinMovido];
    reordenado.splice(anclaPos, 0, { ...movido, seccion_id: seccionDestinoId });

    const nuevoOrden = new Map(reordenado.map((c, i) => [c.id, i + 1]));
    const actualizados = campos.map(c => {
      if (isLocked(c)) return c;
      const display_order = nuevoOrden.get(c.id) ?? c.display_order;
      const seccion_id = c.id === movido.id ? seccionDestinoId : c.seccion_id;
      return { ...c, display_order, seccion_id };
    });

    // Solo se escriben las filas que de verdad cambiaron, y en paralelo. Antes se mandaba
    // un UPDATE por campo en serie aunque no hubiera cambiado nada.
    const cambiados = actualizados.filter(c => {
      const antes = campos.find(o => o.id === c.id)!;
      return antes.display_order !== c.display_order || (antes.seccion_id ?? null) !== (c.seccion_id ?? null);
    });
    if (cambiados.length === 0) return;

    setCampos(actualizados);
    const resultados = await Promise.all(cambiados.map(c =>
      supabase.from('tramite_tipo_campos')
        .update({ display_order: c.display_order, seccion_id: c.seccion_id ?? null })
        .eq('id', c.id)
    ));
    const fallo = resultados.find(r => r.error);
    if (fallo?.error) {
      showToast('Error al reordenar: ' + fallo.error.message, 'error');
      await loadCampos();
    }
  };

  return {
    campos, loadingCampos, loadCampos, reset,
    showAddField, setShowAddField,
    showPreview, setShowPreview,
    editingCampo, setEditingCampo, startEditCampo, closeCampoEditor,
    editCampoLabel, setEditCampoLabel,
    editCampoReq, setEditCampoReq,
    editCampoConfig, setEditCampoConfig,
    editCampoAyuda, setEditCampoAyuda,
    editCampoVisiblePara, setEditCampoVisiblePara,
    editCampoEditablePara, setEditCampoEditablePara,
    editCampoSeccionId, setEditCampoSeccionId,
    savingCampo,
    dragging,
    handleAddCampo, handleAddSistemaCampo, handleSaveCampo, handleDeleteCampo,
    handleDragStart, handleDragOver, handleDropEnPosicion,
    // Secciones
    secciones, loadingSecciones, loadSecciones,
    editingSeccion, setEditingSeccion,
    showAddSeccion, setShowAddSeccion,
    handleSaveSeccion, handleDeleteSeccion, handleMoveSeccion,
  };
}
