import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Plus, ExternalLink, Search, Filter,
  Building2, User, AlertCircle, CheckCircle, X, Copy,
  Download, Users, Tag, Edit, Trash2, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  obtenerSesionesProgramadas,
  crearSesionProgramada,
  actualizarSesionProgramada,
  eliminarSesionProgramada,
  registrarseEnSesion,
  cancelarRegistro,
  puedeIngresar,
  obtenerTiempoRestante,
  descargarICS,
  copiarAlPortapapeles,
  type SesionConRegistro,
  type SesionInsert
} from '../lib/educationSesionesUtils';
import { BaseModal } from '../components/BaseModal';

export function SegurosEducationAulaDigital() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sesiones, setSesiones] = useState<SesionConRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionConRegistro | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstatus, setFilterEstatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    cargarSesiones();
  }, []);

  const cargarSesiones = async () => {
    try {
      setLoading(true);
      const data = await obtenerSesionesProgramadas({
        estatus: filterEstatus || undefined
      });
      setSesiones(data);
    } catch (error) {
      console.error('Error cargando sesiones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const success = await copiarAlPortapapeles(text);
    if (success) {
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const handleRegistrar = async (sesionId: string) => {
    try {
      await registrarseEnSesion(sesionId);
      await cargarSesiones();
    } catch (error: any) {
      alert(error.message || 'Error al registrarse en la sesión');
    }
  };

  const handleCancelarRegistro = async (sesionId: string) => {
    if (!confirm('¿Deseas cancelar tu registro en esta sesión?')) return;
    try {
      await cancelarRegistro(sesionId);
      await cargarSesiones();
    } catch (error: any) {
      alert(error.message || 'Error al cancelar el registro');
    }
  };

  const handleIngresar = (sesion: SesionConRegistro) => {
    if (sesion.link_acceso) {
      window.open(sesion.link_acceso, '_blank', 'noopener,noreferrer');
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta sesión?')) return;
    try {
      await eliminarSesionProgramada(id);
      await cargarSesiones();
      setShowDetailDrawer(false);
    } catch (error) {
      alert('Error al eliminar la sesión');
    }
  };

  const sesionesFiltradas = sesiones.filter(sesion => {
    const matchSearch = !searchTerm ||
      sesion.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sesion.compania.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sesion.ponente.toLowerCase().includes(searchTerm.toLowerCase());

    return matchSearch;
  });

  const sesionesProximas = sesionesFiltradas.filter(s => s.estatus === 'programada');
  const sesionesEnVivo = sesionesFiltradas.filter(s => s.estatus === 'en_vivo');
  const sesionesFinalizadas = sesionesFiltradas.filter(s => s.estatus === 'finalizada');

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Aula Digital</h1>
            <p className="text-blue-100">
              Capacitaciones programadas y eventos en vivo
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Sesión</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, compañía o ponente..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estado
                </label>
                <select
                  value={filterEstatus}
                  onChange={(e) => setFilterEstatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="programada">Programadas</option>
                  <option value="en_vivo">En Vivo</option>
                  <option value="finalizada">Finalizadas</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                setFilterEstatus('');
                cargarSesiones();
              }}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {sesionesEnVivo.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
              En Vivo Ahora
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {sesionesEnVivo.map(sesion => (
                <SesionCard
                  key={sesion.id}
                  sesion={sesion}
                  isAdmin={isAdmin}
                  onIngresar={handleIngresar}
                  onDetalle={(s) => { setSesionSeleccionada(s); setShowDetailDrawer(true); }}
                  onRegistrar={handleRegistrar}
                  onCancelarRegistro={handleCancelarRegistro}
                />
              ))}
            </div>
          </div>
        )}

        {sesionesProximas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Próximas Capacitaciones
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {sesionesProximas.map(sesion => (
                <SesionCard
                  key={sesion.id}
                  sesion={sesion}
                  isAdmin={isAdmin}
                  onIngresar={handleIngresar}
                  onDetalle={(s) => { setSesionSeleccionada(s); setShowDetailDrawer(true); }}
                  onRegistrar={handleRegistrar}
                  onCancelarRegistro={handleCancelarRegistro}
                />
              ))}
            </div>
          </div>
        )}

        {sesionesFinalizadas.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Sesiones Finalizadas
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {sesionesFinalizadas.slice(0, 5).map(sesion => (
                <SesionCard
                  key={sesion.id}
                  sesion={sesion}
                  isAdmin={isAdmin}
                  onIngresar={handleIngresar}
                  onDetalle={(s) => { setSesionSeleccionada(s); setShowDetailDrawer(true); }}
                  onRegistrar={handleRegistrar}
                  onCancelarRegistro={handleCancelarRegistro}
                />
              ))}
            </div>
          </div>
        )}

        {sesionesFiltradas.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">No hay sesiones disponibles</p>
          </div>
        )}
      </div>

      {showCreateModal && isAdmin && (
        <CrearSesionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            cargarSesiones();
          }}
        />
      )}

      {showDetailDrawer && sesionSeleccionada && (
        <DetalleSesionDrawer
          sesion={sesionSeleccionada}
          isAdmin={isAdmin}
          onClose={() => setShowDetailDrawer(false)}
          onEliminar={handleEliminar}
          onEditar={() => {}}
          onRegistrar={handleRegistrar}
          onCancelarRegistro={handleCancelarRegistro}
          onIngresar={handleIngresar}
          copiedText={copiedText}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}

interface SesionCardProps {
  sesion: SesionConRegistro;
  isAdmin: boolean;
  onIngresar: (sesion: SesionConRegistro) => void;
  onDetalle: (sesion: SesionConRegistro) => void;
  onRegistrar: (sesionId: string) => void;
  onCancelarRegistro: (sesionId: string) => void;
}

function SesionCard({ sesion, isAdmin, onIngresar, onDetalle, onRegistrar, onCancelarRegistro }: SesionCardProps) {
  const puedeIngresarAhora = puedeIngresar(sesion);
  const tiempoRestante = obtenerTiempoRestante(sesion);
  const estaRegistrado = sesion.usuario_registrado;

  const getEstadoBadge = () => {
    switch (sesion.estatus) {
      case 'en_vivo':
        return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
          En Vivo
        </span>;
      case 'programada':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Programada</span>;
      case 'finalizada':
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">Finalizada</span>;
      default:
        return null;
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl hover:shadow-md transition overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {sesion.miniatura_url && (
          <div className="md:w-48 h-32 md:h-auto bg-slate-100">
            <img
              src={sesion.miniatura_url}
              alt={sesion.titulo}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                {getEstadoBadge()}
                {estaRegistrado && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    Registrado
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{sesion.titulo}</h3>
              <p className="text-sm text-slate-600 mb-2">{sesion.compania}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-3">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {format(new Date(sesion.fecha), "d 'de' MMMM, yyyy", { locale: es })}
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {sesion.hora.slice(0, 5)} ({sesion.duracion_minutos} min)
            </div>
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              {sesion.ponente}
            </div>
            {sesion.capacidad && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {sesion.total_registros || 0}/{sesion.capacidad}
              </div>
            )}
          </div>

          {tiempoRestante && sesion.estatus === 'programada' && (
            <div className="mb-3 text-sm text-blue-600 font-medium">
              Inicia en: {tiempoRestante}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {puedeIngresarAhora ? (
              <button
                onClick={() => onIngresar(sesion)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ingresar</span>
              </button>
            ) : sesion.estatus === 'programada' && !estaRegistrado ? (
              <button
                onClick={() => onRegistrar(sesion.id)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Registrarme</span>
              </button>
            ) : estaRegistrado && sesion.estatus === 'programada' ? (
              <button
                onClick={() => onCancelarRegistro(sesion.id)}
                className="flex items-center space-x-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition text-sm"
              >
                <X className="w-4 h-4" />
                <span>Cancelar Registro</span>
              </button>
            ) : null}

            <button
              onClick={() => onDetalle(sesion)}
              className="flex items-center space-x-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg transition"
            >
              <Eye className="w-4 h-4" />
              <span>Ver Detalles</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CrearSesionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CrearSesionModal({ onClose, onSuccess }: CrearSesionModalProps) {
  const { usuario } = useAuth();
  const [formData, setFormData] = useState<Partial<SesionInsert>>({
    titulo: '',
    compania: '',
    ponente: '',
    descripcion: '',
    fecha: '',
    hora: '',
    duracion_minutos: 60,
    link_acceso: '',
    clave_acceso: '',
    minutos_anticipacion: 15,
    estatus: 'programada',
    publicada: true,
    creado_por: usuario?.id
  });
  const [showClave, setShowClave] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.compania || !formData.ponente || !formData.descripcion ||
        !formData.fecha || !formData.hora || !formData.link_acceso) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      setSubmitting(true);
      await crearSesionProgramada(formData as SesionInsert);
      onSuccess();
    } catch (error) {
      console.error('Error creando sesión:', error);
      alert('Error al crear la sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal title="Nueva Sesión de Capacitación" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Título de la Sesión *
          </label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Compañía *
            </label>
            <input
              type="text"
              value={formData.compania}
              onChange={(e) => setFormData({ ...formData, compania: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ponente *
            </label>
            <input
              type="text"
              value={formData.ponente}
              onChange={(e) => setFormData({ ...formData, ponente: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Descripción *
          </label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Hora *
            </label>
            <input
              type="time"
              value={formData.hora}
              onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Duración (min)
            </label>
            <input
              type="number"
              value={formData.duracion_minutos}
              onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="15"
              step="15"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Enlace de Acceso (Zoom, Teams, etc.) *
          </label>
          <input
            type="url"
            value={formData.link_acceso}
            onChange={(e) => setFormData({ ...formData, link_acceso: e.target.value })}
            placeholder="https://zoom.us/j/..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Clave de Acceso (opcional)
          </label>
          <div className="relative">
            <input
              type={showClave ? 'text' : 'password'}
              value={formData.clave_acceso || ''}
              onChange={(e) => setFormData({ ...formData, clave_acceso: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowClave(!showClave)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showClave ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Capacidad (opcional)
            </label>
            <input
              type="number"
              value={formData.capacidad || ''}
              onChange={(e) => setFormData({ ...formData, capacidad: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="Sin límite"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Anticipación (minutos)
            </label>
            <input
              type="number"
              value={formData.minutos_anticipacion}
              onChange={(e) => setFormData({ ...formData, minutos_anticipacion: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="5"
              step="5"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tiempo antes del inicio para habilitar "Ingresar"
            </p>
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {submitting ? 'Creando...' : 'Crear Sesión'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}

interface DetalleSesionDrawerProps {
  sesion: SesionConRegistro;
  isAdmin: boolean;
  onClose: () => void;
  onEliminar: (id: string) => void;
  onEditar: () => void;
  onRegistrar: (sesionId: string) => void;
  onCancelarRegistro: (sesionId: string) => void;
  onIngresar: (sesion: SesionConRegistro) => void;
  copiedText: string | null;
  onCopy: (text: string, label: string) => void;
}

function DetalleSesionDrawer({
  sesion,
  isAdmin,
  onClose,
  onEliminar,
  onRegistrar,
  onCancelarRegistro,
  onIngresar,
  copiedText,
  onCopy
}: DetalleSesionDrawerProps) {
  const puedeIngresarAhora = puedeIngresar(sesion);
  const estaRegistrado = sesion.usuario_registrado;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-900">Detalles de la Sesión</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {sesion.miniatura_url && (
            <img
              src={sesion.miniatura_url}
              alt={sesion.titulo}
              className="w-full h-48 object-cover rounded-xl"
            />
          )}

          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{sesion.titulo}</h3>
            <div className="flex items-center space-x-2 mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                {sesion.compania}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center text-slate-700">
              <Calendar className="w-5 h-5 mr-3 text-slate-400" />
              <span>{format(new Date(sesion.fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</span>
            </div>
            <div className="flex items-center text-slate-700">
              <Clock className="w-5 h-5 mr-3 text-slate-400" />
              <span>{sesion.hora.slice(0, 5)} hrs - Duración: {sesion.duracion_minutos} minutos</span>
            </div>
            <div className="flex items-center text-slate-700">
              <User className="w-5 h-5 mr-3 text-slate-400" />
              <span>Ponente: {sesion.ponente}</span>
            </div>
            {sesion.capacidad && (
              <div className="flex items-center text-slate-700">
                <Users className="w-5 h-5 mr-3 text-slate-400" />
                <span>Registrados: {sesion.total_registros || 0} / {sesion.capacidad}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-semibold text-slate-900 mb-2">Descripción</h4>
            <p className="text-slate-700 whitespace-pre-wrap">{sesion.descripcion}</p>
          </div>

          {sesion.link_acceso && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-2">Enlace de Acceso</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={sesion.link_acceso}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => onCopy(sesion.link_acceso!, 'link')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                  title="Copiar enlace"
                >
                  {copiedText === 'link' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          )}

          {sesion.clave_acceso && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-slate-900 mb-2">Clave de Acceso</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={sesion.clave_acceso}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                />
                <button
                  onClick={() => onCopy(sesion.clave_acceso!, 'clave')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                  title="Copiar clave"
                >
                  {copiedText === 'clave' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-3 pt-4">
            {puedeIngresarAhora && (
              <button
                onClick={() => onIngresar(sesion)}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Ingresar a la Sesión</span>
              </button>
            )}

            {!puedeIngresarAhora && sesion.estatus === 'programada' && !estaRegistrado && (
              <button
                onClick={() => onRegistrar(sesion.id)}
                className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition font-semibold"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Registrarme en esta Sesión</span>
              </button>
            )}

            {estaRegistrado && sesion.estatus === 'programada' && (
              <button
                onClick={() => onCancelarRegistro(sesion.id)}
                className="flex items-center justify-center space-x-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-lg transition"
              >
                <X className="w-5 h-5" />
                <span>Cancelar mi Registro</span>
              </button>
            )}

            <button
              onClick={() => descargarICS(sesion)}
              className="flex items-center justify-center space-x-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-lg transition"
            >
              <Download className="w-5 h-5" />
              <span>Agregar a Calendario</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => onEliminar(sesion.id)}
                className="flex items-center justify-center space-x-2 border border-red-300 hover:bg-red-50 text-red-700 px-6 py-3 rounded-lg transition"
              >
                <Trash2 className="w-5 h-5" />
                <span>Eliminar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
