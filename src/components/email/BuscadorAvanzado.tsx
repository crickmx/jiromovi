import { useState } from 'react';
import { X, Search, Calendar, User, FileText, Paperclip, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface BuscadorAvanzadoProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (resultados: any[]) => void;
}

export function BuscadorAvanzado({ isOpen, onClose, onSearch }: BuscadorAvanzadoProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);

  const [remitente, setRemitente] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [asunto, setAsunto] = useState('');
  const [palabrasClave, setPalabrasClave] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [carpeta, setCarpeta] = useState('todas');
  const [conAdjuntos, setConAdjuntos] = useState(false);

  const [busquedasGuardadas, setBusquedasGuardadas] = useState<any[]>([]);
  const [nombreBusqueda, setNombreBusqueda] = useState('');

  const handleBuscar = async () => {
    if (!usuario) return;

    setLoading(true);

    try {
      let query = supabase
        .from('email_mensajes_cache')
        .select('*')
        .eq('usuario_id', usuario.id);

      if (remitente) {
        query = query.or(`remitente.ilike.%${remitente}%,remitente_email.ilike.%${remitente}%`);
      }

      if (asunto) {
        query = query.ilike('asunto', `%${asunto}%`);
      }

      if (palabrasClave) {
        query = query.or(`cuerpo_texto.ilike.%${palabrasClave}%,cuerpo_html.ilike.%${palabrasClave}%`);
      }

      if (fechaDesde) {
        query = query.gte('fecha', new Date(fechaDesde).toISOString());
      }

      if (fechaHasta) {
        query = query.lte('fecha', new Date(fechaHasta).toISOString());
      }

      if (carpeta && carpeta !== 'todas') {
        query = query.eq('carpeta', carpeta);
      }

      if (conAdjuntos) {
        query = query.eq('tiene_adjuntos', true);
      }

      const { data, error } = await query.order('fecha', { ascending: false });

      if (error) throw error;

      onSearch(data || []);
    } catch (error) {
      console.error('Error en búsqueda:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarBusqueda = async () => {
    if (!nombreBusqueda || !usuario) return;

    const filtros = {
      remitente,
      destinatario,
      asunto,
      palabrasClave,
      fechaDesde,
      fechaHasta,
      carpeta,
      conAdjuntos
    };

    await supabase
      .from('email_busquedas_guardadas')
      .insert({
        usuario_id: usuario.id,
        nombre: nombreBusqueda,
        filtros
      });

    setNombreBusqueda('');
    alert('Búsqueda guardada correctamente');
  };

  const limpiarFiltros = () => {
    setRemitente('');
    setDestinatario('');
    setAsunto('');
    setPalabrasClave('');
    setFechaDesde('');
    setFechaHasta('');
    setCarpeta('todas');
    setConAdjuntos(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-strong max-w-2xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Buscador avanzado
            </h2>
            <p className="text-sm text-neutral-600">
              Encuentra correos específicos con filtros avanzados
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Remitente</span>
              </label>
              <input
                type="text"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Nombre o correo del remitente"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Asunto</span>
              </label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Palabras en el asunto"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>Palabras clave en el mensaje</span>
              </label>
              <input
                type="text"
                value={palabrasClave}
                onChange={(e) => setPalabrasClave(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Buscar en el contenido"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Desde</span>
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Hasta</span>
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Carpeta
              </label>
              <select
                value={carpeta}
                onChange={(e) => setCarpeta(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="todas">Todas las carpetas</option>
                <option value="INBOX">Bandeja de entrada</option>
                <option value="SENT">Enviados</option>
                <option value="DRAFTS">Borradores</option>
                <option value="TRASH">Papelera</option>
                <option value="SPAM">Spam</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conAdjuntos}
                  onChange={(e) => setConAdjuntos(e.target.checked)}
                  className="w-4 h-4 text-accent border-neutral-300 rounded focus:ring-accent"
                />
                <span className="text-sm text-neutral-700 flex items-center space-x-1">
                  <Paperclip className="w-4 h-4" />
                  <span>Solo con adjuntos</span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200">
            <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Guardar esta búsqueda</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={nombreBusqueda}
                onChange={(e) => setNombreBusqueda(e.target.value)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Nombre de la búsqueda"
              />
              <button
                onClick={handleGuardarBusqueda}
                disabled={!nombreBusqueda}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-all disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-3xl">
          <button
            onClick={limpiarFiltros}
            className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
          >
            Limpiar filtros
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
            >
              Cancelar
            </button>

            <button
              onClick={handleBuscar}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all font-semibold disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
              <span>{loading ? 'Buscando...' : 'Buscar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
