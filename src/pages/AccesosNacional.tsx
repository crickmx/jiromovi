import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, CreditCard as Edit2, Trash2, ExternalLink, Eye, Copy, Check, ChevronDown, ChevronRight, Key } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AccesoNacional {
  id: string;
  aseguradora: string;
  usuario_1: string;
  usuario_2: string | null;
  contrasena: string;
  link: string;
  clave_agente: string | null;
  creado_por: string;
  fecha_creacion: string;
  ultima_edicion_por: string | null;
  fecha_ultima_edicion: string | null;
  creador_nombre?: string;
  editor_nombre?: string;
}

interface AccesoFormData {
  aseguradora: string;
  usuario_1: string;
  usuario_2: string;
  contrasena: string;
  link: string;
  clave_agente: string;
}

export function AccesosNacional() {
  const { usuario } = useAuth();
  const [accesos, setAccesos] = useState<AccesoNacional[]>([]);
  const [filteredAccesos, setFilteredAccesos] = useState<AccesoNacional[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAcceso, setEditingAcceso] = useState<AccesoNacional | null>(null);
  const [formData, setFormData] = useState<AccesoFormData>({
    aseguradora: '',
    usuario_1: '',
    usuario_2: '',
    contrasena: '',
    link: '',
    clave_agente: '',
  });
  const [sortField, setSortField] = useState<'aseguradora' | 'fecha_creacion' | 'fecha_ultima_edicion'>('aseguradora');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAcceso, setSelectedAcceso] = useState<AccesoNacional | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedAseguradoras, setExpandedAseguradoras] = useState<Set<string>>(new Set());

  const canDelete = usuario?.rol === 'Administrador';

  const toggleAseguradora = (aseguradora: string) => {
    const newExpanded = new Set(expandedAseguradoras);
    if (newExpanded.has(aseguradora)) {
      newExpanded.delete(aseguradora);
    } else {
      newExpanded.add(aseguradora);
    }
    setExpandedAseguradoras(newExpanded);
  };

  const expandAll = () => {
    const grouped = groupedAccesos();
    setExpandedAseguradoras(new Set(Object.keys(grouped)));
  };

  const collapseAll = () => {
    setExpandedAseguradoras(new Set());
  };

  useEffect(() => {
    fetchAccesos();
  }, []);

  useEffect(() => {
    filterAccesos();
  }, [searchTerm, accesos, sortField, sortDirection]);

  const fetchAccesos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('accesos_nacional')
        .select(`
          *,
          creador:usuarios!accesos_nacional_creado_por_fkey(nombre, apellidos),
          editor:usuarios!accesos_nacional_ultima_edicion_por_fkey(nombre, apellidos)
        `)
        .order('aseguradora', { ascending: true });

      if (error) throw error;

      const accesosWithNames = data.map((acceso: any) => ({
        ...acceso,
        creador_nombre: acceso.creador ? `${acceso.creador.nombre} ${acceso.creador.apellidos}` : 'Desconocido',
        editor_nombre: acceso.editor ? `${acceso.editor.nombre} ${acceso.editor.apellidos}` : null,
      }));

      setAccesos(accesosWithNames);
    } catch (error: any) {
      console.error('Error fetching accesos:', error);
      showToast('Error al cargar los accesos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterAccesos = () => {
    let filtered = [...accesos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acceso) =>
          acceso.aseguradora.toLowerCase().includes(term) ||
          acceso.usuario_1.toLowerCase().includes(term) ||
          (acceso.usuario_2 && acceso.usuario_2.toLowerCase().includes(term)) ||
          (acceso.clave_agente && acceso.clave_agente.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'fecha_creacion' || sortField === 'fecha_ultima_edicion') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = aVal?.toLowerCase() || '';
        bVal = bVal?.toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredAccesos(filtered);
  };

  const groupedAccesos = () => {
    const grouped: { [key: string]: AccesoNacional[] } = {};
    filteredAccesos.forEach((acceso) => {
      if (!grouped[acceso.aseguradora]) {
        grouped[acceso.aseguradora] = [];
      }
      grouped[acceso.aseguradora].push(acceso);
    });
    return grouped;
  };

  const handleSort = (field: 'aseguradora' | 'fecha_creacion' | 'fecha_ultima_edicion') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const openDetailsModal = (acceso: AccesoNacional) => {
    setSelectedAcceso(acceso);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedAcceso(null);
  };

  const openModal = (acceso?: AccesoNacional) => {
    if (acceso) {
      setEditingAcceso(acceso);
      setFormData({
        aseguradora: acceso.aseguradora,
        usuario_1: acceso.usuario_1,
        usuario_2: acceso.usuario_2 || '',
        contrasena: acceso.contrasena,
        link: acceso.link,
        clave_agente: acceso.clave_agente || '',
      });
    } else {
      setEditingAcceso(null);
      setFormData({
        aseguradora: '',
        usuario_1: '',
        usuario_2: '',
        contrasena: '',
        link: '',
        clave_agente: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAcceso(null);
    setFormData({
      aseguradora: '',
      usuario_1: '',
      usuario_2: '',
      contrasena: '',
      link: '',
      clave_agente: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.link.match(/^https?:\/\//)) {
      showToast('El link debe comenzar con http:// o https://', 'error');
      return;
    }

    try {
      if (editingAcceso) {
        const { error } = await supabase
          .from('accesos_nacional')
          .update({
            ...formData,
            usuario_2: formData.usuario_2 || null,
            clave_agente: formData.clave_agente || null,
            ultima_edicion_por: usuario?.id,
            fecha_ultima_edicion: new Date().toISOString(),
          })
          .eq('id', editingAcceso.id);

        if (error) throw error;
        showToast('Cambios guardados', 'success');
      } else {
        const { error } = await supabase
          .from('accesos_nacional')
          .insert({
            ...formData,
            usuario_2: formData.usuario_2 || null,
            clave_agente: formData.clave_agente || null,
            creado_por: usuario?.id,
          });

        if (error) throw error;
        showToast('Registro agregado correctamente', 'success');
      }

      closeModal();
      fetchAccesos();
    } catch (error: any) {
      console.error('Error saving acceso:', error);
      showToast('Error al guardar el registro', 'error');
    }
  };

  const handleDelete = async (acceso: AccesoNacional) => {
    if (!canDelete) {
      showToast('Solo los administradores pueden eliminar registros', 'error');
      return;
    }

    if (!confirm('¿Seguro que desea eliminar este acceso? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('accesos_nacional')
        .delete()
        .eq('id', acceso.id);

      if (error) throw error;

      showToast('Registro eliminado', 'success');
      fetchAccesos();
    } catch (error: any) {
      console.error('Error deleting acceso:', error);
      showToast('Error al eliminar el registro', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <PageHeader
          title="Accesos Nacional"
          description="Credenciales compartidas de acceso nacional"
          icon={Key}
          actions={
            <button
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors min-h-[44px] w-full sm:w-auto text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Agregar Acceso
            </button>
          }
        />

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por Aseguradora, Usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent min-h-[44px]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-2 text-xs sm:text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Expandir Todo
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 text-xs sm:text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Contraer Todo
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:block space-y-2">
          {filteredAccesos.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center text-neutral-500">
              {searchTerm ? 'No se encontraron registros' : 'No hay accesos registrados'}
            </div>
          ) : (
            (() => {
              const grouped = groupedAccesos();
              return Object.keys(grouped).sort().map((aseguradora) => {
                const isExpanded = expandedAseguradoras.has(aseguradora);
                const count = grouped[aseguradora].length;

                return (
                  <div key={aseguradora} className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                    <button
                      onClick={() => toggleAseguradora(aseguradora)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-neutral-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-600" />
                        )}
                        <span className="text-base font-bold text-neutral-900">{aseguradora}</span>
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full font-medium">
                          {count} {count === 1 ? 'acceso' : 'accesos'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-neutral-200">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-neutral-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">
                                  Clave
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">
                                  Usuario
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">
                                  Contraseña
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 uppercase">
                                  Acciones
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {grouped[aseguradora].map((acceso) => (
                                <tr key={acceso.id} className="hover:bg-neutral-50 transition-colors">
                                  <td className="px-3 py-2.5">
                                    {acceso.clave_agente ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-mono text-neutral-900">{acceso.clave_agente}</span>
                                        <button
                                          onClick={() => handleCopyToClipboard(acceso.clave_agente!, `clave-${acceso.id}`)}
                                          className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                          title="Copiar clave"
                                        >
                                          {copiedId === `clave-${acceso.id}` ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-neutral-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-neutral-900">{acceso.usuario_1}</span>
                                        <button
                                          onClick={() => handleCopyToClipboard(acceso.usuario_1, `user1-${acceso.id}`)}
                                          className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                          title="Copiar usuario"
                                        >
                                          {copiedId === `user1-${acceso.id}` ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                      {acceso.usuario_2 && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs text-neutral-600">{acceso.usuario_2}</span>
                                          <button
                                            onClick={() => handleCopyToClipboard(acceso.usuario_2!, `user2-${acceso.id}`)}
                                            className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                            title="Copiar usuario 2"
                                          >
                                            {copiedId === `user2-${acceso.id}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-mono text-neutral-900">{acceso.contrasena}</span>
                                      <button
                                        onClick={() => handleCopyToClipboard(acceso.contrasena, `pass-${acceso.id}`)}
                                        className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                        title="Copiar contraseña"
                                      >
                                        {copiedId === `pass-${acceso.id}` ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <a
                                        href={acceso.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-accent text-white text-xs rounded hover:bg-accent-hover transition-colors font-medium"
                                        title="Ingresar al portal"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Ingresar
                                      </a>
                                      <button
                                        onClick={() => openDetailsModal(acceso)}
                                        className="p-1.5 text-neutral-600 hover:text-accent transition-colors rounded hover:bg-neutral-100"
                                        title="Ver detalles"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => openModal(acceso)}
                                        className="p-1.5 text-neutral-600 hover:text-accent transition-colors rounded hover:bg-neutral-100"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDelete(acceso)}
                                          className="p-1.5 text-neutral-600 hover:text-red-600 transition-colors rounded hover:bg-neutral-100"
                                          title="Eliminar"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>

        <div className="md:hidden space-y-2">
          {filteredAccesos.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center text-neutral-500">
              {searchTerm ? 'No se encontraron registros' : 'No hay accesos registrados'}
            </div>
          ) : (
            (() => {
              const grouped = groupedAccesos();
              return Object.keys(grouped).sort().map((aseguradora) => {
                const isExpanded = expandedAseguradoras.has(aseguradora);
                const count = grouped[aseguradora].length;

                return (
                  <div key={aseguradora} className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
                    <button
                      onClick={() => toggleAseguradora(aseguradora)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-neutral-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-600" />
                        )}
                        <span className="text-sm font-bold text-neutral-900">{aseguradora}</span>
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                          {count}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-neutral-200 p-3 space-y-3">
                        {grouped[aseguradora].map((acceso) => (
                          <div key={acceso.id} className="bg-neutral-50 rounded-lg p-3 space-y-2.5">
                            {acceso.clave_agente && (
                              <div>
                                <label className="text-xs font-semibold text-neutral-600 block mb-1">Clave</label>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono text-neutral-900">{acceso.clave_agente}</span>
                                  <button
                                    onClick={() => handleCopyToClipboard(acceso.clave_agente!, `mobile-clave-${acceso.id}`)}
                                    className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                  >
                                    {copiedId === `mobile-clave-${acceso.id}` ? (
                                      <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="text-xs font-semibold text-neutral-600 block mb-1">Usuario</label>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-neutral-900">{acceso.usuario_1}</span>
                                  <button
                                    onClick={() => handleCopyToClipboard(acceso.usuario_1, `mobile-user1-${acceso.id}`)}
                                    className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                  >
                                    {copiedId === `mobile-user1-${acceso.id}` ? (
                                      <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                                {acceso.usuario_2 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-neutral-600">{acceso.usuario_2}</span>
                                    <button
                                      onClick={() => handleCopyToClipboard(acceso.usuario_2!, `mobile-user2-${acceso.id}`)}
                                      className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                    >
                                      {copiedId === `mobile-user2-${acceso.id}` ? (
                                        <Check className="w-4 h-4 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-neutral-600 block mb-1">Contraseña</label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-neutral-900">{acceso.contrasena}</span>
                                <button
                                  onClick={() => handleCopyToClipboard(acceso.contrasena, `mobile-pass-${acceso.id}`)}
                                  className="p-1 text-neutral-400 hover:text-accent transition-colors rounded"
                                >
                                  {copiedId === `mobile-pass-${acceso.id}` ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <a
                                href={acceso.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover transition-colors font-semibold"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Ingresar
                              </a>
                              <button
                                onClick={() => openDetailsModal(acceso)}
                                className="p-2 text-neutral-600 hover:text-accent transition-colors rounded-lg hover:bg-neutral-100 border border-neutral-300"
                                title="Ver detalles"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => openModal(acceso)}
                                className="p-2 text-neutral-600 hover:text-accent transition-colors rounded-lg hover:bg-neutral-100 border border-neutral-300"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(acceso)}
                                  className="p-2 text-neutral-600 hover:text-red-600 transition-colors rounded-lg hover:bg-neutral-100 border border-neutral-300"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold text-neutral-800">
                {editingAcceso ? 'Editar Acceso' : 'Agregar Nuevo Acceso'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Aseguradora <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.aseguradora}
                  onChange={(e) => setFormData({ ...formData, aseguradora: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  placeholder="Nombre de la aseguradora"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Usuario 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.usuario_1}
                    onChange={(e) => setFormData({ ...formData, usuario_1: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Primer usuario"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Usuario 2</label>
                  <input
                    type="text"
                    value={formData.usuario_2}
                    onChange={(e) => setFormData({ ...formData, usuario_2: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Segundo usuario (opcional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contrasena}
                  onChange={(e) => setFormData({ ...formData, contrasena: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent font-mono"
                  placeholder="Contraseña"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                  placeholder="https://ejemplo.com"
                />
                <p className="text-xs text-neutral-500 mt-1">Debe comenzar con http:// o https://</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Clave de Agente
                </label>
                <input
                  type="text"
                  value={formData.clave_agente}
                  onChange={(e) => setFormData({ ...formData, clave_agente: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent font-mono"
                  placeholder="Ej. A12345"
                />
                <p className="text-xs text-neutral-500 mt-1">Clave alfanumérica de identificación del agente (opcional)</p>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors min-h-[44px] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors min-h-[44px] font-semibold"
                >
                  {editingAcceso ? 'Guardar Cambios' : 'Agregar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAcceso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-800">Detalles del Acceso</h2>
              <button
                onClick={closeDetailsModal}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-1">Aseguradora</h3>
                <p className="text-neutral-900">{selectedAcceso.aseguradora}</p>
              </div>

              {selectedAcceso.clave_agente && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-1">Clave de Agente</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-neutral-900 font-mono">{selectedAcceso.clave_agente}</p>
                    <button
                      onClick={() => handleCopyToClipboard(selectedAcceso.clave_agente!, selectedAcceso.id)}
                      className="p-1 text-neutral-400 hover:text-accent transition-colors rounded hover:bg-neutral-100"
                      title="Copiar clave"
                    >
                      {copiedId === selectedAcceso.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-4">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Información de Creación</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Creado por:</span>
                    <span className="text-sm font-medium text-neutral-900">{selectedAcceso.creador_nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Fecha de creación:</span>
                    <span className="text-sm font-medium text-neutral-900">{formatDate(selectedAcceso.fecha_creacion)}</span>
                  </div>
                </div>
              </div>

              {selectedAcceso.fecha_ultima_edicion && (
                <div className="border-t border-neutral-200 pt-4">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Última Edición</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Editado por:</span>
                      <span className="text-sm font-medium text-neutral-900">{selectedAcceso.editor_nombre || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Fecha de edición:</span>
                      <span className="text-sm font-medium text-neutral-900">{formatDate(selectedAcceso.fecha_ultima_edicion)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200">
              <button
                onClick={closeDetailsModal}
                className="w-full px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default AccesosNacional;
