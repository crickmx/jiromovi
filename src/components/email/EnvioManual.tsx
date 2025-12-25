import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, UserCheck, Eye, X, Edit, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Plantilla {
  id: string;
  nombre: string;
  tipo: string;
  asunto: string;
  cuerpo_html: string;
}

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  email_laboral: string;
  email_personal: string;
  puesto: string;
  rol: string;
  oficina_id: string | null;
  fecha_nacimiento: string | null;
  fecha_ingreso: string | null;
}

interface Oficina {
  id: string;
  nombre: string;
}

export function EnvioManual() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const gerenteOficinaId = usuario?.oficina_id;

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState<Usuario[]>([]);

  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [selectedUsuarios, setSelectedUsuarios] = useState<string[]>([]);
  const [modoRedaccion, setModoRedaccion] = useState(false);

  const [asuntoPersonalizado, setAsuntoPersonalizado] = useState('');
  const [cuerpoPersonalizado, setCuerpoPersonalizado] = useState('');

  const [filtroOficinas, setFiltroOficinas] = useState<string[]>([]);
  const [filtroRoles, setFiltroRoles] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roles = isGerente ? ['Empleado', 'Agente'] : ['Administrador', 'Gerente', 'Empleado', 'Agente'];

  useEffect(() => {
    loadData();
    if (isGerente) {
      setModoRedaccion(true);
    }
  }, []);

  useEffect(() => {
    filterUsuarios();
  }, [usuarios, filtroOficinas, filtroRoles, busqueda]);

  const loadData = async () => {
    setLoading(true);

    let usuariosQuery = supabase
      .from('usuarios')
      .select('id, nombre, apellidos, email_laboral, email_personal, puesto, rol, oficina_id, fecha_nacimiento, fecha_ingreso')
      .order('nombre');

    if (isGerente && gerenteOficinaId) {
      usuariosQuery = usuariosQuery
        .eq('oficina_id', gerenteOficinaId)
        .in('rol', ['Empleado', 'Agente']);
    }

    let oficinasQuery = supabase.from('oficinas').select('id, nombre').order('nombre');

    if (isGerente && gerenteOficinaId) {
      oficinasQuery = oficinasQuery.eq('id', gerenteOficinaId);
    }

    const [plantillasRes, usuariosRes, oficinasRes] = await Promise.all([
      supabase.from('plantillas_correo').select('*').eq('activo', true).order('nombre'),
      usuariosQuery,
      oficinasQuery,
    ]);

    if (plantillasRes.data) setPlantillas(plantillasRes.data);
    if (usuariosRes.data) setUsuarios(usuariosRes.data);
    if (oficinasRes.data) setOficinas(oficinasRes.data);
    setLoading(false);
  };

  const filterUsuarios = () => {
    let filtered = [...usuarios];

    if (filtroOficinas.length > 0) {
      filtered = filtered.filter((u) => u.oficina_id && filtroOficinas.includes(u.oficina_id));
    }

    if (filtroRoles.length > 0) {
      filtered = filtered.filter((u) => filtroRoles.includes(u.rol));
    }

    if (busqueda.trim()) {
      const search = busqueda.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.nombre.toLowerCase().includes(search) ||
          u.apellidos.toLowerCase().includes(search) ||
          u.email_laboral?.toLowerCase().includes(search) ||
          u.email_personal?.toLowerCase().includes(search)
      );
    }

    setFilteredUsuarios(filtered);
  };

  const handleSelectAll = () => {
    if (selectedUsuarios.length === filteredUsuarios.length) {
      setSelectedUsuarios([]);
    } else {
      setSelectedUsuarios(filteredUsuarios.map((u) => u.id));
    }
  };

  const toggleUsuario = (id: string) => {
    setSelectedUsuarios((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const toggleOficina = (id: string) => {
    setFiltroOficinas((prev) =>
      prev.includes(id) ? prev.filter((oid) => oid !== id) : [...prev, id]
    );
  };

  const toggleRol = (rol: string) => {
    setFiltroRoles((prev) =>
      prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]
    );
  };

  const handleSend = async () => {
    if ((!selectedPlantilla && !modoRedaccion) || selectedUsuarios.length === 0) {
      setMessage({ type: 'error', text: 'Selecciona destinatarios y contenido del correo' });
      return;
    }

    if (modoRedaccion && (!asuntoPersonalizado || !cuerpoPersonalizado)) {
      setMessage({ type: 'error', text: 'Completa el asunto y el cuerpo del correo' });
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const destinatarios = usuarios
        .filter((u) => selectedUsuarios.includes(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email_laboral || u.email_personal,
          nombre: u.nombre,
          apellidos: u.apellidos,
          puesto: u.puesto || '',
        }));

      const requestBody: any = {
        destinatarios,
        tipoEnvio: 'manual',
      };

      if (modoRedaccion) {
        requestBody.plantillaId = null;
        requestBody.asuntoPersonalizado = asuntoPersonalizado;
        requestBody.cuerpoPersonalizado = cuerpoPersonalizado;
      } else {
        requestBody.plantillaId = selectedPlantilla;
        if (asuntoPersonalizado) {
          requestBody.asuntoPersonalizado = asuntoPersonalizado;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar correos');
      }

      setMessage({
        type: 'success',
        text: `Correos enviados: ${result.enviados} exitosos, ${result.fallidos} fallidos`,
      });

      setSelectedPlantilla('');
      setSelectedUsuarios([]);
      setAsuntoPersonalizado('');
      setCuerpoPersonalizado('');
      if (!isGerente) {
        setModoRedaccion(false);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSending(false);
    }
  };

  const getPlantilla = () => plantillas.find((p) => p.id === selectedPlantilla);

  const getPreviewHtml = () => {
    if (modoRedaccion) {
      return cuerpoPersonalizado;
    }

    const plantilla = getPlantilla();
    if (!plantilla) return '';

    const ejemploVariables: Record<string, string> = {
      nombre: 'Juan',
      apellidos: 'Pérez',
      puesto: 'Desarrollador',
      empresa: 'Nuestra Empresa',
    };

    let html = plantilla.cuerpo_html;
    for (const [key, value] of Object.entries(ejemploVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    }

    return html;
  };

  const getOficinaName = (id: string | null) => {
    if (!id) return 'Sin oficina';
    return oficinas.find((o) => o.id === id)?.nombre || 'Desconocida';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {isGerente && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-primary-50 text-primary-800 border border-primary-200">
          <p className="text-sm">
            <strong>Permisos de Gerente:</strong> Solo puedes redactar y enviar correos personalizados a usuarios con rol Empleado o Agente de tu oficina asignada.
          </p>
        </div>
      )}

      {!isGerente && (
        <div className="mb-6 flex space-x-3">
          <button
            onClick={() => setModoRedaccion(false)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
              !modoRedaccion
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Usar Plantilla</span>
          </button>
          <button
            onClick={() => setModoRedaccion(true)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition ${
              modoRedaccion
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Edit className="w-4 h-4" />
            <span>Redactar Correo</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {(modoRedaccion || isGerente) ? 'Redactar Correo' : '1. Seleccionar Plantilla'}
          </h3>

          {!modoRedaccion && !isGerente ? (
            <>
              <select
                value={selectedPlantilla}
                onChange={(e) => setSelectedPlantilla(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              >
                <option value="">-- Selecciona una plantilla --</option>
                {plantillas.map((plantilla) => (
                  <option key={plantilla.id} value={plantilla.id}>
                    {plantilla.nombre}
                  </option>
                ))}
              </select>

              {selectedPlantilla && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Asunto (opcional - deja vacío para usar el de la plantilla)
                    </label>
                    <input
                      type="text"
                      value={asuntoPersonalizado}
                      onChange={(e) => setAsuntoPersonalizado(e.target.value)}
                      placeholder={getPlantilla()?.asunto}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Eye className="w-5 h-5" />
                    <span>Vista previa de la plantilla</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Asunto *</label>
                <input
                  type="text"
                  value={asuntoPersonalizado}
                  onChange={(e) => setAsuntoPersonalizado(e.target.value)}
                  placeholder="Asunto del correo"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cuerpo del mensaje *</label>
                <textarea
                  value={cuerpoPersonalizado}
                  onChange={(e) => setCuerpoPersonalizado(e.target.value)}
                  rows={12}
                  placeholder="Escribe aquí el contenido del correo. Puedes usar HTML básico como <strong>, <em>, <p>, etc."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              {cuerpoPersonalizado && (
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Eye className="w-5 h-5" />
                  <span>Vista previa del correo</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {modoRedaccion ? 'Seleccionar Destinatarios' : '2. Seleccionar Destinatarios'}
            </h3>
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <UserCheck className="w-4 h-4" />
              <span>{selectedUsuarios.length === filteredUsuarios.length ? 'Deseleccionar' : 'Seleccionar'} todos</span>
            </button>
          </div>

          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Buscar por nombre o email
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {!isGerente && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por oficina</label>
                <div className="flex flex-wrap gap-2">
                  {oficinas.map((oficina) => (
                    <button
                      key={oficina.id}
                      onClick={() => toggleOficina(oficina.id)}
                      className={`px-3 py-1 text-sm rounded-full transition ${
                        filtroOficinas.includes(oficina.id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {oficina.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por rol</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((rol) => (
                  <button
                    key={rol}
                    onClick={() => toggleRol(rol)}
                    className={`px-3 py-1 text-sm rounded-full transition ${
                      filtroRoles.includes(rol)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {rol}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg max-h-96 overflow-y-auto">
            {filteredUsuarios.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                No hay usuarios que coincidan con los filtros
              </div>
            ) : (
              filteredUsuarios.map((usuario) => {
                const email = usuario.email_laboral || usuario.email_personal;
                return (
                  <label
                    key={usuario.id}
                    className="flex items-center space-x-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-200 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsuarios.includes(usuario.id)}
                      onChange={() => toggleUsuario(usuario.id)}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {usuario.nombre} {usuario.apellidos}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <span className="truncate">{email}</span>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{usuario.rol}</span>
                        {!isGerente && (
                          <>
                            <span>•</span>
                            <span>{getOficinaName(usuario.oficina_id)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <strong>{selectedUsuarios.length}</strong> destinatario(s) seleccionado(s) de{' '}
              <strong>{filteredUsuarios.length}</strong> filtrado(s)
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSend}
          disabled={
            selectedUsuarios.length === 0 ||
            (!modoRedaccion && !selectedPlantilla) ||
            (modoRedaccion && (!asuntoPersonalizado || !cuerpoPersonalizado)) ||
            sending
          }
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
          <span>{sending ? 'Enviando...' : 'Enviar Correos'}</span>
        </button>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Vista Previa</h2>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Asunto:</strong>{' '}
                  {modoRedaccion ? asuntoPersonalizado : asuntoPersonalizado || getPlantilla()?.asunto}
                </p>
              </div>

              <div
                className="border border-slate-200 rounded-lg p-6 bg-white"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
