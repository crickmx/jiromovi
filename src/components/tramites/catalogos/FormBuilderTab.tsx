import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Settings, GripVertical, X, Eye, Lock, Zap } from 'lucide-react';
import { useFormBuilder } from './useFormBuilder';
import { FormPreview } from './FormPreview';
import { CAMPO_TIPOS, SISTEMA_TIPO_META, MIME_OPTIONS, slugify } from './types';
import { supabase } from '../../../lib/supabase';

interface Props {
  tipoId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onGoToTriggers?: () => void;
}

export function FormBuilderTab({ tipoId, showToast, onGoToTriggers }: Props) {
  const [adjuntoCategorias, setAdjuntoCategorias] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    supabase.from('maestro_adjunto_categorias').select('id, nombre').eq('activo', true).order('orden')
      .then(({ data }) => { if (data) setAdjuntoCategorias(data); });
  }, []);

  const {
    campos, loadingCampos, loadCampos,
    showAddField, setShowAddField,
    showPreview, setShowPreview,
    editingCampo, setEditingCampo, startEditCampo,
    editCampoLabel, setEditCampoLabel,
    editCampoReq, setEditCampoReq,
    editCampoConfig, setEditCampoConfig,
    editCampoAyuda, setEditCampoAyuda,
    savingCampo, dragging,
    handleAddCampo, handleSaveCampo, handleDeleteCampo,
    handleDragStart, handleDragOver, handleDrop,
  } = useFormBuilder(tipoId, showToast);

  useEffect(() => { loadCampos(); }, [tipoId]);

  const sistemaCampos = campos.filter(c => c.is_sistema).sort((a, b) => a.display_order - b.display_order);
  const customCampos  = campos.filter(c => !c.is_sistema).sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Canvas */}
      <div className="flex-1 p-4 overflow-auto">
        {loadingCampos ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">
                {customCampos.length} campo{customCampos.length !== 1 ? 's' : ''} personalizados
                {!showPreview && customCampos.length > 0 && ' · arrastra para reordenar'}
              </p>
              {campos.length > 0 && (
                <button
                  onClick={() => { setShowPreview(!showPreview); setEditingCampo(null); setShowAddField(false); }}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    showPreview ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? 'Editar' : 'Vista previa'}
                </button>
              )}
            </div>

            {showPreview ? (
              <FormPreview campos={campos} />
            ) : (
              <>
                {/* ── Sección 1: Campos sistema (FIJOS) ── */}
                {sistemaCampos.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lock className="w-3 h-3 text-neutral-400" />
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Sección 1 — Siempre presentes en todos los formularios
                      </p>
                    </div>
                    <div className="space-y-1 border border-neutral-200 rounded-xl p-2 bg-neutral-50/60">
                      {sistemaCampos.map((campo) => {
                        const meta = SISTEMA_TIPO_META[campo.tipo];
                        const isEditableConfig = campo.tipo === 'estatus';
                        return (
                          <div
                            key={campo.id}
                            className={`flex items-center gap-2 border rounded-lg p-2 bg-white transition-colors ${
                              editingCampo?.id === campo.id
                                ? 'border-violet-400 ring-1 ring-violet-200'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="p-1 text-neutral-200">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-violet-50 text-violet-600 font-mono">
                              {meta?.icon ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-700 truncate">{campo.label}</p>
                              <p className="text-[10px] text-neutral-400">{meta?.desc ?? campo.tipo}</p>
                            </div>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-500 border border-violet-200 shrink-0">
                              {meta?.badge ?? 'Sistema'}
                            </span>
                            {isEditableConfig && (
                              <button
                                onClick={() => editingCampo?.id === campo.id ? setEditingCampo(null) : startEditCampo(campo)}
                                className="p-1.5 hover:bg-violet-50 rounded-lg transition-colors text-neutral-400 hover:text-violet-600"
                                title="Configurar opciones de estatus"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Sección 2: Campos personalizados ── */}
                {(sistemaCampos.length > 0 || customCampos.length > 0) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Sección 2 — Campos del formulario
                    </p>
                  </div>
                )}

                {customCampos.length === 0 && sistemaCampos.length > 0 && (
                  <div className="text-center py-8 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl mb-2">
                    <p className="text-sm text-neutral-400">Sin campos personalizados aún</p>
                    <p className="text-xs mt-1">Agrega campos específicos para este tipo de trámite</p>
                  </div>
                )}

                {customCampos.length === 0 && sistemaCampos.length === 0 && (
                  <div className="text-center py-12 text-neutral-400">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-neutral-100 flex items-center justify-center">
                      <Plus className="w-7 h-7 text-neutral-300" />
                    </div>
                    <p className="text-sm font-medium text-neutral-500">Sin campos definidos</p>
                    <p className="text-xs mt-1 mb-4">Los campos del sistema se crean automáticamente.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  {customCampos.map((campo) => {
                    const idx = campos.findIndex(c => c.id === campo.id);
                    return (
                      <div
                        key={campo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => {}}
                        className={`flex items-center gap-2 border rounded-xl p-2.5 bg-white transition-opacity ${
                          dragging === idx ? 'opacity-30' : 'opacity-100'
                        } ${editingCampo?.id === campo.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-neutral-200'}`}
                      >
                        <div className="cursor-grab p-1 text-neutral-300 hover:text-neutral-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-blue-50 text-blue-600 font-mono">
                          {CAMPO_TIPOS.find(t => t.tipo === campo.tipo)?.icon ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{campo.label}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{campo.key}</p>
                        </div>
                        {campo.requerido && (
                          <span className="text-[10px] text-red-500 font-mono shrink-0">req</span>
                        )}
                        <button
                          onClick={() => editingCampo?.id === campo.id ? setEditingCampo(null) : startEditCampo(campo)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-700"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampo(campo)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-neutral-300 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => { setShowAddField(!showAddField); setEditingCampo(null); }}
                  className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 rounded-xl py-2.5 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar campo
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Right panel */}
      {(showAddField || editingCampo) && (
        <div className="w-64 border-l border-neutral-200 bg-neutral-50 p-4 overflow-auto shrink-0">
          {showAddField && !editingCampo && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tipo de campo</p>
                <button onClick={() => setShowAddField(false)} className="p-1 hover:bg-neutral-200 rounded">
                  <X className="w-3.5 h-3.5 text-neutral-500" />
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(
                  CAMPO_TIPOS.reduce<Record<string, typeof CAMPO_TIPOS>>((acc, ct) => {
                    (acc[ct.grupo] = acc[ct.grupo] || []).push(ct);
                    return acc;
                  }, {})
                ).map(([grupo, tipos]) => (
                  <div key={grupo}>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 px-0.5">{grupo}</p>
                    <div className="space-y-1">
                      {tipos.map(({ tipo, label, icon, desc }) => (
                        <button
                          key={tipo}
                          onClick={() => handleAddCampo(tipo)}
                          className="w-full flex items-center gap-2.5 p-2 bg-white border border-neutral-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0 font-mono">
                            {icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{label}</p>
                            <p className="text-[10px] text-neutral-400 leading-tight">{desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {editingCampo && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {editingCampo.is_sistema ? 'Campo sistema' : 'Configurar campo'}
                </p>
                <button onClick={() => setEditingCampo(null)} className="p-1 hover:bg-neutral-200 rounded">
                  <X className="w-3.5 h-3.5 text-neutral-500" />
                </button>
              </div>

              {editingCampo.is_sistema && editingCampo.tipo !== 'estatus' && (
                <div className="mb-3 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 leading-relaxed">
                  {SISTEMA_TIPO_META[editingCampo.tipo]?.desc ?? 'Campo del sistema, no configurable.'}
                </div>
              )}

              <div className="space-y-3">
                {!editingCampo.is_sistema && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Etiqueta *</label>
                      <input
                        type="text"
                        value={editCampoLabel}
                        onChange={(e) => setEditCampoLabel(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Texto de ayuda</label>
                      <input
                        type="text"
                        value={editCampoAyuda}
                        onChange={(e) => setEditCampoAyuda(e.target.value)}
                        placeholder="Ej: incluye prefijo 52"
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editCampoReq}
                        onChange={(e) => setEditCampoReq(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-neutral-700">Campo requerido</span>
                    </label>
                  </>
                )}

                {(editingCampo.tipo === 'texto_corto' || editingCampo.tipo === 'texto_largo') && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Longitud máxima</label>
                    <input
                      type="number"
                      value={editCampoConfig.max_length ?? (editingCampo.tipo === 'texto_corto' ? 255 : 2000)}
                      onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_length: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg"
                    />
                  </div>
                )}

                {editingCampo.tipo === 'numerico' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Formato</label>
                      <select
                        value={editCampoConfig.formato || (editCampoConfig.es_entero ? 'entero' : 'decimal')}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, formato: e.target.value, es_entero: e.target.value === 'entero' })}
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg"
                      >
                        <option value="decimal">Decimal</option>
                        <option value="entero">Entero</option>
                        <option value="moneda">Moneda (MXN $)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Mínimo</label>
                        <input type="number"
                          value={editCampoConfig.min ?? ''}
                          onChange={(e) => setEditCampoConfig({ ...editCampoConfig, min: e.target.value !== '' ? Number(e.target.value) : undefined })}
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Máximo</label>
                        <input type="number"
                          value={editCampoConfig.max ?? ''}
                          onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max: e.target.value !== '' ? Number(e.target.value) : undefined })}
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                      </div>
                    </div>
                  </>
                )}

                {editingCampo.tipo === 'adjunto' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tipos de archivo</label>
                      <div className="space-y-1">
                        {MIME_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={(editCampoConfig.tipos_mime || []).includes(opt.value)}
                              onChange={(e) => {
                                const current: string[] = editCampoConfig.tipos_mime || [];
                                setEditCampoConfig({
                                  ...editCampoConfig,
                                  tipos_mime: e.target.checked ? [...current, opt.value] : current.filter(m => m !== opt.value),
                                });
                              }}
                              className="rounded"
                            />
                            <span className="text-sm text-neutral-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Máx. archivos</label>
                        <input type="number" min="1"
                          value={editCampoConfig.max_archivos || 1}
                          onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_archivos: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Máx. MB</label>
                        <input type="number" min="1"
                          value={editCampoConfig.max_mb || 10}
                          onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_mb: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría del archivo</label>
                      <select
                        value={editCampoConfig.categoria_id || ''}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, categoria_id: e.target.value || null })}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white"
                      >
                        <option value="">— Usuario elige al adjuntar —</option>
                        {adjuntoCategorias.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-neutral-400 mt-1">Si se define aquí, el archivo se categoriza automáticamente sin pedirle al usuario.</p>
                    </div>
                  </>
                )}

                {editingCampo.tipo === 'estatus' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre del campo</label>
                      <input
                        type="text"
                        value={editCampoLabel}
                        onChange={(e) => setEditCampoLabel(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Opciones de estatus</label>
                    {(editCampoConfig.opciones || []).map((opt: { label: string; slug: string; clasificacion?: string | null }, i: number) => (
                      <div key={i} className="flex gap-1 mb-1.5 items-center">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => {
                            const opts = [...(editCampoConfig.opciones || [])];
                            opts[i] = { ...opts[i], label: e.target.value, slug: slugify(e.target.value) || opts[i].slug };
                            setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        />
                        <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-[10px] font-medium shrink-0">
                          <button
                            onClick={() => {
                              const opts = [...(editCampoConfig.opciones || [])];
                              opts[i] = { ...opts[i], clasificacion: opt.clasificacion === 'inicio' ? null : 'inicio' };
                              setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                            }}
                            className={`px-2 py-1 transition-colors ${opt.clasificacion === 'inicio' ? 'bg-green-500 text-white' : 'bg-white text-neutral-400 hover:bg-green-50 hover:text-green-600'}`}
                          >Inicio</button>
                          <button
                            onClick={() => {
                              const opts = [...(editCampoConfig.opciones || [])];
                              opts[i] = { ...opts[i], clasificacion: opt.clasificacion === 'terminacion' ? null : 'terminacion' };
                              setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                            }}
                            className={`px-2 py-1 border-l border-neutral-200 transition-colors ${opt.clasificacion === 'terminacion' ? 'bg-red-500 text-white' : 'bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600'}`}
                          >Fin</button>
                          <button
                            onClick={() => {
                              const opts = [...(editCampoConfig.opciones || [])];
                              opts[i] = { ...opts[i], clasificacion: opt.clasificacion === 'en_espera' ? null : 'en_espera' };
                              setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                            }}
                            className={`px-2 py-1 border-l border-neutral-200 transition-colors ${opt.clasificacion === 'en_espera' ? 'bg-amber-500 text-white' : 'bg-white text-neutral-400 hover:bg-amber-50 hover:text-amber-600'}`}
                          >Espera</button>
                        </div>
                        <button
                          onClick={() => {
                            const opts = (editCampoConfig.opciones || []).filter((_: any, j: number) => j !== i);
                            setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                          }}
                          className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const opts = [...(editCampoConfig.opciones || []), { label: 'Nueva opción', slug: 'nueva_opcion', clasificacion: null }];
                        setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                      }}
                      className="mt-1 w-full text-xs py-1 border border-dashed border-neutral-300 rounded-lg hover:border-blue-400 hover:text-blue-600 text-neutral-500 transition-colors"
                    >+ Agregar opción</button>
                    </div>
                    {onGoToTriggers && (
                      <button
                        onClick={onGoToTriggers}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Configurar triggers de estatus
                      </button>
                    )}
                  </div>
                )}

                {(editingCampo.tipo === 'dropdown' || editingCampo.tipo === 'seleccion_multiple') && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Opciones</label>
                    {(editCampoConfig.opciones || []).map((opt: { label: string; slug: string }, i: number) => (
                      <div key={i} className="flex gap-1 mb-1">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => {
                            const opts = [...(editCampoConfig.opciones || [])];
                            opts[i] = { label: e.target.value, slug: slugify(e.target.value) || opts[i].slug };
                            setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const opts = (editCampoConfig.opciones || []).filter((_: any, j: number) => j !== i);
                            setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                          }}
                          className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const opts = [...(editCampoConfig.opciones || []), { label: 'Nueva opción', slug: 'nueva_opcion' }];
                        setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                      }}
                      className="mt-1 w-full text-xs py-1 border border-dashed border-neutral-300 rounded-lg hover:border-blue-400 hover:text-blue-600 text-neutral-500 transition-colors"
                    >+ Agregar opción</button>
                  </div>
                )}

                {editingCampo.tipo === 'fecha' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha mínima</label>
                      <input type="date"
                        value={editCampoConfig.min_fecha || ''}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, min_fecha: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha máxima</label>
                      <input type="date"
                        value={editCampoConfig.max_fecha || ''}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_fecha: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg" />
                    </div>
                  </div>
                )}

                {/* ── Configuración de tipos nuevos ── */}

                {editingCampo.tipo === 'rfc' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo de persona</label>
                    <select
                      value={editCampoConfig.tipo_persona || 'ambos'}
                      onChange={(e) => setEditCampoConfig({ ...editCampoConfig, tipo_persona: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg"
                    >
                      <option value="ambos">Física y Moral</option>
                      <option value="fisica">Solo Persona Física (13 chars)</option>
                      <option value="moral">Solo Persona Moral (12 chars)</option>
                    </select>
                  </div>
                )}

                {editingCampo.tipo === 'telefono' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Formato</label>
                    <select
                      value={editCampoConfig.formato || 'mx'}
                      onChange={(e) => setEditCampoConfig({ ...editCampoConfig, formato: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg"
                    >
                      <option value="mx">México — 10 dígitos</option>
                      <option value="internacional">Internacional (+52...)</option>
                    </select>
                  </div>
                )}

                {editingCampo.tipo === 'porcentaje' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Mínimo</label>
                      <input type="number"
                        value={editCampoConfig.min ?? 0}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, min: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Máximo</label>
                      <input type="number"
                        value={editCampoConfig.max ?? 100}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg" />
                    </div>
                  </div>
                )}

                {editingCampo.tipo === 'ramo' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editCampoConfig.filtrar_por_aseguradora !== false}
                      onChange={(e) => setEditCampoConfig({ ...editCampoConfig, filtrar_por_aseguradora: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-neutral-700">Filtrar por aseguradora del formulario</span>
                  </label>
                )}

                {(['aseguradora', 'codigo_postal', 'email', 'curp'] as const).some(t => t === editingCampo.tipo) && (
                  <div className="text-xs text-neutral-500 bg-neutral-100 rounded-lg px-3 py-2 leading-relaxed">
                    {editingCampo.tipo === 'aseguradora' && 'Lee el catálogo de aseguradoras activas automáticamente.'}
                    {editingCampo.tipo === 'codigo_postal' && 'Valida contra el catálogo de CP en Base de Datos Maestros.'}
                    {editingCampo.tipo === 'email' && 'Valida formato de correo electrónico mientras el usuario escribe.'}
                    {editingCampo.tipo === 'curp' && 'Valida formato CURP (18 caracteres, patrón oficial).'}
                  </div>
                )}

                {/* ── Visibilidad condicional ── */}
                {!editingCampo.is_sistema && editingCampo.tipo !== 'estatus' && (
                  <div className="pt-3 border-t border-neutral-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                      <input
                        type="checkbox"
                        checked={editCampoConfig.condicion_activa || false}
                        onChange={(e) => setEditCampoConfig({ ...editCampoConfig, condicion_activa: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs font-medium text-neutral-600">Mostrar condicionalmente</span>
                    </label>
                    {editCampoConfig.condicion_activa && (
                      <div className="space-y-2 pl-3 border-l-2 border-amber-300">
                        <div>
                          <label className="block text-[11px] text-neutral-500 mb-0.5">Si el campo...</label>
                          <select
                            value={editCampoConfig.campo_fuente || ''}
                            onChange={(e) => setEditCampoConfig({ ...editCampoConfig, campo_fuente: e.target.value })}
                            className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg"
                          >
                            <option value="">Selecciona campo...</option>
                            {campos.filter(c => c.id !== editingCampo.id).map(c => (
                              <option key={c.id} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <select
                          value={editCampoConfig.condicion_operador || 'igual_a'}
                          onChange={(e) => setEditCampoConfig({ ...editCampoConfig, condicion_operador: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg"
                        >
                          <option value="igual_a">es igual a</option>
                          <option value="distinto_a">es distinto de</option>
                          <option value="tiene_valor">tiene algún valor</option>
                        </select>
                        {(editCampoConfig.condicion_operador || 'igual_a') !== 'tiene_valor' && (() => {
                          const fuenteCampo = campos.find(c => c.key === editCampoConfig.campo_fuente);
                          const fuenteOpciones: { label: string; slug: string }[] = (fuenteCampo as any)?.config?.opciones || [];
                          return fuenteOpciones.length > 0 ? (
                            <select
                              value={editCampoConfig.condicion_valor || ''}
                              onChange={(e) => setEditCampoConfig({ ...editCampoConfig, condicion_valor: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg bg-white"
                            >
                              <option value="">Selecciona opción...</option>
                              {fuenteOpciones.map(opt => (
                                <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={editCampoConfig.condicion_valor || ''}
                              onChange={(e) => setEditCampoConfig({ ...editCampoConfig, condicion_valor: e.target.value })}
                              placeholder="valor esperado..."
                              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg"
                            />
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {(!editingCampo.is_sistema || editingCampo.tipo === 'estatus') && (
                  <button
                    onClick={handleSaveCampo}
                    disabled={savingCampo || !editCampoLabel.trim()}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingCampo ? 'Guardando...' : 'Guardar campo'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
