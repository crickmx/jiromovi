import { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { type TipoCampo, type CampoTipo, type RolVisibilidad, CAMPO_TIPOS, slugify } from './types';
import { logHistorial } from './logHistorial';

// Campos sistema que nunca se pueden mover ni eliminar
export const LOCKED_SISTEMA_KEYS = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion'];

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
  const [savingCampo, setSavingCampo] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

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
    setShowAddField(false);
    setShowPreview(false);
    setEditingCampo(null);
  };

  const startEditCampo = (campo: TipoCampo) => {
    setEditingCampo(campo);
    setEditCampoLabel(campo.label);
    setEditCampoReq(campo.requerido);
    setEditCampoConfig({ ...(campo.config || {}) });
    setEditCampoAyuda(campo.ayuda || '');
    setEditCampoVisiblePara((campo.visible_para_rol ?? 'todos') as RolVisibilidad);
    setEditCampoEditablePara((campo.editable_para_rol ?? 'todos') as RolVisibilidad);
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
      .update({ label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda.trim() || null, visible_para_rol: editCampoVisiblePara, editable_para_rol: editCampoEditablePara })
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
        ? { ...c, label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda || null, visible_para_rol: editCampoVisiblePara, editable_para_rol: editCampoEditablePara }
        : c
    ));
    setEditingCampo(null);
    showToast('Campo guardado');
    setSavingCampo(false);
  };

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

  return {
    campos, loadingCampos, loadCampos, reset,
    showAddField, setShowAddField,
    showPreview, setShowPreview,
    editingCampo, setEditingCampo, startEditCampo,
    editCampoLabel, setEditCampoLabel,
    editCampoReq, setEditCampoReq,
    editCampoConfig, setEditCampoConfig,
    editCampoAyuda, setEditCampoAyuda,
    editCampoVisiblePara, setEditCampoVisiblePara,
    editCampoEditablePara, setEditCampoEditablePara,
    savingCampo,
    dragging,
    handleAddCampo, handleAddSistemaCampo, handleSaveCampo, handleDeleteCampo,
    handleDragStart, handleDragOver, handleDrop,
  };
}
