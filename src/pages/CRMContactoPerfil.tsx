import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard as Edit, Phone, Mail, Calendar, Tag, Plus, Trash2, CheckCircle, Download, ExternalLink, User, FolderOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { supabase } from '../lib/supabase';
import SeguwalletExpedienteModal from '../components/contactos/SeguwalletExpedienteModal';
import {
  obtenerContactoPorId,
  obtenerCotizacionesPorContacto,
  obtenerPolizasPorContacto,
  obtenerTareasPorContacto,
  obtenerTimelinePorContacto,
  eliminarCotizacion,
  eliminarPoliza,
  eliminarTarea,
  actualizarTarea,
  descargarArchivoCRM,
  abrirArchivoCRM,
  esCumpleanosHoy,
  formatearFechaNacimiento,
  calcularEdad,
} from '../lib/crmUtils';
import type { CRMContacto, CRMCotizacion, CRMPoliza, CRMTarea, TimelineItem } from '../lib/crmTypes';
import ContactoModal from '../components/crm/ContactoModal';
import CotizacionModal from '../components/crm/CotizacionModal';
import PolizaModal from '../components/crm/PolizaModal';
import TareaModal from '../components/crm/TareaModal';

export default function CRMContactoPerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contacto, setContacto] = useState<CRMContacto | null>(null);
  const [cotizaciones, setCotizaciones] = useState<CRMCotizacion[]>([]);
  const [polizas, setPolizas] = useState<CRMPoliza[]>([]);
  const [tareas, setTareas] = useState<CRMTarea[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'historial' | 'cotizaciones' | 'polizas' | 'tareas' | 'expediente'>('historial');
  const [swCustomerId, setSwCustomerId] = useState<string | null>(null);
  const [showExpediente, setShowExpediente] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCotizacionModal, setShowCotizacionModal] = useState(false);
  const [showPolizaModal, setShowPolizaModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [cotizacionEditar, setCotizacionEditar] = useState<CRMCotizacion | undefined>();
  const [polizaEditar, setPolizaEditar] = useState<CRMPoliza | undefined>();
  const [tareaEditar, setTareaEditar] = useState<CRMTarea | undefined>();

  useEffect(() => {
    if (id) cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [contactoData, cotizacionesData, polizasData, tareasData, timelineData] =
        await Promise.all([
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

      // Look up Seguwallet customer via CRM link then email fallback
      if (contactoData) {
        const { data: linkData } = await supabase
          .from('seguwallet_crm_links')
          .select('seguwallet_customer_id')
          .eq('crm_contacto_id', id)
          .maybeSingle();
        if (linkData?.seguwallet_customer_id) {
          setSwCustomerId(linkData.seguwallet_customer_id);
        } else if (contactoData.email) {
          const { data: swData } = await supabase
            .from('seguwallet_customers')
            .select('id')
            .eq('email', contactoData.email)
            .maybeSingle();
          if (swData?.id) setSwCustomerId(swData.id);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarCotizacion = async (idCot: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return;
    try {
      await eliminarCotizacion(idCot);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar cotización');
    }
  };

  const handleEliminarPoliza = async (idPol: string) => {
    if (!confirm('¿Eliminar esta póliza?')) return;
    try {
      await eliminarPoliza(idPol);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar póliza');
    }
  };

  const handleEliminarTarea = async (idTar: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await eliminarTarea(idTar);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar tarea');
    }
  };

  const handleToggleTarea = async (tarea: CRMTarea) => {
    try {
      await actualizarTarea(tarea.id, { completada: !tarea.completada });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar tarea');
    }
  };

  const handleAgregarCotizacion = () => {
    setCotizacionEditar(undefined);
    setShowCotizacionModal(true);
  };

  const handleAgregarPoliza = () => {
    setPolizaEditar(undefined);
    setShowPolizaModal(true);
  };

  const handleAgregarTarea = () => {
    setTareaEditar(undefined);
    setShowTareaModal(true);
  };

  const getEstatusColor = (estatus: string) => {
    const colors: Record<string, string> = {
      Prospecto: 'bg-primary-100 text-primary-800',
      'Cotización Presentada': 'bg-yellow-100 text-yellow-800',
      Negociación: 'bg-orange-100 text-orange-800',
      Cliente: 'bg-green-100 text-green-800',
      Perdido: 'bg-red-100 text-red-800',
    };
    return colors[estatus] || 'bg-neutral-100 text-neutral-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!contacto) {
    return (
      <div className="p-8 text-center">
        <p>Contacto no encontrado</p>
        <button
          onClick={() => navigate('/contactos')}
          className="text-accent hover:underline mt-4"
        >
          Volver a contactos
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <PageHeader
        title={contacto.nombre_completo}
        description={contacto.tipo_contacto}
        icon={User}
        backTo="/contactos"
        backLabel="Volver a Contactos"
        badge={
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getEstatusColor(contacto.estatus)}`}>
            {contacto.estatus}
          </span>
        }
        actions={
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
        }
      />

      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6 mb-6 mt-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="space-y-2">
              <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                <Phone className="h-4 w-4 mr-2" />
                {contacto.celular}
              </div>
              {contacto.email && (
                <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                  <Mail className="h-4 w-4 mr-2" />
                  {contacto.email}
                </div>
              )}
              <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                <Calendar className="h-4 w-4 mr-2" />
                Creado: {new Date(contacto.fecha_creacion).toLocaleDateString('es-MX')}
              </div>
              {contacto.fecha_nacimiento && contacto.tipo_contacto === 'Persona' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-neutral-600 dark:text-neutral-400">
                    <Calendar className="h-4 w-4 mr-2" />
                    Cumpleaños: {formatearFechaNacimiento(contacto.fecha_nacimiento)}
                    {calcularEdad(contacto.fecha_nacimiento) && (
                      <span className="ml-1 text-sm">
                        ({calcularEdad(contacto.fecha_nacimiento)} años)
                      </span>
                    )}
                  </div>
                  {esCumpleanosHoy(contacto.fecha_nacimiento) && (
                    <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-semibold flex items-center gap-1 animate-pulse">
                      🎂 ¡Hoy!
                    </span>
                  )}
                </div>
              )}
              {contacto.fuente_origen && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  Fuente: <span className="font-medium">{contacto.fuente_origen}</span>
                </div>
              )}
              {contacto.etiquetas_segmentacion.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Tag className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  {contacto.etiquetas_segmentacion.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {['historial', 'cotizaciones', 'polizas', 'tareas', 'expediente'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                className={`px-6 py-3 font-medium text-sm whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white'
                }`}
              >
                {t === 'expediente' && <FolderOpen className="h-3.5 w-3.5" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'historial' && (
            <div className="space-y-4">
              {timeline.length === 0 ? (
                <p className="text-neutral-500 dark:text-white/50 text-center py-8">No hay actividades registradas</p>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{item.icono === 'FileText' ? '📄' : item.icono === 'Shield' ? '🛡️' : item.icono === 'CheckCircle' ? '✅' : '📝'}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-neutral-900 dark:text-white">{item.titulo}</h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{item.descripcion}</p>
                      <p className="text-xs text-neutral-500 dark:text-white/50 mt-2">
                        {new Date(item.fecha).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'cotizaciones' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Cotizaciones</h3>
                <button
                  onClick={handleAgregarCotizacion}
                  className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Cotización
                </button>
              </div>
              <div className="space-y-4">
                {cotizaciones.length === 0 ? (
                  <p className="text-neutral-500 dark:text-white/50 text-center py-8">No hay cotizaciones registradas</p>
                ) : (
                  cotizaciones.map((cot) => (
                    <div key={cot.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-neutral-900 dark:text-white">{cot.nombre_documento}</h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            Estatus: {cot.estatus_cotizacion}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                            {new Date(cot.fecha_presentacion).toLocaleDateString('es-MX')}
                          </p>
                          {cot.observaciones && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">{cot.observaciones}</p>
                          )}
                          {cot.archivo_url && (
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                onClick={() => abrirArchivoCRM(cot.archivo_url!)}
                                className="flex items-center gap-2 text-accent hover:text-primary-800 text-sm font-medium hover:bg-primary-50 px-3 py-1.5 rounded transition"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Abrir PDF
                              </button>
                              <button
                                onClick={() => descargarArchivoCRM(cot.archivo_url!, cot.nombre_documento + '.pdf')}
                                className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium hover:bg-green-50 px-3 py-1.5 rounded transition"
                              >
                                <Download className="h-4 w-4" />
                                Descargar
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {cot.monto_cotizado && (
                            <p className="text-lg font-bold text-neutral-900 dark:text-white mr-4">
                              ${cot.monto_cotizado.toLocaleString('es-MX')}
                            </p>
                          )}
                          <button
                            onClick={() => handleEliminarCotizacion(cot.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'polizas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Pólizas</h3>
                <button
                  onClick={handleAgregarPoliza}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Póliza
                </button>
              </div>
              <div className="space-y-4">
                {polizas.length === 0 ? (
                  <p className="text-neutral-500 dark:text-white/50 text-center py-8">No hay pólizas registradas</p>
                ) : (
                  polizas.map((pol) => (
                    <div key={pol.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-neutral-900 dark:text-white">Póliza #{pol.numero_poliza}</h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            {pol.tipo_ramo} - {pol.compania_aseguradora}
                          </p>
                          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                            Vigencia: {new Date(pol.fecha_emision).toLocaleDateString('es-MX')} -{' '}
                            {new Date(pol.fecha_vencimiento).toLocaleDateString('es-MX')}
                          </p>
                          {pol.observaciones && (
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">{pol.observaciones}</p>
                          )}
                          {pol.archivo_url && (
                            <div className="flex items-center gap-3 mt-3">
                              <button
                                onClick={() => abrirArchivoCRM(pol.archivo_url!)}
                                className="flex items-center gap-2 text-accent hover:text-primary-800 text-sm font-medium hover:bg-primary-50 px-3 py-1.5 rounded transition"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Abrir PDF
                              </button>
                              <button
                                onClick={() => descargarArchivoCRM(pol.archivo_url!, `Poliza_${pol.numero_poliza}.pdf`)}
                                className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium hover:bg-green-50 px-3 py-1.5 rounded transition"
                              >
                                <Download className="h-4 w-4" />
                                Descargar
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-green-600 mr-4">
                            ${pol.prima_total.toLocaleString('es-MX')}
                          </p>
                          <button
                            onClick={() => handleEliminarPoliza(pol.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'expediente' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Expediente Digital</h3>
                  <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">Documentos almacenados del contacto en Seguwallet</p>
                </div>
                {swCustomerId && (
                  <button
                    onClick={() => setShowExpediente(true)}
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Abrir expediente
                  </button>
                )}
              </div>
              {!swCustomerId ? (
                <div className="text-center py-12 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                  <FolderOpen className="h-10 w-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
                  <p className="text-sm font-medium text-neutral-600 dark:text-white/60">Sin cuenta Seguwallet</p>
                  <p className="text-xs text-neutral-400 dark:text-white/40 mt-1 max-w-xs mx-auto">
                    Este contacto no tiene una cuenta Seguwallet asociada. Activa Seguwallet desde la lista de contactos para gestionar su expediente.
                  </p>
                </div>
              ) : (
                <div
                  className="cursor-pointer border border-neutral-100 dark:border-neutral-700 rounded-xl p-6 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition group"
                  onClick={() => setShowExpediente(true)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition">
                      <FolderOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">Ver y gestionar documentos</p>
                      <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">Subir, visualizar, descargar y eliminar documentos del expediente</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'tareas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Tareas</h3>
                <button
                  onClick={handleAgregarTarea}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Tarea
                </button>
              </div>
              <div className="space-y-4">
                {tareas.length === 0 ? (
                  <p className="text-neutral-500 dark:text-white/50 text-center py-8">No hay tareas registradas</p>
                ) : (
                  tareas.map((tarea) => (
                    <div
                      key={tarea.id}
                      className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg flex items-start gap-3"
                    >
                      <button
                        onClick={() => handleToggleTarea(tarea)}
                        className={`mt-1 flex-shrink-0 ${tarea.completada ? 'text-green-600' : 'text-neutral-400 dark:text-neutral-500'}`}
                      >
                        <CheckCircle className="h-6 w-6" />
                      </button>
                      <div className="flex-1">
                        <h3
                          className={`font-medium ${tarea.completada ? 'line-through text-neutral-500 dark:text-white/50' : 'text-neutral-900 dark:text-white'}`}
                        >
                          {tarea.tipo_actividad}
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{tarea.descripcion}</p>
                        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                          Vencimiento: {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX')}{' '}
                          {new Date(tarea.fecha_vencimiento).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEliminarTarea(tarea.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
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

      {showCotizacionModal && (
        <CotizacionModal
          contactoId={id!}
          cotizacion={cotizacionEditar}
          onClose={() => setShowCotizacionModal(false)}
          onSave={() => {
            setShowCotizacionModal(false);
            cargarDatos();
          }}
        />
      )}

      {showPolizaModal && (
        <PolizaModal
          contactoId={id!}
          poliza={polizaEditar}
          onClose={() => setShowPolizaModal(false)}
          onSave={() => {
            setShowPolizaModal(false);
            cargarDatos();
          }}
        />
      )}

      {showTareaModal && (
        <TareaModal
          contactoId={id!}
          tarea={tareaEditar}
          onClose={() => setShowTareaModal(false)}
          onSave={() => {
            setShowTareaModal(false);
            cargarDatos();
          }}
        />
      )}

      {showExpediente && swCustomerId && contacto && (
        <SeguwalletExpedienteModal
          customerId={swCustomerId}
          customerName={contacto.nombre_completo}
          onClose={() => setShowExpediente(false)}
          readOnly={false}
        />
      )}
    </div>
  );
}
