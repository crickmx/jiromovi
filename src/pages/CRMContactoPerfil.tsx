import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Phone, Mail, Calendar, Tag } from 'lucide-react';
import {
  obtenerContactoPorId,
  obtenerCotizacionesPorContacto,
  obtenerPolizasPorContacto,
  obtenerTareasPorContacto,
  obtenerTimelinePorContacto,
} from '../lib/crmUtils';
import type { CRMContacto, CRMCotizacion, CRMPoliza, CRMTarea, TimelineItem } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';

export default function CRMContactoPerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contacto, setContacto] = useState<CRMContacto | null>(null);
  const [cotizaciones, setCotizaciones] = useState<CRMCotizacion[]>([]);
  const [polizas, setPolizas] = useState<CRMPoliza[]>([]);
  const [tareas, setTareas] = useState<CRMTarea[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'historial' | 'cotizaciones' | 'polizas' | 'tareas'>('historial');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (id) cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [contactoData, cotizacionesData, polizasData, tareasData, timelineData] = await Promise.all([
        obtenerContactoPorId(id),
        obtenerCotizacionesPorContacto(id),
        obtenerPolizasPorContacto(id),
        obtenerTareasPorContacto(id),
        obtenerTimelinePorContacto(id),
      ]);
      setContacto(contactoData);
      setCotizaciones(cotizacionesData);
      setPolizas(polizasData);
      setTareas(tareasData);
      setTimeline(timelineData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstatusColor = (estatus: string) => {
    const colors: Record<string, string> = {
      Prospecto: 'bg-blue-100 text-blue-800',
      'Cotización Presentada': 'bg-yellow-100 text-yellow-800',
      Negociación: 'bg-orange-100 text-orange-800',
      Cliente: 'bg-green-100 text-green-800',
      Perdido: 'bg-red-100 text-red-800',
    };
    return colors[estatus] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!contacto) {
    return (
      <div className="p-8 text-center">
        <p>Contacto no encontrado</p>
        <Link to="/mi-crm/contactos" className="text-blue-600 hover:underline mt-4">
          Volver a contactos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <button onClick={() => navigate('/mi-crm/contactos')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver a contactos
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold text-gray-900">{contacto.nombre_completo}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getEstatusColor(contacto.estatus)}`}>
                {contacto.estatus}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-gray-600">
                <Phone className="h-4 w-4 mr-2" />
                {contacto.celular}
              </div>
              {contacto.email && (
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {contacto.email}
                </div>
              )}
              <div className="flex items-center text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                Creado: {new Date(contacto.fecha_creacion).toLocaleDateString('es-MX')}
              </div>
              {contacto.etiquetas_segmentacion.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Tag className="h-4 w-4 text-gray-600" />
                  {contacto.etiquetas_segmentacion.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {['historial', 'cotizaciones', 'polizas', 'tareas'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                  tab === t
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'historial' && (
            <div className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay actividades registradas</p>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className={`w-10 h-10 rounded-full bg-${item.color}-100 flex items-center justify-center flex-shrink-0`}>
                      <span className="text-lg">{item.icono}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.titulo}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.descripcion}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(item.fecha).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'cotizaciones' && (
            <div className="space-y-4">
              {cotizaciones.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay cotizaciones registradas</p>
              ) : (
                cotizaciones.map((cot) => (
                  <div key={cot.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{cot.nombre_documento}</h3>
                        <p className="text-sm text-gray-600 mt-1">Estatus: {cot.estatus_cotizacion}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(cot.fecha_presentacion).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      {cot.monto_cotizado && (
                        <p className="text-lg font-bold text-gray-900">
                          ${cot.monto_cotizado.toLocaleString('es-MX')}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'polizas' && (
            <div className="space-y-4">
              {polizas.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay pólizas registradas</p>
              ) : (
                polizas.map((pol) => (
                  <div key={pol.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">Póliza #{pol.numero_poliza}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {pol.tipo_ramo} - {pol.compania_aseguradora}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Vigencia: {new Date(pol.fecha_emision).toLocaleDateString('es-MX')} -{' '}
                          {new Date(pol.fecha_vencimiento).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        ${pol.prima_total.toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'tareas' && (
            <div className="space-y-4">
              {tareas.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay tareas registradas</p>
              ) : (
                tareas.map((tarea) => (
                  <div key={tarea.id} className="p-4 bg-gray-50 rounded-lg flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={tarea.completada}
                      readOnly
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 className={`font-medium ${tarea.completada ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {tarea.tipo_actividad}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{tarea.descripcion}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Vencimiento: {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <ContactoModal
          contacto={contacto}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            cargarDatos();
          }}
        />
      )}
    </div>
  );
}
