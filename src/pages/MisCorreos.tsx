import { useState, useEffect } from 'react';
import { Mail, Eye, X, Clock, Filter, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Email {
  id: string;
  asunto: string;
  cuerpo_html: string;
  fecha_envio: string;
  estado: string;
  tipo_envio: string;
}

export function MisCorreos() {
  const { usuario } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');

  useEffect(() => {
    loadEmails();
  }, [usuario]);

  useEffect(() => {
    filterEmails();
  }, [emails, searchTerm, tipoFilter]);

  const loadEmails = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('historial_correos')
      .select('id, asunto, cuerpo_html, fecha_envio, estado, tipo_envio')
      .eq('destinatario_id', usuario.id)
      .eq('estado', 'enviado')
      .order('fecha_envio', { ascending: false });

    if (!error && data) {
      setEmails(data);
    }
    setLoading(false);
  };

  const filterEmails = () => {
    let filtered = [...emails];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (email) =>
          email.asunto.toLowerCase().includes(search) ||
          email.cuerpo_html.toLowerCase().includes(search)
      );
    }

    if (tipoFilter) {
      filtered = filtered.filter((email) => email.tipo_envio === tipoFilter);
    }

    setFilteredEmails(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-3">
            <Mail className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Mis Correos</h1>
              <p className="text-blue-100 mt-1">
                Todos los mensajes recibidos ({emails.length})
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por asunto o contenido..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <select
                  value={tipoFilter}
                  onChange={(e) => setTipoFilter(e.target.value)}
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los tipos</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                </select>
              </div>
            </div>

            {(searchTerm || tipoFilter) && (
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <span>
                  Mostrando {filteredEmails.length} de {emails.length} correos
                </span>
                {(searchTerm || tipoFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setTipoFilter('');
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">
                {emails.length === 0
                  ? 'No hay mensajes recibidos'
                  : 'No se encontraron mensajes con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-start space-x-4 p-4 rounded-lg hover:bg-slate-50 transition cursor-pointer border border-slate-200"
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-base font-semibold text-slate-900">
                        {email.asunto}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(email);
                        }}
                        className="flex-shrink-0 text-blue-600 hover:text-blue-700 ml-2"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(email.fecha_envio)}</span>
                      </div>
                      <span>•</span>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                        {email.tipo_envio === 'manual' ? 'Manual' : 'Automático'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Detalle del Mensaje</h2>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Asunto</p>
                    <p className="text-lg font-semibold text-slate-900">{selectedEmail.asunto}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-slate-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(selectedEmail.fecha_envio)}</span>
                  </div>
                  <span>•</span>
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                    {selectedEmail.tipo_envio === 'manual' ? 'Envío Manual' : 'Envío Automático'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo_html }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
