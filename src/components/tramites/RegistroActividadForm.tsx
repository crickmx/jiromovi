import { useState, useEffect } from 'react';
import { X, User, Briefcase, Shield, Clock, Calendar, Building2, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTramiteActivityTypes,
  getInsuranceTypes,
  getAseguradoras,
  getUsersByOffice,
  getUsersWhoCanAttend,
  getTicketEstatus,
  createRegistroActividad,
  updateRegistroActividad,
  formatDateTimeForInput,
  formatDateTimeFromInput
} from '../../lib/registroActividadesUtils';
import {
  validateRegistroActividadForm,
  REGISTRO_ACTIVIDAD_ESTATUS,
  isEstatusFinal,
  getEstatusColor,
  type RegistroActividadFormData,
  type TramiteActivityType,
  type InsuranceType,
  type Aseguradora,
  type UsuarioOficina
} from '../../lib/registroActividadesTypes';

interface RegistroActividadFormProps {
  onClose: () => void;
  onSuccess: () => void;
  tramiteId?: string;
  initialData?: {
    activity_subtype_id?: string;
    agente_usuario_id?: string;
    insurance_type_id?: string;
    insurers?: string[];
    attending_user_id?: string;
    request_datetime?: string;
    completion_datetime?: string;
    estatus_nombre?: string;
    resultado?: string;
    prioridad?: 'Alta' | 'Media' | 'Baja';
    instrucciones?: string;
    cerrado?: boolean;
  };
}

