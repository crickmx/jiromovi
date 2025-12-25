import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Menu, Video, X, LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Calculator, Palette, FileSignature, Contact, MessageSquare, Key, GraduationCap, Bell, Ticket, Briefcase, ShoppingBag, BookUser
} from 'lucide-react';
import {
  obtenerEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  obtenerEventoConPermisos,
  type AulaEvento
} from '../lib/aulaEventosUtils';
import { FormularioEvento, type EventoData } from '../components/eventos/FormularioEvento';
import { TarjetaEvento } from '../components/eventos/TarjetaEvento';
import { type PermisosSeleccionados } from '../components/eventos/SelectorPermisos';

export function SegurosEducationAulaDigital() {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Estados para eventos
  const [eventos, setEventos] = useState<AulaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<AulaEvento | null>(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<PermisosSeleccionados | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isAgente = usuario?.rol === 'Agente';
  const isAdminOrGerente = isAdmin || isGerente;
  const isAdminOrEmpleado = isAdmin || isEmpleado;
  const canAccessDirectorio = isAdmin || isEmpleado || isAgente;
  const isNotAgent = usuario?.rol !== 'Agente';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/mi-crm', label: 'Mi CRM', icon: Briefcase, show: true },
    { path: '/seguros-education', label: 'Seguros Education', icon: GraduationCap, show: true },
    { path: '/publicidad', label: 'Publicidad', icon: Palette, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador Digital', icon: Calculator, show: true },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/store', label: 'Store', icon: ShoppingBag, show: true },
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, show: isNotAgent },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, show: canAccessDirectorio },
    { path: '/chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { path: '/tickets', label: 'Tickets', icon: Ticket, show: true },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: true },
    { path: '/directorio', label: 'Usuarios', icon: Users, show: isAdminOrGerente },
    { path: '/centro-notificaciones', label: 'Centro de Notificaciones', icon: Bell, show: isAdmin },
    { path: '/notificaciones-transaccionales', label: 'Notificaciones Transaccionales', icon: Mail, show: isAdmin },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      const data = await obtenerEventos();
      setEventos(data);
    } catch (error) {
      console.error('Error cargando eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearEvento = async (eventoData: EventoData, permisos: PermisosSeleccionados) => {
    try {
      await crearEvento(eventoData, permisos);
      await cargarEventos();
      setShowEventoModal(false);
      alert('Evento creado exitosamente. Las notificaciones se han enviado a los usuarios autorizados.');
    } catch (error: any) {
      console.error('Error creando evento:', error);
      throw new Error(error.message || 'Error al crear el evento');
    }
  };

  const handleEditarEvento = async (eventoData: EventoData, permisos: PermisosSeleccionados) => {
    if (!eventoSeleccionado) return;

    try {
      await actualizarEvento(eventoSeleccionado.id, eventoData, permisos);
      await cargarEventos();
      setShowEventoModal(false);
      setEventoSeleccionado(null);
      setPermisosSeleccionados(undefined);
      alert('Evento actualizado exitosamente');
    } catch (error: any) {
      console.error('Error actualizando evento:', error);
      throw new Error(error.message || 'Error al actualizar el evento');
    }
  };

  const handleEliminarEvento = async (evento: AulaEvento) => {
    if (!confirm(`¿Estás seguro de eliminar el evento "${evento.titulo}"?`)) return;

    try {
      await eliminarEvento(evento.id);
      await cargarEventos();
      alert('Evento eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando evento:', error);
      alert('Error al eliminar el evento');
    }
  };

  const handleIngresarEvento = (evento: AulaEvento) => {
    window.open(evento.link_sesion, '_blank');
  };

  const handleAbrirEdicionEvento = async (evento: AulaEvento) => {
    try {
      const eventoConPermisos = await obtenerEventoConPermisos(evento.id);
      if (!eventoConPermisos) return;

      // Construir permisos actuales
      const permisosActuales: PermisosSeleccionados = {
        visible_para_todos: eventoConPermisos.visible_para_todos,
        roles: [],
        oficinas: [],
        usuarios: []
      };

      eventoConPermisos.permisos.forEach(p => {
        if (p.rol) permisosActuales.roles.push(p.rol);
        if (p.oficina_id) permisosActuales.oficinas.push(p.oficina_id);
        if (p.usuario_id) permisosActuales.usuarios.push(p.usuario_id);
      });

      setEventoSeleccionado(evento);
      setPermisosSeleccionados(permisosActuales);
      setShowEventoModal(true);
    } catch (error) {
      console.error('Error cargando permisos del evento:', error);
      alert('Error al cargar los permisos del evento');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-ios border-r border-ios-gray-200 shadow-ios-md transform transition-all duration-300 ease-ios ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-6 border-b border-ios-gray-200/50">
            <a href="/dashboard" className="flex items-center transition-transform hover:scale-105">
              <img
                src="/movirecurso_2.png"
                alt="MOVI Digital Logo"
                className="h-12 object-contain"
              />
            </a>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-ios-gray-600 hover:text-ios-gray-900 hover:bg-ios-gray-100 p-2.5 rounded-ios-lg transition-all duration-200"
              title="Cerrar menú"
            >
              <X className="w-5 h-5 stroke-[1.5]" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-ios-lg text-[15px] font-medium transition-all duration-200 flex items-center space-x-3 text-left group ${
                      isActive
                        ? 'bg-ios-blue text-white shadow-ios'
                        : 'text-ios-gray-900 hover:bg-ios-gray-100 active:bg-ios-gray-200'
                    }`}
                  >
                    <Icon className={`w-[22px] h-[22px] flex-shrink-0 transition-all duration-200 stroke-[1.5] ${isActive ? '' : 'group-hover:scale-105'}`} />
                    <span className="text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-ios-gray-200/50 bg-ios-gray-50/30">
            <button
              onClick={() => {
                navigate('/perfil');
                setSidebarOpen(false);
              }}
              className="flex items-center space-x-3 mb-2 w-full p-3 rounded-ios-lg hover:bg-white active:bg-ios-gray-100 transition-all duration-200 group"
            >
              <User className="w-5 h-5 text-ios-gray-700 group-hover:text-ios-blue transition-colors stroke-[1.5]" />
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-ios-gray-900">{usuario?.nombre}</p>
                <p className="text-[13px] text-ios-gray-600">{usuario?.rol}</p>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center space-x-2 w-full p-3 rounded-ios-lg bg-ios-red/10 text-ios-red hover:bg-ios-red hover:text-white transition-all duration-200 font-medium text-[15px] active:scale-95"
            >
              <LogOut className="w-4 h-4 stroke-[2]" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay cuando sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header con navegación */}
      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="/movirecurso_2.png"
            alt="MOVI Digital Logo"
            className="h-10 object-contain"
          />
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Botón de regreso */}
        <button
          onClick={() => navigate('/seguros-education')}
          className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Volver a Seguros Education</span>
        </button>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Aula Digital - Eventos</h1>
              <p className="text-primary-100">
                Capacitaciones y eventos en vivo
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setEventoSeleccionado(null);
                  setPermisosSeleccionados(undefined);
                  setShowEventoModal(true);
                }}
                className="flex items-center space-x-2 bg-white text-primary-700 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition"
              >
                <Video className="w-5 h-5" />
                <span>Nuevo Evento</span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido de Eventos */}
        <div className="space-y-6">
          {eventos.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-neutral-300 p-12 text-center">
              <Video className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                No hay eventos disponibles
              </h3>
              <p className="text-neutral-500">
                {isAdmin
                  ? 'Crea tu primer evento para comenzar'
                  : 'No tienes eventos programados en este momento'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {eventos.map(evento => (
                <TarjetaEvento
                  key={evento.id}
                  evento={evento}
                  isAdmin={isAdmin}
                  onIngresar={handleIngresarEvento}
                  onEditar={handleAbrirEdicionEvento}
                  onEliminar={handleEliminarEvento}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal de Evento */}
        {showEventoModal && (
          <FormularioEvento
            evento={eventoSeleccionado}
            permisosIniciales={permisosSeleccionados}
            onSubmit={eventoSeleccionado ? handleEditarEvento : handleCrearEvento}
            onClose={() => {
              setShowEventoModal(false);
              setEventoSeleccionado(null);
              setPermisosSeleccionados(undefined);
            }}
          />
        )}
      </div>
    </div>
  );
}
