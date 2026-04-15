import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, MessageCircle, AlertCircle, CreditCard as Edit, Bell, ChevronDown, ChevronUp, Users, Check, X, Search, Layers, ShieldCheck, Briefcase, BookOpen, FileText, ShoppingBag, Building2, UserCheck, RefreshCw, Info } from 'lucide-react';
import { EditarPlantillaModal } from './EditarPlantillaModal';

interface TipoNotificacion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  enviar_correo: boolean;
  enviar_whatsapp: boolean;
  enviar_notificacion: boolean;
  permite_destinatarios_custom: boolean;
  modulo: string;
  nombre_estandar?: string;
  es_obsoleto?: boolean;
  trigger_event?: string;
  destinatario_tipo?: string;
}

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  email_laboral: string;
  rol: string;
}

interface Destinatario {
  id: string;
  tipo_notificacion_id: string;
  usuario_id: string;
  usuario?: Usuario;
}

interface TiposNotificacionesProps {
  onUpdate: () => void;
}

const MODULO_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  AUTH:         { label: 'Autenticación',    icon: ShieldCheck,  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  COMISIONES:   { label: 'Comisiones',       icon: Briefcase,    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  COMUNICADOS:  { label: 'Comunicados',      icon: Mail,         color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200' },
  CRM:          { label: 'CRM',              icon: Users,        color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  EDUCATION:    { label: 'Educación',        icon: BookOpen,     color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  ESPACIO_JIRO: { label: 'Espacio Jiro',     icon: Building2,    color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  REGISTRO:     { label: 'Registro',         icon: UserCheck,    color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  RRHH:         { label: 'RRHH',             icon: Users,        color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
  SICAS:        { label: 'SICAS',            icon: RefreshCw,    color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200' },
  STORE:        { label: 'Store',            icon: ShoppingBag,  color: 'text-pink-700',    bg: 'bg-pink-50 border-pink-200' },
  TRAMITES:     { label: 'Trámites',         icon: FileText,     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  SISTEMA:      { label: 'Sistema (Motor)',  icon: Layers,       color: 'text-neutral-700', bg: 'bg-neutral-50 border-neutral-200' },
};

const MODULO_ORDER = [
  'AUTH', 'TRAMITES', 'COMISIONES', 'CRM', 'EDUCATION',
  'COMUNICADOS', 'ESPACIO_JIRO', 'RRHH', 'STORE', 'REGISTRO', 'SICAS', 'SISTEMA'
];

const CODIGOS_SISTEMA_OCULTOS = [
  'correo_transaccional', 'whatsapp_transaccional', 'email_directo',
  'whatsapp_directo', 'notificacion_interna', 'notificacion_individual',
  'notificacion_personalizada'
];

export function TiposNotificaciones({ onUpdate }: TiposNotificacionesProps) {
  const [tipos, setTipos] = useState<TipoNotificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingTipo, setEditingTipo] = useState<{ id: string; nombre: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [destinatarios, setDestinatarios] = useState<Record<string, Destinatario[]>>({});
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [managingDestinatarios, setManagingDestinatarios] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [moduloActivo, setModuloActivo] = useState<string | null>(null);
  const [mostrarSistema, setMostrarSistema] = useState(false);

  useEffect(() => {
    fetchTipos();
    fetchDestinatarios();
    fetchUsuariosDisponibles();
  }, []);

  const fetchTipos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_tipos_notificacion')
        .select('*')
        .eq('es_obsoleto', false)
        .order('modulo')
        .order('nombre');

      if (error) throw error;
      setTipos(data || []);
    } catch (error) {
      console.error('Error al cargar tipos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinatarios = async () => {
    try {
      const { data, error } = await supabase
        .from('correo_destinatarios_notificacion')
        .select('*, usuario:usuarios(id, nombre, apellidos, email_laboral, rol)');

      if (error) throw error;

      const agrupados: Record<string, Destinatario[]> = {};
      (data || []).forEach((d: Destinatario) => {
        if (!agrupados[d.tipo_notificacion_id]) agrupados[d.tipo_notificacion_id] = [];
        agrupados[d.tipo_notificacion_id].push(d);
      });
      setDestinatarios(agrupados);
    } catch (error) {
      console.error('Error al cargar destinatarios:', error);
    }
  };

  const fetchUsuariosDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, rol')
        .in('rol', ['Empleado', 'Gerente', 'Administrador'])
        .eq('estado', 'activo')
        .order('nombre');

      if (error) throw error;
      setUsuariosDisponibles(data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ activo: !activo })
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: `Notificación ${!activo ? 'activada' : 'desactivada'}` });
      await fetchTipos();
      onUpdate();
    } catch {
      setMessage({ type: 'error', text: 'Error al actualizar el estado' });
    }
  };

  const toggleCanal = async (id: string, campo: 'enviar_correo' | 'enviar_whatsapp' | 'enviar_notificacion', valorActual: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ [campo]: !valorActual })
        .eq('id', id);

      if (error) throw error;
      const canal = campo === 'enviar_correo' ? 'Correo' : campo === 'enviar_whatsapp' ? 'WhatsApp' : 'Notificación';
      setMessage({ type: 'success', text: `Canal ${canal} ${!valorActual ? 'activado' : 'desactivado'}` });
      await fetchTipos();
      onUpdate();
    } catch {
      setMessage({ type: 'error', text: 'Error al actualizar el canal' });
    }
  };

  const agregarDestinatario = async (tipoId: string, usuarioId: string) => {
    try {
      const { error } = await supabase
        .from('correo_destinatarios_notificacion')
        .insert({ tipo_notificacion_id: tipoId, usuario_id: usuarioId });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Destinatario agregado' });
      await fetchDestinatarios();
    } catch {
      setMessage({ type: 'error', text: 'Error al agregar destinatario' });
    }
  };

  const eliminarDestinatario = async (destinatarioId: string) => {
    try {
      const { error } = await supabase
        .from('correo_destinatarios_notificacion')
        .delete()
        .eq('id', destinatarioId);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Destinatario eliminado' });
      await fetchDestinatarios();
    } catch {
      setMessage({ type: 'error', text: 'Error al eliminar destinatario' });
    }
  };

  // Filtrado
  const tiposFiltrados = tipos.filter(t => {
    if (!mostrarSistema && CODIGOS_SISTEMA_OCULTOS.includes(t.codigo)) return false;
    if (moduloActivo && t.modulo !== moduloActivo) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        t.nombre.toLowerCase().includes(q) ||
        t.codigo.toLowerCase().includes(q) ||
        (t.modulo || '').toLowerCase().includes(q) ||
        (t.descripcion || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Agrupar por módulo
  const porModulo = MODULO_ORDER.reduce<Record<string, TipoNotificacion[]>>((acc, mod) => {
    const items = tiposFiltrados.filter(t => t.modulo === mod);
    if (items.length > 0) acc[mod] = items;
    return acc;
  }, {});

  // Módulos disponibles para filtro (excluye SISTEMA si está oculto)
  const modulosDisponibles = MODULO_ORDER.filter(m => {
    if (m === 'SISTEMA' && !mostrarSistema) return false;
    return tipos.some(t => t.modulo === m && (mostrarSistema || !CODIGOS_SISTEMA_OCULTOS.includes(t.codigo)));
  });

  const totalVisibles = tiposFiltrados.length;
  const totalActivos = tiposFiltrados.filter(t => t.activo).length;

  if (loading) {
    return <div className="text-center py-8 text-neutral-500">Cargando notificaciones...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Mensaje de estado */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header con buscador y filtros */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar notificación..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="font-semibold text-neutral-800">{totalActivos}</span> activas
            <span>de</span>
            <span className="font-semibold text-neutral-800">{totalVisibles}</span> total
          </div>
        </div>

        {/* Filtro por módulo */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setModuloActivo(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              moduloActivo === null
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Todos
          </button>
          {modulosDisponibles.map(mod => {
            const cfg = MODULO_CONFIG[mod];
            return (
              <button
                key={mod}
                onClick={() => setModuloActivo(moduloActivo === mod ? null : mod)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  moduloActivo === mod
                    ? cfg.bg + ' ' + cfg.color + ' border-current'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {cfg?.label || mod}
              </button>
            );
          })}
          <button
            onClick={() => setMostrarSistema(!mostrarSistema)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              mostrarSistema
                ? 'bg-neutral-100 text-neutral-700 border-neutral-400'
                : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {mostrarSistema ? 'Ocultar motor' : 'Ver motor interno'}
          </button>
        </div>
      </div>

      {/* Lista agrupada por módulo */}
      {Object.keys(porModulo).length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No se encontraron notificaciones</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porModulo).map(([modulo, items]) => {
            const cfg = MODULO_CONFIG[modulo] || { label: modulo, icon: Layers, color: 'text-neutral-700', bg: 'bg-neutral-50 border-neutral-200' };
            const ModuloIcon = cfg.icon;
            const activosModulo = items.filter(t => t.activo).length;

            return (
              <div key={modulo}>
                {/* Cabecera de módulo */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-2 ${cfg.bg}`}>
                  <ModuloIcon className={`w-4 h-4 ${cfg.color}`} />
                  <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className={`ml-auto text-xs font-medium ${cfg.color} opacity-70`}>
                    {activosModulo}/{items.length} activas
                  </span>
                </div>

                {/* Notificaciones del módulo */}
                <div className="space-y-1.5 pl-1">
                  {items.map(tipo => {
                    const isExpanded = expandedId === tipo.id;
                    const destTipo = destinatarios[tipo.id] || [];
                    const isManaging = managingDestinatarios === tipo.id;
                    const esDepartamental = tipo.permite_destinatarios_custom;

                    return (
                      <div
                        key={tipo.id}
                        className={`rounded-lg border transition-all ${
                          isExpanded
                            ? 'border-blue-300 bg-white shadow-sm'
                            : tipo.activo
                              ? 'border-neutral-200 bg-white hover:border-neutral-300'
                              : 'border-neutral-100 bg-neutral-50'
                        }`}
                      >
                        {/* Fila principal */}
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : tipo.id)}
                            className="flex-shrink-0 hover:bg-neutral-100 rounded p-0.5 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-neutral-500" />
                              : <ChevronDown className="w-4 h-4 text-neutral-400" />
                            }
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${tipo.activo ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                                {tipo.nombre}
                              </span>
                              {esDepartamental ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 text-xs rounded border border-violet-200">
                                  <Users className="w-2.5 h-2.5" />
                                  Departamental
                                  {destTipo.length > 0 && (
                                    <span className="font-bold">{destTipo.length}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100">
                                  <UserCheck className="w-2.5 h-2.5" />
                                  Automática
                                </span>
                              )}
                              {esDepartamental && destTipo.length === 0 && tipo.activo && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-xs rounded border border-amber-200">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Sin destinatarios
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Canales activos (iconos) */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tipo.enviar_notificacion && <Bell className="w-3.5 h-3.5 text-amber-500" />}
                            {tipo.enviar_whatsapp && <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />}
                            {tipo.enviar_correo && <Mail className="w-3.5 h-3.5 text-blue-500" />}
                          </div>

                          {/* Toggle activo/inactivo */}
                          <button
                            onClick={() => toggleActivo(tipo.id, tipo.activo)}
                            title={tipo.activo ? 'Desactivar' : 'Activar'}
                            className={`flex-shrink-0 w-8 h-4.5 rounded-full transition-colors flex items-center justify-center px-2 py-1 text-xs font-medium ${
                              tipo.activo
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Panel expandido */}
                        {isExpanded && (
                          <div className="border-t border-neutral-100 px-4 py-3 bg-neutral-50 rounded-b-lg space-y-4">
                            {/* Descripción */}
                            {tipo.descripcion && (
                              <div className="flex items-start gap-2 text-xs text-neutral-500">
                                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>{tipo.descripcion.replace(/[✅❌⚠️]/g, '').trim()}</span>
                              </div>
                            )}

                            {/* Canales */}
                            <div>
                              <p className="text-xs font-semibold text-neutral-600 mb-2">Canales de envío</p>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { campo: 'enviar_notificacion' as const, label: 'Campanita', icon: Bell, activeClass: 'bg-amber-100 text-amber-700 border-amber-300' },
                                    { campo: 'enviar_whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                                    { campo: 'enviar_correo' as const, label: 'Correo', icon: Mail, activeClass: 'bg-blue-100 text-blue-700 border-blue-300' },
                                  ] as const
                                ).map(({ campo, label, icon: Icon, activeClass }) => (
                                  <button
                                    key={campo}
                                    onClick={() => toggleCanal(tipo.id, campo, tipo[campo])}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                      tipo[campo]
                                        ? activeClass + ' border-2'
                                        : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'
                                    }`}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Destinatarios departamentales */}
                            {esDepartamental && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-neutral-600">Destinatarios</p>
                                  <button
                                    onClick={() => setManagingDestinatarios(isManaging ? null : tipo.id)}
                                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                                  >
                                    {isManaging ? 'Cerrar' : '+ Agregar'}
                                  </button>
                                </div>

                                {isManaging && (
                                  <div className="bg-white rounded-lg border border-violet-200 p-3 mb-2">
                                    <p className="text-xs text-neutral-500 mb-2">Selecciona quién recibe esta notificación:</p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                      {usuariosDisponibles
                                        .filter(u => !destTipo.find(d => d.usuario_id === u.id))
                                        .map(u => (
                                          <button
                                            key={u.id}
                                            onClick={() => agregarDestinatario(tipo.id, u.id)}
                                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-violet-50 rounded text-left transition-colors"
                                          >
                                            <div>
                                              <p className="text-xs font-medium text-neutral-800">{u.nombre} {u.apellidos}</p>
                                              <p className="text-xs text-neutral-400">{u.email_laboral} · {u.rol}</p>
                                            </div>
                                            <Check className="w-3.5 h-3.5 text-violet-500" />
                                          </button>
                                        ))}
                                      {usuariosDisponibles.filter(u => !destTipo.find(d => d.usuario_id === u.id)).length === 0 && (
                                        <p className="text-xs text-neutral-400 text-center py-2">Todos los usuarios ya están agregados</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {destTipo.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {destTipo.map(dest => (
                                      <span key={dest.id} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full">
                                        {dest.usuario?.nombre} {dest.usuario?.apellidos}
                                        <button
                                          onClick={() => eliminarDestinatario(dest.id)}
                                          className="hover:bg-violet-200 rounded-full p-0.5 transition-colors"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                    <p className="text-xs text-amber-700">Sin destinatarios — esta notificación no se enviará hasta que agregues al menos uno.</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Info para automáticas */}
                            {!esDepartamental && (
                              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg p-2">
                                <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                                Se envía automáticamente al usuario relacionado con la acción. No requiere configurar destinatarios.
                              </div>
                            )}

                            {/* Botón editar plantillas */}
                            <button
                              onClick={() => setEditingTipo({ id: tipo.id, nombre: tipo.nombre })}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              <Edit className="w-4 h-4" />
                              Editar Plantillas (Correo · WhatsApp · Campanita)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edición de plantillas */}
      {editingTipo && (
        <EditarPlantillaModal
          tipoId={editingTipo.id}
          tipoNombre={editingTipo.nombre}
          onClose={() => setEditingTipo(null)}
          onSave={() => { fetchTipos(); onUpdate(); }}
        />
      )}
    </div>
  );
}