export function RegistroActividadForm({ onClose, onSuccess, tramiteId, initialData }: RegistroActividadFormProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const isEditMode = !!tramiteId;

  const [tramiteTypes, setTramiteTypes] = useState<TramiteActivityType[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [agenteUsers, setAgenteUsers] = useState<UsuarioOficina[]>([]);
  const [attendingUsers, setAttendingUsers] = useState<UsuarioOficina[]>([]);
  const [dbEstatusList, setDbEstatusList] = useState<Array<{ id: string; nombre: string; color: string; orden: number }>>([]);

  const [activitySubtypeId, setActivitySubtypeId] = useState('');
  const [agenteUserId, setAgenteUserId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([]);
  const [attendingUserId, setAttendingUserId] = useState('');
  const [requestDatetime, setRequestDatetime] = useState(formatDateTimeForInput(new Date()));
  const [completionDatetime, setCompletionDatetime] = useState('');
  const [estatusNombre, setEstatusNombre] = useState('Iniciado');
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [instrucciones, setInstrucciones] = useState('');

  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);
  const [insurerSearchTerm, setInsurerSearchTerm] = useState('');

  const isCerrado = initialData?.cerrado && isEstatusFinal(initialData?.estatus_nombre ?? '');
  const isAdmin = usuario?.rol === 'Administrador';
  const canEdit = !isCerrado || isAdmin;

  useEffect(() => {
    loadCatalogs();

    if (initialData?.activity_subtype_id && !isEditMode) {
      setActivitySubtypeId(initialData.activity_subtype_id);
    }

    if (isEditMode && initialData) {
      if (initialData.activity_subtype_id) setActivitySubtypeId(initialData.activity_subtype_id);
      if (initialData.agente_usuario_id) setAgenteUserId(initialData.agente_usuario_id);
      if (initialData.insurance_type_id) setInsuranceTypeId(initialData.insurance_type_id);
      if (initialData.insurers) setSelectedInsurers(initialData.insurers);
      if (initialData.attending_user_id) setAttendingUserId(initialData.attending_user_id);
      if (initialData.request_datetime) setRequestDatetime(formatDateTimeForInput(new Date(initialData.request_datetime)));
      if (initialData.completion_datetime) setCompletionDatetime(formatDateTimeForInput(new Date(initialData.completion_datetime)));
      if (initialData.prioridad) setPrioridad(initialData.prioridad);
      if (initialData.instrucciones) setInstrucciones(initialData.instrucciones);
      if (initialData.estatus_nombre) setEstatusNombre(initialData.estatus_nombre);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (usuario && attendingUsers.length > 0 && !attendingUserId) {
      if (attendingUsers.find(u => u.id === usuario.id)) {
        setAttendingUserId(usuario.id);
      }
    }
  }, [usuario, attendingUsers]);

  useEffect(() => {
    const loadAgenteUsers = async () => {
      if (!attendingUserId) { setAgenteUsers([]); return; }
      const attendingUser = attendingUsers.find(u => u.id === attendingUserId);
      if (!attendingUser?.oficina_id) { setAgenteUsers([]); return; }
      const users = await getUsersByOffice(attendingUser.oficina_id);
      setAgenteUsers(users);
    };
    loadAgenteUsers();
  }, [attendingUserId, attendingUsers]);

  // Auto-set completion datetime when final status is selected
  useEffect(() => {
    if (isEstatusFinal(estatusNombre) && !completionDatetime) {
      setCompletionDatetime(formatDateTimeForInput(new Date()));
    }
  }, [estatusNombre]);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [types, insurance, insurers, attending, estatus] = await Promise.all([
        getTramiteActivityTypes(),
        getInsuranceTypes(),
        getAseguradoras(),
        getUsersWhoCanAttend(),
        getTicketEstatus('registro_actividad')
      ]);
      setTramiteTypes(types);
      setInsuranceTypes(insurance);
      setAseguradoras(insurers);
      setAttendingUsers(attending);
      setDbEstatusList(estatus);
    } catch (error) {
      console.error('Error loading catalogs:', error);
      setErrors(['Error al cargar los catálogos']);
    } finally {
      setLoading(false);
    }
  };

  const handleInsurerToggle = (id: string) => {
    setSelectedInsurers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredAseguradoras = aseguradoras.filter(a =>
    (a.nombre ?? '').toLowerCase().includes(insurerSearchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const formData: RegistroActividadFormData = {
      activity_subtype_id: activitySubtypeId,
      agente_usuario_id: agenteUserId,
      insurance_type_id: insuranceTypeId,
      insurers: selectedInsurers,
      attending_user_id: attendingUserId,
      request_datetime: formatDateTimeFromInput(requestDatetime),
      completion_datetime: completionDatetime ? formatDateTimeFromInput(completionDatetime) : undefined,
      estatus_nombre: estatusNombre,
      prioridad,
      instrucciones
    };

    const validationErrors = validateRegistroActividadForm(formData);
    if (validationErrors.length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    try {
      if (isEditMode && tramiteId) {
        await updateRegistroActividad(tramiteId, formData);
      } else {
        await createRegistroActividad({ ...formData, creado_por: usuario!.id });
      }
      await onSuccess();
      onClose();
    } catch (error: any) {
      setErrors([error?.message || `Error al ${isEditMode ? 'actualizar' : 'crear'} el registro`]);
    } finally {
      setLoading(false);
    }
  };

  const selectedInsurersNames = aseguradoras
    .filter(a => selectedInsurers.includes(a.id))
    .map(a => a.nombre).join(', ');

  const estatusActual = REGISTRO_ACTIVIDAD_ESTATUS.find(e => e.nombre === estatusNombre);

  const fieldClass = `w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white`;
  const disabledFieldClass = `w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed`;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Editar Registro de Actividades' : 'Nuevo Registro de Actividades'}
            </h2>
            {isCerrado && !isAdmin && (
              <div className="flex items-center gap-1.5 mt-1">
                <Lock className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-500 font-medium">Trámite cerrado — solo lectura</span>
              </div>
            )}
            {isCerrado && isAdmin && (
              <div className="flex items-center gap-1.5 mt-1">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-500 font-medium">Trámite cerrado — editando como Administrador</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((err, i) => (
                  <li key={i} className="text-red-700 dark:text-red-400 text-xs">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* === PIPELINE DE ESTATUS === */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              Estatus del Trámite
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {REGISTRO_ACTIVIDAD_ESTATUS.map((est, idx) => {
                const isActive = estatusNombre === est.nombre;
                const isPassed = REGISTRO_ACTIVIDAD_ESTATUS.findIndex(e => e.nombre === estatusNombre) > idx;
                const isLast = idx === REGISTRO_ACTIVIDAD_ESTATUS.length - 1;

                return (
                  <div key={est.nombre} className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => canEdit && setEstatusNombre(est.nombre)}
                      className={`
                        relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                        border-2 transition-all duration-200
                        ${isActive
                          ? 'text-white border-transparent shadow-md scale-105'
                          : isPassed
                          ? 'text-white border-transparent opacity-60'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                        }
                        ${!canEdit ? 'cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      style={{
                        backgroundColor: (isActive || isPassed) ? est.color : undefined,
                        borderColor: isActive ? est.color : undefined,
                      }}
                    >
                      {(isActive || isPassed) && <CheckCircle2 className="w-3 h-3" />}
                      {est.nombre}
                    </button>
                    {!isLast && (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
            {estatusActual?.esFinal && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ backgroundColor: estatusActual.color + '15', color: estatusActual.color }}
              >
                <Lock className="w-3.5 h-3.5" />
                Este es un estatus final. El trámite quedará cerrado.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo de Trámite */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Briefcase className="w-3.5 h-3.5 inline mr-1.5" />
                Tipo de Trámite *
              </label>
              <select
                value={activitySubtypeId}
                onChange={(e) => setActivitySubtypeId(e.target.value)}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
                required
              >
                <option value="">Seleccione...</option>
                {tramiteTypes
                  .filter(type => {
                    const n = (type.nombre ?? '').toLowerCase();
                    return (n.includes('cotizaci') && n.includes('emisi')) || n === 'otro';
                  })
                  .map(type => (
                    <option key={type.id} value={type.id}>{type.nombre}</option>
                  ))}
              </select>
            </div>

            {/* Quién Atiende */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1.5" />
                Quién Atiende *
              </label>
              <select
                value={attendingUserId}
                onChange={(e) => { setAttendingUserId(e.target.value); setAgenteUserId(''); }}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
                required
              >
                <option value="">Seleccione...</option>
                {attendingUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                ))}
              </select>
            </div>

            {/* Agente */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1.5" />
                Agente *
              </label>
              <select
                value={agenteUserId}
                onChange={(e) => setAgenteUserId(e.target.value)}
                className={canEdit && attendingUserId ? fieldClass : disabledFieldClass}
                required
                disabled={!canEdit || !attendingUserId}
              >
                <option value="">
                  {attendingUserId ? 'Seleccione...' : 'Primero seleccione Quién Atiende'}
                </option>
                {agenteUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                ))}
              </select>
            </div>

            {/* Tipo de Seguro */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                Tipo de Seguro *
              </label>
              <select
                value={insuranceTypeId}
                onChange={(e) => setInsuranceTypeId(e.target.value)}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
                required
              >
                <option value="">Seleccione...</option>
                {insuranceTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Aseguradoras multiselect */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <Building2 className="w-3.5 h-3.5 inline mr-1.5" />
              Aseguradoras * (seleccione una o más)
            </label>
            <div
              className={`w-full px-3 py-2 text-sm border rounded-lg dark:text-white ${
                canEdit
                  ? 'border-gray-300 dark:border-gray-600 cursor-pointer dark:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
              onClick={() => canEdit && setShowInsurerDropdown(!showInsurerDropdown)}
            >
              {selectedInsurers.length === 0
                ? <span className="text-gray-500">Seleccione aseguradoras...</span>
                : <span>{selectedInsurersNames}</span>
              }
            </div>

            {showInsurerDropdown && canEdit && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-auto">
                <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={insurerSearchTerm}
                    onChange={(e) => setInsurerSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="p-1">
                  {filteredAseguradoras.map(aseg => (
                    <label key={aseg.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedInsurers.includes(aseg.id)}
                        onChange={() => handleInsurerToggle(aseg.id)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{aseg.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fecha de Inicio */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                Fecha de Inicio *
              </label>
              <input
                type="datetime-local"
                value={requestDatetime}
                onChange={(e) => setRequestDatetime(e.target.value)}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
                required
              />
            </div>

            {/* Fecha de Finalización */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />
                Fecha de Finalización
                {isEstatusFinal(estatusNombre) && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="datetime-local"
                value={completionDatetime}
                onChange={(e) => setCompletionDatetime(e.target.value)}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
              />
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Prioridad *
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                className={canEdit ? fieldClass : disabledFieldClass}
                disabled={!canEdit}
                required
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>

          {/* Instrucciones */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Descripción / Instrucciones
            </label>
            <textarea
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              rows={3}
              disabled={!canEdit}
              className={canEdit ? `${fieldClass} resize-none` : `${disabledFieldClass} resize-none`}
              placeholder="Describa los detalles del trámite..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              {canEdit ? 'Cancelar' : 'Cerrar'}
            </button>
            {canEdit && (
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Crear Registro')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
