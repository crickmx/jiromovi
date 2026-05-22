import { useState, useEffect } from 'react';
import { Link2, Mail, User, CreditCard as Edit2, Trash2, X, Save, Plus, Search, CheckCircle, RefreshCw } from 'lucide-react';
import {
  obtenerVendorMappings,
  actualizarVendorMapping,
  eliminarVendorMapping,
  crearVendorMapping,
  obtenerUsuariosMOVI,
  getVendorTypeLabel,
} from '../lib/vendorMappingUtils';
import type { VendorMapping, VendorMappingSourceType } from '../lib/vendorMappingTypes';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';

export default function MapeoVendedores() {
  console.log('[MapeoVendedores] 🚀 Componente renderizando');
  const { usuario, loading: authLoading } = useAuth();
  console.log('[MapeoVendedores] Auth state:', { authLoading, usuarioId: usuario?.id, rol: usuario?.rol });

  const [mapeos, setMapeos] = useState<VendorMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevoMapeo, setNuevoMapeo] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState<Set<string>>(new Set());
  const [ultimaCarga, setUltimaCarga] = useState<Date | null>(null);

  useEffect(() => {
    console.log('[MapeoVendedores] useEffect triggered', { authLoading, hasUsuario: !!usuario, filtroEstatus });
    if (!authLoading && usuario) {
      console.log('[MapeoVendedores] Condiciones cumplidas, llamando cargarDatos()');
      cargarDatos();
    } else {
      console.log('[MapeoVendedores] Esperando condiciones:', { authLoading, hasUsuario: !!usuario });
    }
  }, [filtroEstatus, authLoading, usuario]);

  const cargarDatos = async () => {
    console.log('[MapeoVendedores] cargarDatos iniciado');
    console.log('[MapeoVendedores] Usuario actual:', usuario?.id, usuario?.rol);
    try {
      setLoading(true);
      console.log('[MapeoVendedores] Obteniendo vendor mappings...');
      const mapeosData = await obtenerVendorMappings(filtroEstatus === 'all' ? undefined : filtroEstatus);
      console.log('[MapeoVendedores] Vendor mappings obtenidos:', mapeosData?.length || 0);

      console.log('[MapeoVendedores] Obteniendo usuarios MOVI...');
      const usuariosData = await obtenerUsuariosMOVI();
      console.log('[MapeoVendedores] Usuarios cargados:', usuariosData?.length || 0);

      setMapeos(mapeosData);
      setUsuarios(usuariosData || []);
      setUltimaCarga(new Date());
      console.log('[MapeoVendedores] Datos cargados correctamente');
    } catch (error) {
      console.error('[MapeoVendedores] ❌ ERROR al cargar datos:', error);
      console.error('[MapeoVendedores] Error completo:', JSON.stringify(error, null, 2));
      console.error('[MapeoVendedores] Stack trace:', (error as Error).stack);
      alert('Error al cargar datos: ' + (error as Error).message);
    } finally {
      setLoading(false);
      console.log('[MapeoVendedores] cargarDatos finalizado');
    }
  };

  const mapeosFiltrados = mapeos.filter(
    (m) =>
      m.source_value.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.usuarios?.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.usuarios?.email_laboral?.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.usuarios?.email_personal?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleMarkUnsaved = (id: string) => {
    setCambiosSinGuardar(prev => new Set(prev).add(id));
  };

  const handleMarkSaved = (id: string) => {
    setCambiosSinGuardar(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  if (authLoading) {
    return (
      <LoadingState text="Cargando..." className="min-h-screen" />
    );
  }

  if (!usuario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-600 dark:text-white/60">No se pudo cargar la información del usuario</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Banner de cambios sin guardar */}
      {cambiosSinGuardar.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-orange-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 border-2 border-orange-500">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping"></div>
              </div>
              <div>
                <p className="font-bold">
                  {cambiosSinGuardar.size} {cambiosSinGuardar.size === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}
                </p>
                <p className="text-xs text-orange-100">
                  Haz clic en "Guardar" en cada fila para confirmar los cambios
                </p>
              </div>
            </div>
            <button
              onClick={() => setCambiosSinGuardar(new Set())}
              className="ml-4 px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 font-medium transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-8">
          <PageHeader
            title="Mapeo de Vendedores"
            description={`Gestiona las relaciones entre vendedores externos y usuarios MOVI${ultimaCarga ? ` · Última actualización: ${ultimaCarga.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}`}
            icon={Link2}
            actions={
              <>
                <Button
                  onClick={cargarDatos}
                  disabled={loading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Cargar</span>
                </Button>
                <Button
                  onClick={() => setNuevoMapeo(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nuevo Mapeo</span>
                </Button>
              </>
            }
            className="mb-4"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-white/60">Total Mapeos</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">{mapeos.length}</p>
                </div>
                <Link2 className="h-8 w-8 text-accent" />
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-white/60">Por Email</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {mapeos.filter((m) => m.source_type === 'email').length}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-accent" />
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-white/60">Por Nombre</p>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {mapeos.filter((m) => m.source_type === 'name').length}
                  </p>
                </div>
                <User className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 dark:text-white/40" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por vendedor o usuario MOVI..."
                className="w-full pl-10 pr-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value as any)}
              className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="all">Todos los mapeos</option>
              <option value="active">Solo activos</option>
              <option value="inactive">Solo inactivos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingState text="Cargando mapeos..." />
        ) : mapeosFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-12 text-center">
            <Link2 className="h-12 w-12 text-neutral-400 dark:text-white/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">No hay mapeos</h3>
            <p className="text-neutral-600 dark:text-white/60 mb-4">
              {busqueda
                ? 'No se encontraron mapeos con esos criterios de búsqueda.'
                : 'Los mapeos se crean automáticamente al asignar vendedores no reconocidos.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-white/10">
              <thead className="bg-neutral-50 dark:bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Vendedor Externo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Usuario MOVI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Última Actualización
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-700 dark:text-white/70 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-transparent divide-y divide-neutral-200 dark:divide-white/10">
                {mapeosFiltrados.map((mapeo) => (
                  <MapeoRow
                    key={mapeo.id}
                    mapeo={mapeo}
                    usuarios={usuarios}
                    onUpdate={cargarDatos}
                    userId={usuario?.id || ''}
                    onMarkUnsaved={handleMarkUnsaved}
                    onMarkSaved={handleMarkSaved}
                    hasUnsavedChanges={cambiosSinGuardar.has(mapeo.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nuevoMapeo && (
          <NuevoMapeoModal
            usuarios={usuarios}
            onClose={() => setNuevoMapeo(false)}
            onSuccess={() => {
              setNuevoMapeo(false);
              alert('Mapeo creado correctamente. Haz clic en "Cargar" para ver los cambios.');
            }}
            userId={usuario?.id || ''}
          />
        )}
      </div>
    </div>
  );
}

interface MapeoRowProps {
  mapeo: VendorMapping;
  usuarios: any[];
  onUpdate: () => void;
  userId: string;
  onMarkUnsaved: (id: string) => void;
  onMarkSaved: (id: string) => void;
  hasUnsavedChanges: boolean;
}

function MapeoRow({ mapeo, usuarios, onUpdate, userId, onMarkUnsaved, onMarkSaved, hasUnsavedChanges }: MapeoRowProps) {
  const [editando, setEditando] = useState(false);
  const [usuarioId, setUsuarioId] = useState(mapeo.movi_user_id);
  const [notas, setNotas] = useState(mapeo.notes || '');
  const [saving, setSaving] = useState(false);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  const tieneCambios = usuarioId !== mapeo.movi_user_id || notas !== (mapeo.notes || '');

  // Notificar cambios sin guardar
  useEffect(() => {
    if (tieneCambios && editando) {
      onMarkUnsaved(mapeo.id);
    } else if (!tieneCambios) {
      onMarkSaved(mapeo.id);
    }
  }, [tieneCambios, editando, mapeo.id, onMarkUnsaved, onMarkSaved]);

  const handleGuardar = async () => {
    if (!tieneCambios) return;

    try {
      setSaving(true);
      setGuardadoExitoso(false);
      await actualizarVendorMapping(
        mapeo.id,
        {
          movi_user_id: usuarioId,
          notes: notas,
        },
        userId
      );
      setGuardadoExitoso(true);
      onMarkSaved(mapeo.id);
      setTimeout(() => {
        setEditando(false);
        setGuardadoExitoso(false);
      }, 1500);
      // NO recargar automáticamente - el usuario debe hacer clic en "Cargar"
    } catch (error) {
      console.error('Error al actualizar mapeo:', error);
      alert('Error al actualizar mapeo: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = () => {
    setUsuarioId(mapeo.movi_user_id);
    setNotas(mapeo.notes || '');
    setEditando(false);
    setGuardadoExitoso(false);
    onMarkSaved(mapeo.id);
  };

  const handleCambiarEstado = async () => {
    try {
      await actualizarVendorMapping(
        mapeo.id,
        {
          status: mapeo.status === 'active' ? 'inactive' : 'active',
        },
        userId
      );
      alert('Estado cambiado correctamente. Haz clic en "Cargar" para ver los cambios.');
      // NO recargar automáticamente - el usuario debe hacer clic en "Cargar"
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('Error al cambiar estado');
    }
  };

  const handleEliminar = async () => {
    if (!confirm('¿Estás seguro de eliminar este mapeo? Esta acción no se puede deshacer.'))
      return;

    try {
      await eliminarVendorMapping(mapeo.id);
      alert('Mapeo eliminado correctamente. Haz clic en "Cargar" para ver los cambios.');
      // NO recargar automáticamente - el usuario debe hacer clic en "Cargar"
    } catch (error) {
      console.error('Error al eliminar mapeo:', error);
      alert('Error al eliminar mapeo');
    }
  };

  return (
    <tr className={`
      ${mapeo.status === 'inactive' ? 'bg-neutral-50 dark:bg-white/5 opacity-60' : ''}
      ${hasUnsavedChanges && editando ? 'ring-2 ring-orange-400 ring-inset bg-orange-50 dark:bg-orange-900/20' : ''}
      transition-all duration-200
    `}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div
          className={`flex items-center space-x-2 px-2 py-1 rounded-full w-fit ${
            mapeo.source_type === 'email'
              ? 'bg-primary-100 text-primary-800'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          {mapeo.source_type === 'email' ? (
            <Mail className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">{getVendorTypeLabel(mapeo.source_type)}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div>
          <p className="font-medium text-neutral-900 dark:text-white">{mapeo.source_value}</p>
          {mapeo.notes && <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">{mapeo.notes}</p>}
        </div>
      </td>
      <td className="px-6 py-4">
        {editando ? (
          <div className="space-y-2">
            <select
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent ${
                tieneCambios ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5'
              }`}
            >
              <option value="">--Sin asignar--</option>
              {usuarios.length === 0 ? (
                <option disabled>No hay usuarios disponibles</option>
              ) : (
                usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre_completo} ({u.email_laboral || u.email_personal})
                  </option>
                ))
              )}
            </select>
            {tieneCambios && !guardadoExitoso && (
              <div className="px-2 py-1 bg-orange-100 border border-orange-300 rounded text-xs text-orange-700 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="font-medium">Cambios sin guardar - Haz clic en "Guardar"</span>
              </div>
            )}
            {guardadoExitoso && (
              <p className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <CheckCircle className="h-3 w-3" />
                Guardado exitosamente
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-xs">
              {mapeo.usuarios?.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-white">{mapeo.usuarios?.nombre_completo}</p>
              <p className="text-sm text-neutral-500 dark:text-white/50">
                {mapeo.usuarios?.email_laboral || mapeo.usuarios?.email_personal || 'Sin email'}
              </p>
            </div>
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={handleCambiarEstado}
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            mapeo.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
              : 'bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15'
          }`}
        >
          {mapeo.status === 'active' ? 'Activo' : 'Inactivo'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-white/50">
        {new Date(mapeo.updated_at).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          {editando ? (
            <>
              <button
                onClick={handleGuardar}
                disabled={saving || !tieneCambios}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all transform ${
                  guardadoExitoso
                    ? 'bg-green-600 text-white scale-105'
                    : tieneCambios
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl scale-105 animate-pulse'
                    : 'bg-neutral-200 dark:bg-white/10 text-neutral-500 dark:text-white/40 cursor-not-allowed scale-100'
                } disabled:opacity-50`}
                title={!tieneCambios ? 'No hay cambios para guardar' : 'GUARDAR CAMBIOS'}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </>
                ) : guardadoExitoso ? (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span>Guardado</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>GUARDAR</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancelar}
                disabled={saving}
                className="p-2 rounded-lg text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                title="Cancelar"
              >
                <X className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditando(true)}
                className="p-2 rounded-lg text-accent hover:bg-primary-100 transition-colors"
                title="Editar mapeo"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button
                onClick={handleEliminar}
                className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                title="Eliminar mapeo"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

interface NuevoMapeoModalProps {
  usuarios: any[];
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

function NuevoMapeoModal({ usuarios, onClose, onSuccess, userId }: NuevoMapeoModalProps) {
  const [sourceType, setSourceType] = useState<VendorMappingSourceType>('email');
  const [sourceValue, setSourceValue] = useState('');
  const [moviUserId, setMoviUserId] = useState(usuarios[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCrear = async () => {
    if (!sourceValue.trim() || !moviUserId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      setSaving(true);
      await crearVendorMapping(
        {
          source_type: sourceType,
          source_value: sourceValue.trim(),
          movi_user_id: moviUserId,
          notes: notes.trim() || undefined,
        },
        userId
      );
      onSuccess();
    } catch (error: any) {
      console.error('Error al crear mapeo:', error);
      alert('Error al crear mapeo: ' + (error.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Nuevo Mapeo de Vendedor</h2>
          <button onClick={onClose} className="text-neutral-400 dark:text-white/40 hover:text-neutral-600 dark:hover:text-white/60">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-2">Tipo de Mapeo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSourceType('email')}
                className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  sourceType === 'email'
                    ? 'border-accent bg-primary-50 dark:bg-accent/10 text-primary-700 dark:text-accent'
                    : 'border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-white/70 hover:border-neutral-400 dark:hover:border-white/25'
                }`}
              >
                <Mail className="h-5 w-5" />
                <span className="font-medium">Email</span>
              </button>
              <button
                onClick={() => setSourceType('name')}
                className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  sourceType === 'name'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'border-neutral-300 dark:border-white/15 text-neutral-700 dark:text-white/70 hover:border-neutral-400 dark:hover:border-white/25'
                }`}
              >
                <User className="h-5 w-5" />
                <span className="font-medium">Nombre</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
              {sourceType === 'email' ? 'Email del Vendedor' : 'Nombre del Vendedor'}
            </label>
            <input
              type={sourceType === 'email' ? 'email' : 'text'}
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={
                sourceType === 'email' ? 'vendedor@ejemplo.com' : 'Juan Pérez'
              }
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
              Usuario MOVI Correspondiente
            </label>
            <select
              value={moviUserId}
              onChange={(e) => setMoviUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">--Sin asignar--</option>
              {usuarios.length === 0 ? (
                <option disabled>No hay usuarios disponibles</option>
              ) : (
                usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre_completo} ({u.email_laboral || u.email_personal})
                  </option>
                ))
              )}
            </select>
            {usuarios.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                No se pudieron cargar los usuarios. Verifica la consola del navegador (F12).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Información adicional sobre este mapeo..."
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 rounded-b-xl">
          <Button
            onClick={onClose}
            disabled={saving}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCrear}
            disabled={saving}
            className="flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Crear Mapeo</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
