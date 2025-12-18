import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, Search, Filter, AlertCircle, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { NuevoTramiteModal } from '../components/tramites/NuevoTramiteModal';

interface TramiteEstatus {
  id: string;
  nombre: string;
  color: string;
  orden: number;
}

interface TramiteItem {
  id: string;
  folio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  agente: { nombre_completo: string } | null;
  estatus: TramiteEstatus | null;
  ticket_asignaciones: Array<{
    ejecutivo: { nombre_completo: string } | null;
  }>;
}

export function Tramites() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'activos' | 'cerrados'>('activos');
  const [tramites, setTramites] = useState<TramiteItem[]>([]);
  const [estatusList, setEstatusList] = useState<TramiteEstatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstatus, setSelectedEstatus] = useState<string>('todos');
  const [selectedPrioridad, setSelectedPrioridad] = useState<string>('todas');
  const [showNuevoModal, setShowNuevoModal] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canManageAll = isAdmin || isGerente;

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadEstatus(), loadTramites()]);
    setLoading(false);
  };

  const loadEstatus = async () => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) setEstatusList(data);
  };

  const loadTramites = async () => {
    if (!usuario) return;

    let query = supabase
      .from('tickets')
      .select(`
        *,
        agente:agente_id(nombre_completo),
        estatus:estatus_id(*),
        ticket_asignaciones(
          ejecutivo:ejecutivo_id(nombre_completo)
        )
      `)
      .order('fecha_creacion', { ascending: false });

    if (activeTab === 'cerrados') {
      query = query.not('cerrado_en', 'is', null);
    } else {
      query = query.is('cerrado_en', null);
    }

    const { data } = await query;
    if (data) setTramites(data as TramiteItem[]);
  };

  const filteredTramites = tramites.filter(tramite => {
    const matchSearch = tramite.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       tramite.instrucciones.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       tramite.poliza?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       tramite.agente?.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstatus = selectedEstatus === 'todos' || tramite.estatus?.id === selectedEstatus;
    const matchPrioridad = selectedPrioridad === 'todas' || tramite.prioridad === selectedPrioridad;

    return matchSearch && matchEstatus && matchPrioridad;
  });

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'bg-red-100 text-red-700 border-red-300';
      case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Baja': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  const getPrioridadIcon = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return <AlertCircle className="w-4 h-4" />;
      case 'Media': return <Clock className="w-4 h-4" />;
      case 'Baja': return <CheckCircle2 className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-primary-600 mb-2">
              Gestión de Trámites
            </h1>
            <p className="text-neutral-600">
              Gestiona solicitudes y soporte interno
            </p>
          </div>
          <button
            onClick={() => setShowNuevoModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Trámite</span>
          </button>
        </div>

        <div className="flex space-x-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('activos')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'activos'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ClipboardList className="w-5 h-5" />
              <span>Trámites Activos</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cerrados')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'cerrados'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Trámites Concluidos</span>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por folio, descripción, póliza o agente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
          </div>
          <select
            value={selectedEstatus}
            onChange={(e) => setSelectedEstatus(e.target.value)}
            className="px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
          >
            <option value="todos">Todos los estatus</option>
            {estatusList.map(estatus => (
              <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
            ))}
          </select>
          <select
            value={selectedPrioridad}
            onChange={(e) => setSelectedPrioridad(e.target.value)}
            className="px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
          >
            <option value="todas">Todas las prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTramites.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
          <ClipboardList className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">
            No hay trámites {activeTab === 'cerrados' ? 'concluidos' : 'activos'}
          </h3>
          <p className="text-neutral-500">
            {activeTab === 'activos' ? 'Crea tu primer trámite para comenzar' : 'No tienes trámites concluidos'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTramites.map(tramite => (
            <div
              key={tramite.id}
              onClick={() => navigate(`/tramites/${tramite.id}`)}
              className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5 hover:shadow-medium transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-lg font-bold text-primary-600">{tramite.folio}</span>
                    {tramite.estatus && (
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: tramite.estatus.color + '20',
                          color: tramite.estatus.color,
                          borderColor: tramite.estatus.color,
                          borderWidth: '1px'
                        }}
                      >
                        {tramite.estatus.nombre}
                      </span>
                    )}
                    <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold border ${getPrioridadColor(tramite.prioridad)}`}>
                      {getPrioridadIcon(tramite.prioridad)}
                      <span>{tramite.prioridad}</span>
                    </span>
                  </div>

                  <p className="text-neutral-900 font-medium mb-2 line-clamp-2">
                    {tramite.instrucciones}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                    {tramite.agente && (
                      <span className="flex items-center space-x-1">
                        <span className="font-medium">Agente:</span>
                        <span>{tramite.agente.nombre_completo}</span>
                      </span>
                    )}
                    {tramite.poliza && (
                      <span className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium">Póliza:</span>
                        <span>{tramite.poliza}</span>
                      </span>
                    )}
                    {tramite.ticket_asignaciones.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <span className="font-medium">Asignado a:</span>
                        <span>
                          {tramite.ticket_asignaciones.map(a => a.ejecutivo?.nombre_completo).join(', ')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-sm text-neutral-500 ml-4">
                  <div>
                    {new Date(tramite.fecha_creacion).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-xs mt-1">
                    {new Date(tramite.fecha_creacion).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NuevoTramiteModal
        isOpen={showNuevoModal}
        onClose={() => setShowNuevoModal(false)}
        onSuccess={() => {
          setShowNuevoModal(false);
          loadData();
        }}
        estatusList={estatusList}
      />
    </div>
  );
}
