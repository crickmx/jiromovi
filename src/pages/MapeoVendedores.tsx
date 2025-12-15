import { useState, useEffect } from 'react';
import { Link2, Mail, User, Edit2, Trash2, X, Save, Plus, Search, CheckCircle } from 'lucide-react';
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

export default function MapeoVendedores() {
  const { user } = useAuth();
  const [mapeos, setMapeos] = useState<VendorMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevoMapeo, setNuevoMapeo] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  useEffect(() => {
    cargarDatos();
  }, [filtroEstatus]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [mapeosData, usuariosData] = await Promise.all([
        obtenerVendorMappings(filtroEstatus === 'all' ? undefined : filtroEstatus),
        obtenerUsuariosMOVI(),
      ]);
      setMapeos(mapeosData);
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapeosFiltrados = mapeos.filter(
    (m) =>
      m.source_value.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.usuarios?.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.usuarios?.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mapeo de Vendedores</h1>
              <p className="text-gray-600">
                Gestiona las relaciones entre vendedores externos y usuarios MOVI
              </p>
            </div>
          </div>
          <button
            onClick={() => setNuevoMapeo(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nuevo Mapeo</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Mapeos</p>
                <p className="text-2xl font-bold text-gray-900">{mapeos.length}</p>
              </div>
              <Link2 className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Por Email</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mapeos.filter((m) => m.source_type === 'email').length}
                </p>
              </div>
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Por Nombre</p>
                <p className="text-2xl font-bold text-gray-900">
                  {mapeos.filter((m) => m.source_type === 'name').length}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por vendedor o usuario MOVI..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los mapeos</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : mapeosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Link2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay mapeos</h3>
          <p className="text-gray-600 mb-4">
            {busqueda
              ? 'No se encontraron mapeos con esos criterios de búsqueda.'
              : 'Los mapeos se crean automáticamente al asignar vendedores no reconocidos.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Vendedor Externo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Usuario MOVI
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Última Actualización
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mapeosFiltrados.map((mapeo) => (
                <MapeoRow
                  key={mapeo.id}
                  mapeo={mapeo}
                  usuarios={usuarios}
                  onUpdate={cargarDatos}
                  userId={user?.id || ''}
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
            cargarDatos();
          }}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
}

interface MapeoRowProps {
  mapeo: VendorMapping;
  usuarios: any[];
  onUpdate: () => void;
  userId: string;
}

function MapeoRow({ mapeo, usuarios, onUpdate, userId }: MapeoRowProps) {
  const [editando, setEditando] = useState(false);
  const [usuarioId, setUsuarioId] = useState(mapeo.movi_user_id);
  const [notas, setNotas] = useState(mapeo.notes || '');
  const [saving, setSaving] = useState(false);

  const handleGuardar = async () => {
    try {
      setSaving(true);
      await actualizarVendorMapping(
        mapeo.id,
        {
          movi_user_id: usuarioId,
          notes: notas,
        },
        userId
      );
      setEditando(false);
      onUpdate();
    } catch (error) {
      console.error('Error al actualizar mapeo:', error);
      alert('Error al actualizar mapeo');
    } finally {
      setSaving(false);
    }
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
      onUpdate();
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
      onUpdate();
    } catch (error) {
      console.error('Error al eliminar mapeo:', error);
      alert('Error al eliminar mapeo');
    }
  };

  return (
    <tr className={mapeo.status === 'inactive' ? 'bg-gray-50 opacity-60' : ''}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div
          className={`flex items-center space-x-2 px-2 py-1 rounded-full w-fit ${
            mapeo.source_type === 'email'
              ? 'bg-blue-100 text-blue-800'
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
          <p className="font-medium text-gray-900">{mapeo.source_value}</p>
          {mapeo.notes && <p className="text-sm text-gray-500 mt-1">{mapeo.notes}</p>}
        </div>
      </td>
      <td className="px-6 py-4">
        {editando ? (
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo} ({u.email})
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs">
              {mapeo.usuarios?.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{mapeo.usuarios?.nombre_completo}</p>
              <p className="text-sm text-gray-500">{mapeo.usuarios?.email}</p>
            </div>
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={handleCambiarEstado}
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            mapeo.status === 'active'
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {mapeo.status === 'active' ? 'Activo' : 'Inactivo'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                disabled={saving}
                className="text-green-600 hover:text-green-900 disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
              </button>
              <button onClick={() => setEditando(false)} className="text-gray-600 hover:text-gray-900">
                <X className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditando(true)}
                className="text-blue-600 hover:text-blue-900"
              >
                <Edit2 className="h-5 w-5" />
              </button>
              <button onClick={handleEliminar} className="text-red-600 hover:text-red-900">
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Nuevo Mapeo de Vendedor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Mapeo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSourceType('email')}
                className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  sourceType === 'email'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                <Mail className="h-5 w-5" />
                <span className="font-medium">Email</span>
              </button>
              <button
                onClick={() => setSourceType('name')}
                className={`p-3 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                  sourceType === 'name'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                <User className="h-5 w-5" />
                <span className="font-medium">Nombre</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {sourceType === 'email' ? 'Email del Vendedor' : 'Nombre del Vendedor'}
            </label>
            <input
              type={sourceType === 'email' ? 'email' : 'text'}
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={
                sourceType === 'email' ? 'vendedor@ejemplo.com' : 'Juan Pérez'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario MOVI Correspondiente
            </label>
            <select
              value={moviUserId}
              onChange={(e) => setMoviUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Información adicional sobre este mapeo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
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
          </button>
        </div>
      </div>
    </div>
  );
}
