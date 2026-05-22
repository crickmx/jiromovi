import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { Users, Plus, Search, CreditCard as Edit2, Trash2, Save, X, Mail, Phone, Building2, Calendar, Filter, Download, Upload } from 'lucide-react';

interface Contacto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  celular: string | null;
  empresa: string | null;
  comentarios: string | null;
  origen: 'automatico' | 'manual';
  ultima_interaccion: string | null;
  cantidad_emails: number;
}

type FiltroOrigen = 'todos' | 'automatico' | 'manual';

export function Contactos() {
  const { usuario } = useAuth();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [filteredContactos, setFilteredContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    celular: '',
    empresa: '',
    comentarios: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (usuario) {
      loadContactos();
    }
  }, [usuario]);

  useEffect(() => {
    filterContactos();
  }, [contactos, searchQuery, filtroOrigen]);

  const loadContactos = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contactos')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('ultima_interaccion', { ascending: false, nullsFirst: false })
        .order('nombre', { ascending: true });

      if (error) throw error;

      setContactos(data || []);
    } catch (error) {
      console.error('Error cargando contactos:', error);
      setMessage({ type: 'error', text: 'Error al cargar contactos' });
    } finally {
      setLoading(false);
    }
  };

  const filterContactos = () => {
    let filtered = [...contactos];

    if (filtroOrigen !== 'todos') {
      filtered = filtered.filter(c => c.origen === filtroOrigen);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.nombre?.toLowerCase().includes(query) ||
          c.apellido?.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.empresa?.toLowerCase().includes(query) ||
          c.celular?.includes(query)
      );
    }

    setFilteredContactos(filtered);
  };

  const handleNuevoContacto = () => {
    setEditingContacto(null);
    setFormData({
      nombre: '',
      apellido: '',
      email: '',
      celular: '',
      empresa: '',
      comentarios: '',
    });
    setShowModal(true);
  };

  const handleEditContacto = (contacto: Contacto) => {
    setEditingContacto(contacto);
    setFormData({
      nombre: contacto.nombre || '',
      apellido: contacto.apellido || '',
      email: contacto.email,
      celular: contacto.celular || '',
      empresa: contacto.empresa || '',
      comentarios: contacto.comentarios || '',
    });
    setShowModal(true);
  };

  const handleSaveContacto = async () => {
    if (!usuario) return;

    if (!formData.email.trim()) {
      setMessage({ type: 'error', text: 'El email es obligatorio' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (editingContacto) {
        const { error } = await supabase
          .from('contactos')
          .update({
            nombre: formData.nombre.trim() || null,
            apellido: formData.apellido.trim() || null,
            celular: formData.celular.trim() || null,
            empresa: formData.empresa.trim() || null,
            comentarios: formData.comentarios.trim() || null,
          })
          .eq('id', editingContacto.id);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Contacto actualizado exitosamente' });
      } else {
        const { error } = await supabase.from('contactos').insert({
          usuario_id: usuario.id,
          nombre: formData.nombre.trim() || null,
          apellido: formData.apellido.trim() || null,
          email: formData.email.trim().toLowerCase(),
          celular: formData.celular.trim() || null,
          empresa: formData.empresa.trim() || null,
          comentarios: formData.comentarios.trim() || null,
          origen: 'manual',
        });

        if (error) {
          if (error.code === '23505') {
            throw new Error('Ya existe un contacto con este email');
          }
          throw error;
        }

        setMessage({ type: 'success', text: 'Contacto agregado exitosamente' });
      }

      setShowModal(false);
      loadContactos();
    } catch (error: any) {
      console.error('Error guardando contacto:', error);
      setMessage({ type: 'error', text: error.message || 'Error al guardar contacto' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContacto = async (contacto: Contacto) => {
    if (!confirm(`¿Estás seguro de eliminar el contacto de ${contacto.nombre || contacto.email}?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('contactos').delete().eq('id', contacto.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Contacto eliminado exitosamente' });
      loadContactos();
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      setMessage({ type: 'error', text: 'Error al eliminar contacto' });
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return 'Nunca';
    const date = new Date(fecha);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
    if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
    return `Hace ${Math.floor(days / 365)} años`;
  };

  if (loading) {
    return <LoadingState text="Cargando contactos..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden">
        <PageHeader
          title="Contactos"
          description="Gestiona tus contactos de email"
          icon={Users}
        >
          <Button onClick={handleNuevoContacto}>
            <Plus className="w-5 h-5" />
            <span>Nuevo Contacto</span>
          </Button>
        </PageHeader>

        <div className="p-6 border-b border-neutral-200 dark:border-white/10">
          {message && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-white/30" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, empresa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-neutral-600 dark:text-white/60" />
              <select
                value={filtroOrigen}
                onChange={e => setFiltroOrigen(e.target.value as FiltroOrigen)}
                className="px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="todos">Todos los contactos</option>
                <option value="automatico">Automáticos</option>
                <option value="manual">Manuales</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-white/60">
              {filteredContactos.length} contacto{filteredContactos.length !== 1 ? 's' : ''}
              {filtroOrigen !== 'todos' && ` (${filtroOrigen === 'automatico' ? 'automáticos' : 'manuales'})`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredContactos.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
              <p className="text-neutral-600 dark:text-white/60 font-semibold">No hay contactos</p>
              <p className="text-sm text-neutral-500 dark:text-white/40 mt-1">
                {searchQuery
                  ? 'No se encontraron contactos con ese criterio'
                  : 'Agrega tu primer contacto o sincroniza tus correos'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-white/3 border-b border-neutral-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Última Interacción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Origen
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-transparent divide-y divide-neutral-200 dark:divide-white/10">
                {filteredContactos.map(contacto => (
                  <tr key={contacto.id} className="hover:bg-neutral-50 dark:hover:bg-white/3 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-accent font-semibold text-sm">
                            {(contacto.nombre?.[0] || contacto.email[0]).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="font-semibold text-neutral-900 dark:text-white">
                            {contacto.nombre || contacto.apellido
                              ? `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim()
                              : 'Sin nombre'}
                          </div>
                          {contacto.cantidad_emails > 0 && (
                            <div className="text-xs text-neutral-500 dark:text-white/40">
                              {contacto.cantidad_emails} email{contacto.cantidad_emails !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-neutral-600 dark:text-white/60">
                        <Mail className="w-4 h-4 mr-2 text-neutral-400 dark:text-white/30" />
                        {contacto.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-white/60">
                      {contacto.celular ? (
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-neutral-400 dark:text-white/30" />
                          {contacto.celular}
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-white/60">
                      {contacto.empresa ? (
                        <div className="flex items-center">
                          <Building2 className="w-4 h-4 mr-2 text-neutral-400 dark:text-white/30" />
                          {contacto.empresa}
                        </div>
                      ) : (
                        <span className="text-neutral-400 dark:text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-white/60">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-neutral-400 dark:text-white/30" />
                        {formatFecha(contacto.ultima_interaccion)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          contacto.origen === 'automatico'
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {contacto.origen === 'automatico' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditContacto(contacto)}
                          className="text-accent hover:text-primary-800 p-2 hover:bg-primary-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContacto(contacto)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-2xl w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 bg-neutral-50 dark:bg-white/3 px-6 py-4 flex items-center justify-between rounded-t-2xl border-b border-neutral-200 dark:border-white/10">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                {editingContacto ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-500 dark:text-white/40 hover:bg-neutral-100 dark:hover:bg-white/5 p-2 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="Juan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={formData.apellido}
                    onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingContacto}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:bg-neutral-50 dark:disabled:bg-white/3 disabled:text-neutral-500 dark:disabled:text-white/40"
                  placeholder="juan@ejemplo.com"
                />
                {editingContacto && (
                  <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                    El email no puede modificarse
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                    Celular
                  </label>
                  <input
                    type="tel"
                    value={formData.celular}
                    onChange={e => setFormData({ ...formData, celular: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="+52 555 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={e => setFormData({ ...formData, empresa: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    placeholder="Empresa S.A."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">
                  Comentarios
                </label>
                <textarea
                  value={formData.comentarios}
                  onChange={e => setFormData({ ...formData, comentarios: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Notas adicionales sobre este contacto..."
                />
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 bg-neutral-50 dark:bg-white/3 border-t border-neutral-200 dark:border-white/10 flex justify-end space-x-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveContacto}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Contacto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
