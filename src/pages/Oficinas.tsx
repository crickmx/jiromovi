import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  X,
  Settings,
  Layers
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import { AreasManager } from '../components/AreasManager';

type Oficina = Database['public']['Tables']['oficinas']['Row'];
type Usuario = Database['public']['Tables']['usuarios']['Row'];
type CampoPersonalizado = Database['public']['Tables']['campos_personalizados_oficinas']['Row'];
type ValorCampo = Database['public']['Tables']['valores_campos_oficinas']['Row'];

export function Oficinas() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, Usuario[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [customFieldsModalOpen, setCustomFieldsModalOpen] = useState(false);
  const [selectedOficina, setSelectedOficina] = useState<Oficina | null>(null);
  const [expandedOficina, setExpandedOficina] = useState<string | null>(null);
  const [camposPersonalizados, setCamposPersonalizados] = useState<CampoPersonalizado[]>([]);
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nombre: '',
    director: '',
    gerente: '',
    telefono: '',
    email: '',
    domicilio: '',
    facebook: '',
    instagram: '',
    activa: true,
    es_espacio_jiro: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [areasManagerOpen, setAreasManagerOpen] = useState(false);
  const [selectedOficinaForAreas, setSelectedOficinaForAreas] = useState<Oficina | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [oficinasRes, camposRes] = await Promise.all([
      supabase.from('oficinas').select('*').order('nombre'),
      supabase.from('campos_personalizados_oficinas').select('*').eq('activo', true),
    ]);

    if (oficinasRes.data) {
      setOficinas(oficinasRes.data);

      const usuariosMap: Record<string, Usuario[]> = {};
      for (const oficina of oficinasRes.data) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('oficina_id', oficina.id)
          .order('nombre');

        if (data) {
          usuariosMap[oficina.id] = data;
        }
      }
      setUsuarios(usuariosMap);
    }

    if (camposRes.data) {
      setCamposPersonalizados(camposRes.data);
    }

    setLoading(false);
  };

  const loadValoresCampos = async (oficinaId: string) => {
    const { data } = await supabase
      .from('valores_campos_oficinas')
      .select('campo_id, valor')
      .eq('oficina_id', oficinaId);

    if (data) {
      const valores: Record<string, string> = {};
      data.forEach((item) => {
        valores[item.campo_id] = item.valor;
      });
      setValoresCampos(valores);
    }
  };

  const openModal = async (oficina: Oficina | null = null) => {
    setSelectedOficina(oficina);
    setFormData({
      nombre: oficina?.nombre || '',
      director: oficina?.director || '',
      gerente: oficina?.gerente || '',
      telefono: oficina?.telefono || '',
      email: oficina?.email || '',
      domicilio: oficina?.domicilio || '',
      facebook: oficina?.facebook || '',
      instagram: oficina?.instagram || '',
      activa: oficina?.activa ?? true,
      es_espacio_jiro: oficina?.es_espacio_jiro ?? false,
    });

    if (oficina) {
      await loadValoresCampos(oficina.id);
    } else {
      setValoresCampos({});
    }

    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let oficinaId = selectedOficina?.id;

      if (selectedOficina) {
        const { error: updateError } = await supabase
          .from('oficinas')
          .update({
            nombre: formData.nombre,
            director: formData.director,
            gerente: formData.gerente,
            telefono: formData.telefono,
            email: formData.email,
            domicilio: formData.domicilio,
            facebook: formData.facebook,
            instagram: formData.instagram,
            activa: formData.activa,
            es_espacio_jiro: formData.es_espacio_jiro,
          })
          .eq('id', selectedOficina.id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('oficinas')
          .insert({
            nombre: formData.nombre,
            director: formData.director,
            gerente: formData.gerente,
            telefono: formData.telefono,
            email: formData.email,
            domicilio: formData.domicilio,
            facebook: formData.facebook,
            instagram: formData.instagram,
            activa: formData.activa,
            es_espacio_jiro: formData.es_espacio_jiro,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        oficinaId = data?.id;
      }

      if (oficinaId && camposPersonalizados.length > 0) {
        for (const campo of camposPersonalizados) {
          const valor = valoresCampos[campo.id] || '';

          const { error: upsertError } = await supabase
            .from('valores_campos_oficinas')
            .upsert({
              oficina_id: oficinaId,
              campo_id: campo.id,
              valor,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'oficina_id,campo_id'
            });

          if (upsertError) throw upsertError;
        }
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error al guardar oficina');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta oficina? Los usuarios asociados quedarán sin oficina asignada.')) {
      return;
    }

    const { error } = await supabase.from('oficinas').delete().eq('id', id);

    if (error) {
      alert('Error al eliminar oficina');
    } else {
      loadData();
    }
  };

  const handleToggleActive = async (oficina: Oficina) => {
    const { error } = await supabase
      .from('oficinas')
      .update({ activa: !oficina.activa })
      .eq('id', oficina.id);

    if (error) {
      alert('Error al actualizar estado');
    } else {
      loadData();
    }
  };

  const handleAddCustomField = async () => {
    if (!newFieldName.trim()) return;

    const { error } = await supabase
      .from('campos_personalizados_oficinas')
      .insert({
        nombre_campo: newFieldName,
        tipo: newFieldType,
        activo: true,
      });

    if (error) {
      alert('Error al crear campo personalizado');
    } else {
      setNewFieldName('');
      setNewFieldType('text');
      loadData();
    }
  };

  const handleDeleteCustomField = async (campoId: string) => {
    if (!confirm('¿Estás seguro de eliminar este campo? Se eliminarán todos los valores asociados.')) {
      return;
    }

    const { error } = await supabase
      .from('campos_personalizados_oficinas')
      .delete()
      .eq('id', campoId);

    if (error) {
      alert('Error al eliminar campo personalizado');
    } else {
      loadData();
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Building2 className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Gestión de Oficinas</h1>
                <p className="text-blue-100 mt-1">Administra las oficinas de la empresa</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setCustomFieldsModalOpen(true)}
                className="flex items-center space-x-2 bg-white/90 backdrop-blur text-blue-900 px-4 py-2 rounded-lg font-semibold hover:bg-white border-2 border-white/50 transition shadow-sm"
              >
                <Settings className="w-5 h-5" />
                <span>Campos Personalizados</span>
              </button>
              <button
                onClick={() => openModal()}
                className="flex items-center space-x-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Nueva Oficina</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 gap-6">
            {oficinas.map((oficina) => (
              <div
                key={oficina.id}
                className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {oficina.nombre}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {oficina.director && (
                          <div className="flex items-center text-slate-600">
                            <span className="font-medium mr-2">Director:</span>
                            {oficina.director}
                          </div>
                        )}
                        {oficina.gerente && (
                          <div className="flex items-center text-slate-600">
                            <span className="font-medium mr-2">Gerente:</span>
                            {oficina.gerente}
                          </div>
                        )}
                        {oficina.telefono && (
                          <div className="flex items-center text-slate-600">
                            <Phone className="w-4 h-4 mr-2" />
                            {oficina.telefono}
                          </div>
                        )}
                        {oficina.email && (
                          <div className="flex items-center text-slate-600">
                            <Mail className="w-4 h-4 mr-2" />
                            {oficina.email}
                          </div>
                        )}
                        {oficina.domicilio && (
                          <div className="flex items-center text-slate-600 md:col-span-2">
                            <MapPin className="w-4 h-4 mr-2" />
                            {oficina.domicilio}
                          </div>
                        )}
                        <div className="flex items-center space-x-3">
                          {oficina.facebook && (
                            <a
                              href={oficina.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Facebook className="w-5 h-5" />
                            </a>
                          )}
                          {oficina.instagram && (
                            <a
                              href={oficina.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pink-600 hover:text-pink-700"
                            >
                              <Instagram className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(oficina)}
                      className="flex items-center space-x-2 ml-4"
                    >
                      {oficina.activa ? (
                        <>
                          <ToggleRight className="w-6 h-6 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Activa</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                          <span className="text-sm text-slate-400 font-medium">Inactiva</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-300">
                    <button
                      onClick={() => setExpandedOficina(expandedOficina === oficina.id ? null : oficina.id)}
                      className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition"
                    >
                      <Users className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {usuarios[oficina.id]?.length || 0} Usuario(s)
                      </span>
                    </button>

                    <div className="flex space-x-2">
                      {oficina.es_espacio_jiro && (
                        <button
                          onClick={() => {
                            setSelectedOficinaForAreas(oficina);
                            setAreasManagerOpen(true);
                          }}
                          className="flex items-center space-x-2 text-green-600 hover:bg-green-50 px-3 py-2 rounded-lg transition"
                        >
                          <Layers className="w-4 h-4" />
                          <span className="text-sm font-medium">Áreas</span>
                        </button>
                      )}
                      <button
                        onClick={() => openModal(oficina)}
                        className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm font-medium">Editar</span>
                      </button>
                      <button
                        onClick={() => handleDelete(oficina.id)}
                        className="flex items-center space-x-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Eliminar</span>
                      </button>
                    </div>
                  </div>

                  {expandedOficina === oficina.id && usuarios[oficina.id] && (
                    <div className="mt-4 pt-4 border-t border-slate-300">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Usuarios asignados:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {usuarios[oficina.id].map((usuario) => (
                          <div
                            key={usuario.id}
                            className="bg-white border border-slate-200 rounded-lg p-3"
                          >
                            <div className="flex items-center space-x-3">
                              {usuario.imagen_perfil_url ? (
                                <img
                                  src={usuario.imagen_perfil_url}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                  <span className="text-white font-medium text-xs">
                                    {usuario.nombre[0]}{usuario.apellidos[0]}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {usuario.nombre} {usuario.apellidos}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{usuario.puesto}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {oficinas.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay oficinas registradas</p>
              <button
                onClick={() => openModal()}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Crear primera oficina
              </button>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">
                {selectedOficina ? 'Editar Oficina' : 'Nueva Oficina'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de la Oficina *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Oficina Central"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Director
                  </label>
                  <input
                    type="text"
                    value={formData.director}
                    onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gerente
                  </label>
                  <input
                    type="text"
                    value={formData.gerente}
                    onChange={(e) => setFormData({ ...formData, gerente: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Domicilio
                  </label>
                  <input
                    type="text"
                    value={formData.domicilio}
                    onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Instagram URL
                  </label>
                  <input
                    type="url"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://instagram.com/..."
                  />
                </div>

                {camposPersonalizados.map((campo) => (
                  <div key={campo.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {campo.nombre_campo}
                    </label>
                    <input
                      type={campo.tipo}
                      value={valoresCampos[campo.id] || ''}
                      onChange={(e) =>
                        setValoresCampos({ ...valoresCampos, [campo.id]: e.target.value })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}

                <div className="md:col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="activa"
                    checked={formData.activa}
                    onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="activa" className="text-sm font-medium text-slate-700">
                    Oficina activa
                  </label>
                </div>

                <div className="md:col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="es_espacio_jiro"
                    checked={formData.es_espacio_jiro}
                    onChange={(e) => setFormData({ ...formData, es_espacio_jiro: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="es_espacio_jiro" className="text-sm font-medium text-slate-700">
                    Marcar como Espacio JIRO (oficina con áreas reservables)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : selectedOficina ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customFieldsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Campos Personalizados</h2>
              <button
                onClick={() => setCustomFieldsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">Agregar Nuevo Campo</h3>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Nombre del campo"
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                    <option value="email">Email</option>
                    <option value="tel">Teléfono</option>
                    <option value="url">URL</option>
                  </select>
                  <button
                    onClick={handleAddCustomField}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-slate-800 mb-3">Campos Existentes</h3>
                {camposPersonalizados.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No hay campos personalizados</p>
                ) : (
                  camposPersonalizados.map((campo) => (
                    <div
                      key={campo.id}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{campo.nombre_campo}</p>
                        <p className="text-sm text-slate-500">Tipo: {campo.tipo}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCustomField(campo.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {areasManagerOpen && selectedOficinaForAreas && (
        <AreasManager
          oficinaId={selectedOficinaForAreas.id}
          oficinaNombre={selectedOficinaForAreas.nombre}
          onClose={() => {
            setAreasManagerOpen(false);
            setSelectedOficinaForAreas(null);
          }}
        />
      )}
    </div>
  );
}
