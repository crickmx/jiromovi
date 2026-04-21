import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Users, AlertCircle, FileText, Calendar, Clock, Briefcase, Shield, Building2, TrendingUp } from 'lucide-react';
import { getEstatusColor } from '../../lib/registroActividadesTypes';

interface TramiteEstatus {
  id: string;
  nombre: string;
  color: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
}

interface TramiteData {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  agente: Usuario | null;
  responsable: Usuario | null;
  estatus: TramiteEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
  // Campos de Registro de Actividades
  activity_subtype?: { id: string; nombre: string } | null;
  agente_usuario?: Usuario | null;
  insurance_type?: { id: string; nombre: string } | null;
  attending_user?: Usuario | null;
  request_datetime?: string | null;
  completion_datetime?: string | null;
  cerrado?: boolean;
  resultado?: string | null;
  insurers?: string[];
  insurers_nombres?: string[];
}

interface Asignacion {
  ejecutivo: Usuario | null;
}

interface TramiteDetallesProps {
  tramite: TramiteData;
  estatusList: TramiteEstatus[];
  selectedEstatus: string;
  setSelectedEstatus: (value: string) => void;
  selectedPrioridad: 'Alta' | 'Media' | 'Baja';
  setSelectedPrioridad: (value: 'Alta' | 'Media' | 'Baja') => void;
  canEdit?: boolean;
}

export function TramiteDetalles({
  tramite,
  estatusList,
  selectedEstatus,
  setSelectedEstatus,
  selectedPrioridad,
  setSelectedPrioridad,
  canEdit = false
}: TramiteDetallesProps) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);

  useEffect(() => {
    loadAsignaciones();
  }, [tramite.id]);

  const loadAsignaciones = async () => {
    const { data } = await supabase
      .from('ticket_asignaciones')
      .select('ejecutivo:ejecutivo_id(id, nombre_completo)')
      .eq('ticket_id', tramite.id);

    if (data) setAsignaciones(data as Asignacion[]);
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'bg-red-100 text-red-700 border-red-300';
      case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Baja': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Agente
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {tramite.agente?.nombre_completo || 'Sin agente asignado'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Responsable
          </label>
          <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            {tramite.responsable?.nombre_completo || 'Sin responsable asignado'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Prioridad
          </label>
          {canEdit ? (
            <select
              value={selectedPrioridad}
              onChange={(e) => setSelectedPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all cursor-pointer"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          ) : (
            <div className={`px-4 py-3 rounded-xl border font-semibold ${getPrioridadColor(tramite.prioridad)}`}>
              {tramite.prioridad}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Estatus
          </label>
          {canEdit ? (
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all cursor-pointer"
            >
              {estatusList.map(estatus => (
                <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
              ))}
            </select>
          ) : (
            <div
              className="px-4 py-3 rounded-xl border font-semibold"
              style={{
                backgroundColor: tramite.estatus?.color + '20',
                color: tramite.estatus?.color,
                borderColor: tramite.estatus?.color
              }}
            >
              {tramite.estatus?.nombre}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Póliza
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {tramite.poliza || 'Sin póliza'}
          </div>
        </div>
      </div>

      {asignaciones.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <Users className="w-4 h-4 inline mr-2" />
            Ejecutivos Asignados
          </label>
          <div className="flex flex-wrap gap-2">
            {asignaciones.map((asignacion, index) => (
              <span
                key={index}
                className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg border border-primary-300 font-medium"
              >
                {asignacion.ejecutivo?.nombre_completo}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Instrucciones / Descripción
        </label>
        <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl whitespace-pre-wrap">
          {tramite.instrucciones}
        </div>
      </div>

      {/* Sección especial para Registro de Actividades */}
      {tramite.tipo_tramite === 'registro_actividad' && (
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Detalles del Registro de Actividad
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Tipo de Trámite
              </label>
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl font-medium text-blue-900">
                {tramite.activity_subtype?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Agente
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.agente_usuario?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Tipo de Seguro
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurance_type?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Quién Atiende
              </label>
              <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl font-medium text-green-900">
                {tramite.attending_user?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha de Inicio
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.request_datetime
                  ? new Date(tramite.request_datetime).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Fecha de Finalización
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.completion_datetime
                  ? new Date(tramite.completion_datetime).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Pendiente'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Estatus de Actividad
              </label>
              {tramite.estatus ? (
                <div
                  className="px-4 py-3 rounded-xl font-bold border"
                  style={{
                    backgroundColor: (tramite.estatus.color || getEstatusColor(tramite.estatus.nombre)) + '20',
                    color: tramite.estatus.color || getEstatusColor(tramite.estatus.nombre),
                    borderColor: tramite.estatus.color || getEstatusColor(tramite.estatus.nombre),
                  }}
                >
                  {tramite.estatus.nombre}
                  {tramite.cerrado && (
                    <span className="ml-2 text-xs font-normal opacity-70">(Cerrado)</span>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500">
                  N/A
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Aseguradoras
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurers_nombres && tramite.insurers_nombres.length > 0
                  ? tramite.insurers_nombres.join(', ')
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-neutral-200 pt-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Información del Tramite</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Fecha de Creación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(tramite.fecha_creacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {tramite.creado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {tramite.creado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Última Modificación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(tramite.ultima_modificacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {tramite.modificado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {tramite.modificado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          {tramite.cerrado_en && (
            <div>
              <div className="flex items-center space-x-2 text-neutral-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Fecha de Cierre:</span>
              </div>
              <div className="text-neutral-900 ml-6">
                {new Date(tramite.cerrado_en).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              {tramite.cerrado_por_usuario && (
                <div className="text-neutral-600 ml-6 text-xs">
                  por {tramite.cerrado_por_usuario.nombre_completo}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
