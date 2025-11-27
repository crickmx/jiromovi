import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Mail, Phone, MapPin, Briefcase, Copy, Check, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};

interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  puesto: string;
  rol: string;
  oficina: string;
  email_laboral: string;
  celular_laboral: string;
  foto_url?: string;
}

export function DirectorioJiro() {
  const { usuario } = useAuth();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadosFiltrados, setEmpleadosFiltrados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const isAgente = usuario?.rol === 'Agente';
  const oficinaUsuario = usuario?.oficina_id;

  useEffect(() => {
    if (usuario) {
      cargarEmpleados();
    }
  }, [usuario, isAgente, oficinaUsuario]);

  useEffect(() => {
    filtrarEmpleados();
  }, [searchTerm, empleados]);

  const cargarEmpleados = async () => {
    try {
      setLoading(true);

      let query = supabase
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
          imagen_perfil_url,
          oficina_id,
          oficinas:oficina_id (nombre)
        `)
        .in('rol', ['Empleado', 'Gerente'])
        .ilike('estado', 'activo');

      const { data, error } = await query.order('nombre', { ascending: true });

      if (error) {
        console.error('Error en query:', error);
        throw error;
      }

      console.log('Datos obtenidos:', data);
      console.log('Total de empleados cargados:', data?.length || 0);

      const empleadosData: Empleado[] = (data || []).map((usuario: any) => {
        const nombreCompleto = usuario.nombre_completo ||
                               `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim();

        return {
          id: usuario.id,
          nombre: usuario.nombre || '',
          apellidos: usuario.apellidos || '',
          nombre_completo: nombreCompleto,
          puesto: usuario.puesto && usuario.puesto.trim() !== '' ? usuario.puesto : 'Sin puesto',
          rol: usuario.rol || '',
          oficina: usuario.oficinas?.nombre || 'Sin oficina',
          email_laboral: usuario.email_laboral || '',
          celular_laboral: usuario.celular_laboral || '',
          foto_url: usuario.imagen_perfil_url,
        };
      });

      console.log('Empleados procesados:', empleadosData);

      setEmpleados(empleadosData);
    } catch (error: any) {
      console.error('Error cargando empleados:', error);
      alert('Error al cargar empleados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filtrarEmpleados = () => {
    let filtrados = [...empleados];

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtrados = filtrados.filter(emp =>
        emp.nombre.toLowerCase().includes(term) ||
        emp.apellidos.toLowerCase().includes(term) ||
        emp.nombre_completo.toLowerCase().includes(term) ||
        emp.puesto.toLowerCase().includes(term) ||
        emp.oficina.toLowerCase().includes(term)
      );
    }

    setEmpleadosFiltrados(filtrados);
  };

  const copiarAlPortapapeles = async (texto: string, tipo: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      }
    } catch (error) {
      console.error('Error al copiar:', error);
    }
  };

  const abrirModal = (empleado: Empleado) => {
    setSelectedEmpleado(empleado);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setSelectedEmpleado(null);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando empleados...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-white">Directorio JIRO</h1>
          <p className="text-blue-100 mt-2">
            {isAgente
              ? 'Encuentra y contacta a los empleados de tu oficina'
              : 'Encuentra y contacta a los empleados de la organización'
            }
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, puesto u oficina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {empleadosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-12 text-center">
            <div className="text-neutral-400 mb-2">
              <Search className="w-16 h-16 mx-auto mb-4" />
            </div>
            <p className="text-neutral-600 text-lg">No se encontraron empleados</p>
            <p className="text-neutral-500 text-sm mt-2">
              {searchTerm ? 'Intenta ajustar tu búsqueda' : 'No hay empleados disponibles'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <p className="text-neutral-600">
                Mostrando <span className="font-semibold text-neutral-900">{empleadosFiltrados.length}</span> empleado{empleadosFiltrados.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {empleadosFiltrados.map((empleado) => (
                <div
                  key={empleado.id}
                  onClick={() => abrirModal(empleado)}
                  className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      {empleado.foto_url ? (
                        <img
                          src={empleado.foto_url}
                          alt={empleado.nombre_completo}
                          className="w-24 h-24 rounded-full object-cover border-4 border-blue-100 group-hover:border-blue-200 transition-colors"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-blue-100 group-hover:border-blue-200 transition-colors">
                          {empleado.nombre.charAt(0)}{empleado.apellidos.charAt(0)}
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 mb-1">
                      {empleado.nombre_completo}
                    </h3>

                    {empleado.rol === 'Gerente' && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold border border-blue-300">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                          Gerente
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-blue-600 text-sm font-medium mb-2">
                      <Briefcase className="w-4 h-4" />
                      <span>{empleado.puesto}</span>
                    </div>

                    <div className="flex items-center gap-1 text-neutral-600 text-sm mb-4">
                      <MapPin className="w-4 h-4" />
                      <span>{empleado.oficina}</span>
                    </div>

                    <div className="w-full space-y-2">
                      {empleado.email_laboral && (
                        <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 rounded-lg p-2">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate text-left">{empleado.email_laboral}</span>
                        </div>
                      )}

                      {empleado.celular_laboral && (
                        <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 rounded-lg p-2">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate text-left">{empleado.celular_laboral}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && selectedEmpleado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 text-center">
                <button
                  onClick={cerrarModal}
                  className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-4">
                  {selectedEmpleado.foto_url ? (
                    <img
                      src={selectedEmpleado.foto_url}
                      alt={selectedEmpleado.nombre_completo}
                      className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center text-blue-600 text-4xl font-bold shadow-lg">
                      {selectedEmpleado.nombre.charAt(0)}{selectedEmpleado.apellidos.charAt(0)}
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedEmpleado.nombre_completo}
                </h2>

                {selectedEmpleado.rol === 'Gerente' && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-blue-800 rounded-full text-sm font-semibold border border-blue-200">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      Gerente
                    </span>
                  </div>
                )}

                <p className="text-blue-100 text-lg">{selectedEmpleado.puesto}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-neutral-500 font-medium">Oficina</p>
                    <p className="text-neutral-900">{selectedEmpleado.oficina}</p>
                  </div>
                </div>

                {selectedEmpleado.email_laboral && (
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-neutral-500 font-medium">Email Laboral</p>
                        <p className="text-neutral-900 break-all">{selectedEmpleado.email_laboral}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copiarAlPortapapeles(selectedEmpleado.email_laboral, 'email')}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar
                          </>
                        )}
                      </button>
                      <a
                        href={`mailto:${selectedEmpleado.email_laboral}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
                      >
                        <Mail className="w-4 h-4" />
                        Enviar correo
                      </a>
                    </div>
                  </div>
                )}

                {selectedEmpleado.celular_laboral && (
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-neutral-500 font-medium">Celular Laboral</p>
                        <p className="text-neutral-900">{selectedEmpleado.celular_laboral}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copiarAlPortapapeles(selectedEmpleado.celular_laboral, 'phone')}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        {copiedPhone ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar
                          </>
                        )}
                      </button>
                      <a
                        href={`tel:${selectedEmpleado.celular_laboral}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Llamar
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-neutral-200">
                <button
                  onClick={cerrarModal}
                  className="w-full px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
