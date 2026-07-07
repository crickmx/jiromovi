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

  const handleAddCampo = async (tipo: CampoTipo) => {
    const meta = CAMPO_TIPOS.find(t => t.tipo === tipo);
    const label = (meta?.label || 'Campo') + ' ' + (campos.length + 1);
    const key = slugify(label);
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
      .insert({ tramite_tipo_id: tipoId, key, label, tipo, requerido: false, display_order: campos.length + 1, config: defaultConfig, activo: true })
      .select()
      .single();

    if (error) { showToast('Error al agregar campo: ' + error.message, 'error'); return; }
    if (data) {
      const nuevo = data as TipoCampo;
      setCampos(prev => [...prev, nuevo]);
      setShowAddField(false);
      startEditCampo(nuevo);
      logHistorial(tipoId, 'campo_agregado', { campo_label: nuevo.label, campo_tipo: nuevo.tipo, campo_key: nuevo.key }, usuario?.id, usuario?.nombre_completo);
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

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragging(null);
    if (dragIdx.current === null || dragIdx.current === dropIndex) return;
    if (isLocked(campos[dragIdx.current]) || isLocked(campos[dropIndex])) return;
    const reordered = [...campos];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(dropIndex, 0, moved);
    // Asignar display_order secuencial solo a los campos no-bloqueados; los bloqueados conservan sus valores negativos
    let order = 1;
    const updated = reordered.map(c =>
      isLocked(c) ? c : { ...c, display_order: order++ }
    );
    setCampos(updated);
    dragIdx.current = null;
    for (const c of updated) {
      if (!isLocked(c)) {
        await supabase.from('tramite_tipo_campos').update({ display_order: c.display_order }).eq('id', c.id);
      }
    }
  };

  const handleDropOnSeccion = async (e: React.DragEvent, seccionId: string | null) => {
    e.preventDefault();
    setDragging(null);
    const idx = dragIdx.current;
    dragIdx.current = null;
    if (idx === null) return;
    const campo = campos[idx];
    if (!campo || isLocked(campo) || campo.seccion_id === seccionId) return;
    setCampos(prev => prev.map(c => c.id === campo.id ? { ...c, seccion_id: seccionId } : c));
    const { error } = await supabase.from('tramite_tipo_campos').update({ seccion_id: seccionId }).eq('id', campo.id);
    if (error) { showToast('Error al asignar el campo a la sección: ' + error.message, 'error'); return; }
    showToast(seccionId ? 'Campo asignado a la sección' : 'Campo removido de la sección');
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
    handleDragStart, handleDragOver, handleDrop, handleDropOnSeccion,
    // Secciones
    secciones, loadingSecciones, loadSecciones,
    editingSeccion, setEditingSeccion,
    showAddSeccion, setShowAddSeccion,
    handleSaveSeccion, handleDeleteSeccion, handleMoveSeccion,
  };
}
