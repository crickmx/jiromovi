import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, Mail, Phone, MapPin, Briefcase, X, Users,
  MessageSquare, PhoneCall, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  puesto: string;
  rol: string;
  oficina_id: string | null;
  oficina: string;
  oficina_telefono: string;
  oficina_extension: string;
  email_laboral: string;
  celular_laboral: string;
  celular_personal: string;
  extension_telefonica: string;
  foto_url?: string;
}

interface GrupoOficina {
  nombre: string;
  empleados: Empleado[];
}

const ROL_BADGE: Record<string, string> = {
  Administrador: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Ejecutivo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Empleado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Gerente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function getInitials(e: Empleado) {
  return `${e.nombre.charAt(0)}${e.apellidos.charAt(0)}`.toUpperCase();
}

export function DirectorioJiro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [collapsedOficinas, setCollapsedOficinas] = useState<Set<string>>(new Set());
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (usuario) cargarEmpleados();
  }, [usuario]);

  const cargarEmpleados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          id,
          nombre,
          apellidos,
          nombre_completo,
          puesto,
          rol,
          email_laboral,
          celular_laboral,
          celular_personal,
          extension_telefonica,
          imagen_perfil_url,
          oficina_id,
          oficinas:oficina_id (nombre, telefono, extension)
        `)
        .in('rol', ['Empleado', 'Ejecutivo', 'Administrador', 'Gerente'])
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;

      const lista: Empleado[] = (data || []).map((u: any) => ({
        id: u.id,
        nombre: u.nombre || '',
        apellidos: u.apellidos || '',
        nombre_completo: u.nombre_completo || `${u.nombre || ''} ${u.apellidos || ''}`.trim(),
        puesto: u.puesto?.trim() || 'Sin puesto',
        rol: u.rol || '',
        oficina_id: u.oficina_id,
        oficina: u.oficinas?.nombre || 'Sin oficina',
        oficina_telefono: u.oficinas?.telefono || '',
        oficina_extension: u.oficinas?.extension || '',
        email_laboral: u.email_laboral || '',
        celular_laboral: u.celular_laboral || '',
        celular_personal: u.celular_personal || '',
        extension_telefonica: u.extension_telefonica || '',
        foto_url: u.imagen_perfil_url,
      }));

      setEmpleados(lista);
    } catch (err: any) {
      console.error('Error cargando empleados:', err);
    } finally {
      setLoading(false);
    }
  };

  const iniciarChatMovi = async (empleadoId: string) => {
    if (!usuario || startingChat) return;
    setStartingChat(true);
    try {
      const { error } = await supabase.rpc('get_or_create_direct_chat', {
        p_user1_id: usuario.id,
        p_user2_id: empleadoId,
      });
      if (error) throw error;
      setSelectedEmpleado(null);
      navigate('/centro-contacto/chat');
    } catch (err: any) {
      console.error('Error iniciando chat:', err);
      alert('No se pudo iniciar el chat: ' + err.message);
    } finally {
      setStartingChat(false);
    }
  };

  const term = searchTerm.toLowerCase().trim();
  const filtrados = term
    ? empleados.filter(
        (e) =>
          e.nombre_completo.toLowerCase().includes(term) ||
          e.nombre.toLowerCase().includes(term) ||
          e.apellidos.toLowerCase().includes(term) ||
          e.puesto.toLowerCase().includes(term) ||
          e.oficina.toLowerCase().includes(term)
      )
    : empleados;

  const grupos: GrupoOficina[] = [];
  const mapaOficinas = new Map<string, Empleado[]>();
  for (const e of filtrados) {
    if (!mapaOficinas.has(e.oficina)) mapaOficinas.set(e.oficina, []);
    mapaOficinas.get(e.oficina)!.push(e);
  }
  mapaOficinas.forEach((emps, nombre) => grupos.push({ nombre, empleados: emps }));
  grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const toggleOficina = (nombre: string) => {
    setCollapsedOficinas((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const whatsappUrl = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/${clean}`;
  };

  if (loading) return <LoadingState text="Cargando directorio..." />;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Directorio JIRO"
          description="Encuentra y contacta a todos los colaboradores de la organización"
          icon={Users}
        />

        <div className="bg-white dark:bg-white/3 rounded-xl shadow-sm border border-neutral-200 dark:border-white/10 p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, puesto u oficina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/40 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-neutral-500 dark:text-white/40">
            {filtrados.length} colaborador{filtrados.length !== 1 ? 'es' : ''}
            {searchTerm && ` para "${searchTerm}"`}
          </p>
        </div>

        {filtrados.length === 0 ? (
          <div className="bg-white dark:bg-white/3 rounded-xl border border-neutral-200 dark:border-white/10 p-16 text-center">
            <Search className="w-14 h-14 mx-auto text-neutral-300 dark:text-white/20 mb-4" />
            <p className="text-neutral-600 dark:text-white/60 text-lg font-medium">Sin resultados</p>
            <p className="text-neutral-400 dark:text-white/40 text-sm mt-1">
              Intenta con otro nombre, puesto u oficina
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => (
              <div
                key={grupo.nombre}
                className="bg-white dark:bg-white/3 rounded-xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => toggleOficina(grupo.nombre)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-accent" />
                    </div>
                    <div className="text-left">
                      <h2 className="font-semibold text-neutral-900 dark:text-white text-base">
                        {grupo.nombre}
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-white/40">
                        {grupo.empleados.length} colaborador
                        {grupo.empleados.length !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                  {collapsedOficinas.has(grupo.nombre) ? (
                    <ChevronDown className="w-5 h-5 text-neutral-400 dark:text-white/40" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-neutral-400 dark:text-white/40" />
                  )}
                </button>

                {!collapsedOficinas.has(grupo.nombre) && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {grupo.empleados.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmpleado(emp)}
                        className="w-full text-left bg-neutral-50 dark:bg-white/5 rounded-xl p-4 hover:bg-neutral-100 dark:hover:bg-white/8 hover:shadow-md transition-all duration-150 group border border-transparent hover:border-neutral-200 dark:hover:border-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {emp.foto_url ? (
                              <img
                                src={emp.foto_url}
                                alt={emp.nombre_completo}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-neutral-800 group-hover:ring-accent/30 transition-all"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/70 to-accent flex items-center justify-center text-white text-sm font-bold ring-2 ring-white dark:ring-neutral-800 group-hover:ring-accent/30 transition-all">
                                {getInitials(emp)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white text-sm truncate leading-tight">
                              {emp.nombre_completo}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Briefcase className="w-3 h-3 text-neutral-400 dark:text-white/40 flex-shrink-0" />
                              <p className="text-xs text-neutral-500 dark:text-white/50 truncate">
                                {emp.puesto}
                              </p>
                            </div>
                            {emp.celular_laboral && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-neutral-400 dark:text-white/40 flex-shrink-0" />
                                <p className="text-xs text-neutral-400 dark:text-white/40 truncate">
                                  {emp.celular_laboral}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEmpleado && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEmpleado(null);
          }}
        >
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="relative bg-accent rounded-t-2xl p-6 text-center">
              <button
                onClick={() => setSelectedEmpleado(null)}
                className="absolute top-3 right-3 p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex justify-center mb-3">
                {selectedEmpleado.foto_url ? (
                  <img
                    src={selectedEmpleado.foto_url}
                    alt={selectedEmpleado.nombre_completo}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/30 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {getInitials(selectedEmpleado)}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-white leading-tight">
                {selectedEmpleado.nombre_completo}
              </h2>
              <p className="text-white/80 text-sm mt-1">{selectedEmpleado.puesto}</p>

              <div className="flex items-center justify-center gap-1.5 mt-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ROL_BADGE[selectedEmpleado.rol] || 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {selectedEmpleado.rol}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-white/5 rounded-xl">
                <MapPin className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-500 dark:text-white/40 font-medium mb-0.5">
                    Oficina
                  </p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">
                    {selectedEmpleado.oficina}
                  </p>
                  {(selectedEmpleado.oficina_telefono ||
                    selectedEmpleado.oficina_extension ||
                    selectedEmpleado.extension_telefonica) && (
                    <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
                      {selectedEmpleado.oficina_telefono}
                      {selectedEmpleado.oficina_telefono &&
                        (selectedEmpleado.oficina_extension ||
                          selectedEmpleado.extension_telefonica) &&
                        ' · '}
                      {(selectedEmpleado.oficina_extension ||
                        selectedEmpleado.extension_telefonica) &&
                        `ext. ${selectedEmpleado.oficina_extension || selectedEmpleado.extension_telefonica}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectedEmpleado.email_laboral && (
                  <a
                    href={`mailto:${selectedEmpleado.email_laboral}`}
                    className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-xs font-medium"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Enviar email</span>
                  </a>
                )}

                {(selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal) && (
                  <a
                    href={`tel:${selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal}`}
                    className="flex flex-col items-center gap-1.5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-xs font-medium"
                  >
                    <PhoneCall className="w-5 h-5" />
                    <span>Llamar</span>
                  </a>
                )}

                {(selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal) && (
                  <a
                    href={whatsappUrl(
                      selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-xs font-medium"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                )}

                {selectedEmpleado.id !== usuario?.id && (
                  <button
                    onClick={() => iniciarChatMovi(selectedEmpleado.id)}
                    disabled={startingChat}
                    className="flex flex-col items-center gap-1.5 p-3 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-xs font-medium disabled:opacity-60"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>{startingChat ? 'Abriendo...' : 'Chat Movi'}</span>
                  </button>
                )}
              </div>

              {(selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal) && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 dark:bg-white/5 rounded-xl">
                  <Phone className="w-4 h-4 text-neutral-400 dark:text-white/40 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-white/40 font-medium">
                      Teléfono
                    </p>
                    <p className="text-sm text-neutral-900 dark:text-white">
                      {selectedEmpleado.celular_laboral || selectedEmpleado.celular_personal}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={() => setSelectedEmpleado(null)}
                className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors text-sm font-medium"
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

export default DirectorioJiro;
