import { useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { TipoCampo, CampoTipo, CAMPO_TIPOS, slugify } from './types';
import { logHistorial } from './logHistorial';

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
      .update({ label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda.trim() || null })
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
        ? { ...c, label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda || null }
        : c
    ));
    setEditingCampo(null);
    showToast('Campo guardado');
    setSavingCampo(false);
  };

  const handleDeleteCampo = async (campo: TipoCampo) => {
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

  const handleDragStart = (_e: React.DragEvent, index: number) => {
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
    const reordered = [...campos];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(dropIndex, 0, moved);
    const updated = reordered.map((c, i) => ({ ...c, display_order: i + 1 }));
    setCampos(updated);
    dragIdx.current = null;
    for (const c of updated) {
      await supabase.from('tramite_tipo_campos').update({ display_order: c.display_order }).eq('id', c.id);
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
    savingCampo,
    dragging,
    handleAddCampo, handleSaveCampo, handleDeleteCampo,
    handleDragStart, handleDragOver, handleDrop,
  };
}
