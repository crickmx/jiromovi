import { useState, useEffect } from 'react';
import { X, User, Briefcase, Shield, Clock, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTramiteActivityTypes,
  getInsuranceTypes,
  getAseguradoras,
  getUsersByOffice,
  getUsersWhoCanAttend,
  createRegistroActividad,
  updateRegistroActividad,
  formatDateTimeForInput,
  formatDateTimeFromInput
} from '../../lib/registroActividadesUtils';
import {
  validateRegistroActividadForm,
  PROGRESS_OPTIONS,
  COTIZACION_EMISION_STATUS_OPTIONS,
  isCotizacionEmisionType,
  type RegistroActividadFormData,
  type TramiteActivityType,
  type InsuranceType,
  type Aseguradora,
  type UsuarioOficina
} from '../../lib/registroActividadesTypes';

interface RegistroActividadFormProps {
  onClose: () => void;
  onSuccess: () => void;
  tramiteId?: string; // Si se proporciona, estamos en modo edición
  initialData?: {
    activity_subtype_id?: string;
    agente_usuario_id?: string;
    insurance_type_id?: string;
    insurers?: string[];
    attending_user_id?: string;
    request_datetime?: string;
    completion_datetime?: string;
    progress_percent?: number;
    resultado?: string;
    prioridad?: 'Alta' | 'Media' | 'Baja';
    instrucciones?: string;
  };
}

export function RegistroActividadForm({ onClose, onSuccess, tramiteId, initialData }: RegistroActividadFormProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const isEditMode = !!tramiteId;

  // Catálogos
  const [tramiteTypes, setTramiteTypes] = useState<TramiteActivityType[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [agenteUsers, setAgenteUsers] = useState<UsuarioOficina[]>([]);
  const [attendingUsers, setAttendingUsers] = useState<UsuarioOficina[]>([]);

  // Form data
  const [activitySubtypeId, setActivitySubtypeId] = useState('');
  const [agenteUserId, setAgenteUserId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([]);
  const [attendingUserId, setAttendingUserId] = useState('');
  const [requestDatetime, setRequestDatetime] = useState(formatDateTimeForInput(new Date()));
  const [completionDatetime, setCompletionDatetime] = useState('');
  const [progressPercent, setProgressPercent] = useState<0 | 50 | 100>(0);
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [instrucciones, setInstrucciones] = useState('');

  // Para Cotización/Emisión: usar estatus como string en vez de progressPercent
  const [estatusNombre, setEstatusNombre] = useState('Iniciado');

  // Estado derivado: es Cotización/Emisión?
  const [isCotizacionEmision, setIsCotizacionEmision] = useState(false);

  // Multiselect state
  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);
  const [insurerSearchTerm, setInsurerSearchTerm] = useState('');

  useEffect(() => {
    loadCatalogs();

    // Si estamos en modo edición, cargar datos iniciales
    if (isEditMode && initialData) {
      if (initialData.activity_subtype_id) setActivitySubtypeId(initialData.activity_subtype_id);
      if (initialData.agente_usuario_id) setAgenteUserId(initialData.agente_usuario_id);
      if (initialData.insurance_type_id) setInsuranceTypeId(initialData.insurance_type_id);
      if (initialData.insurers) setSelectedInsurers(initialData.insurers);
      if (initialData.attending_user_id) setAttendingUserId(initialData.attending_user_id);
      if (initialData.request_datetime) setRequestDatetime(formatDateTimeForInput(new Date(initialData.request_datetime)));
      if (initialData.completion_datetime) setCompletionDatetime(formatDateTimeForInput(new Date(initialData.completion_datetime)));
      if (initialData.progress_percent !== undefined) setProgressPercent(initialData.progress_percent as 0 | 50 | 100);
      if (initialData.prioridad) setPrioridad(initialData.prioridad);
      if (initialData.instrucciones) setInstrucciones(initialData.instrucciones);

      // Si hay resultado, inferir el estatus de cotización/emisión
      if (initialData.resultado) {
        const statusOption = COTIZACION_EMISION_STATUS_OPTIONS.find(opt => opt.resultado === initialData.resultado);
        if (statusOption) {
          setEstatusNombre(statusOption.value);
        }
      }
    }
  }, [isEditMode, initialData]);

  // Detectar si el tipo seleccionado es "Cotización / Emisión"
  useEffect(() => {
    if (activitySubtypeId && tramiteTypes.length > 0) {
      const selectedType = tramiteTypes.find(t => t.id === activitySubtypeId);
      if (selectedType) {
        setIsCotizacionEmision(isCotizacionEmisionType(selectedType.nombre));
        // Reset estatus al cambiar el tipo
        setEstatusNombre('Iniciado');
        setProgressPercent(0);
      }
    } else {
      setIsCotizacionEmision(false);
    }
  }, [activitySubtypeId, tramiteTypes]);

  useEffect(() => {
    // Preseleccionar usuario actual en "Quién Atiende"
    if (usuario && attendingUsers.length > 0 && !attendingUserId) {
      const currentUser = attendingUsers.find(u => u.id === usuario.id);
      if (currentUser) {
        setAttendingUserId(usuario.id);
      }
    }
  }, [usuario, attendingUsers]);

  // Cargar usuarios de la oficina cuando cambia "Quién Atiende"
  useEffect(() => {
    const loadAgenteUsers = async () => {
      if (!attendingUserId) {
        setAgenteUsers([]);
        return;
      }

      // Buscar la oficina del usuario que atiende
      const attendingUser = attendingUsers.find(u => u.id === attendingUserId);

      console.log('=== DEBUG: Cargando usuarios de oficina ===');
      console.log('Usuario que atiende seleccionado:', attendingUser);
      console.log('Oficina ID:', attendingUser?.oficina_id);

      if (!attendingUser?.oficina_id) {
        console.log('ADVERTENCIA: Usuario que atiende no tiene oficina asignada');
        setAgenteUsers([]);
        return;
      }

      const users = await getUsersByOffice(attendingUser.oficina_id);
      console.log('Usuarios encontrados en oficina:', users);
      setAgenteUsers(users);
    };

    loadAgenteUsers();
  }, [attendingUserId, attendingUsers]);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [types, insurance, insurers, attending] = await Promise.all([
        getTramiteActivityTypes(),
        getInsuranceTypes(),
        getAseguradoras(),
        getUsersWhoCanAttend()
      ]);

      setTramiteTypes(types);
      setInsuranceTypes(insurance);
      setAseguradoras(insurers);
      setAttendingUsers(attending);
    } catch (error) {
      console.error('Error loading catalogs:', error);
      setErrors(['Error al cargar los catálogos']);
    } finally {
      setLoading(false);
    }
  };

  const handleInsurerToggle = (insurerId: string) => {
    setSelectedInsurers(prev =>
      prev.includes(insurerId)
        ? prev.filter(id => id !== insurerId)
        : [...prev, insurerId]
    );
  };

  const filteredAseguradoras = aseguradoras.filter(a =>
    a.nombre.toLowerCase().includes(insurerSearchTerm.toLowerCase())
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
      progress_percent: progressPercent,
      prioridad,
      instrucciones
    };

    const validationErrors = validateRegistroActividadForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && tramiteId) {
        // Modo edición
        await updateRegistroActividad(tramiteId, {
          ...formData,
          estatus_nombre: isCotizacionEmision ? estatusNombre : undefined
        });
        console.log('Registro actualizado exitosamente');
      } else {
        // Modo creación
        await createRegistroActividad({
          ...formData,
          creado_por: usuario!.id,
          estatus_nombre: isCotizacionEmision ? estatusNombre : undefined
        });
        console.log('Registro creado exitosamente');
      }

      // Llamar a onSuccess primero para recargar datos
      await onSuccess();

      // Luego cerrar el modal
      onClose();
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} registro actividad:`, error);
      const errorMessage = error?.message || error?.hint || error?.details || `Error al ${isEditMode ? 'actualizar' : 'crear'} el registro de actividad`;
      setErrors([errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const selectedInsurersNames = aseguradoras
    .filter(a => selectedInsurers.includes(a.id))
    .map(a => a.nombre)
    .join(', ');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Editar Registro de Actividades' : 'Nuevo Registro de Actividades'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Complete todos los campos obligatorios
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Tipo de Trámite */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Tipo de Trámite *
              </label>
              <select
                value={activitySubtypeId}
                onChange={(e) => setActivitySubtypeId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Seleccione...</option>
                {tramiteTypes
                  .filter(type => {
                    const nombre = type.nombre.toLowerCase();
                    return nombre.includes('cotizaci') || nombre.includes('emisi') || nombre.includes('otro');
                  })
                  .map(type => (
                    <option key={type.id} value={type.id}>
                      {type.nombre}
                    </option>
                  ))}
              </select>
            </div>

            {/* 2. Agente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Agente *
              </label>
              <select
                value={agenteUserId}
                onChange={(e) => setAgenteUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                required
                disabled={!attendingUserId}
              >
                <option value="">
                  {attendingUserId ? 'Seleccione...' : 'Primero seleccione Quién Atiende'}
                </option>
                {agenteUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.nombre_completo} - {user.rol}
                    {user.oficina_nombre && ` (${user.oficina_nombre})`}
                  </option>
                ))}
              </select>
              {!attendingUserId && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Seleccione "Quién Atiende" para ver los agentes disponibles de esa oficina
                </p>
              )}
              {attendingUserId && agenteUsers.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  No hay usuarios activos en la oficina del usuario seleccionado
                </p>
              )}
              {attendingUserId && agenteUsers.length > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {agenteUsers.length} usuario{agenteUsers.length !== 1 ? 's' : ''} disponible{agenteUsers.length !== 1 ? 's' : ''} en esta oficina
                </p>
              )}
            </div>

            {/* 3. Tipo de Seguro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Tipo de Seguro *
              </label>
              <select
                value={insuranceTypeId}
                onChange={(e) => setInsuranceTypeId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Seleccione...</option>
                {insuranceTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Aseguradoras (multiselect) - Campo completo ancho */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Building2 className="w-4 h-4 inline mr-2" />
              Aseguradoras * (seleccione una o más)
            </label>
            <div
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer dark:bg-gray-700 dark:text-white"
              onClick={() => setShowInsurerDropdown(!showInsurerDropdown)}
            >
              {selectedInsurers.length === 0 ? (
                <span className="text-gray-500">Seleccione aseguradoras...</span>
              ) : (
                <span>{selectedInsurersNames}</span>
              )}
            </div>

            {showInsurerDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                  <input
                    type="text"
                    placeholder="Buscar aseguradora..."
                    value={insurerSearchTerm}
                    onChange={(e) => setInsurerSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="p-2">
                  {filteredAseguradoras.map(aseg => (
                    <label
                      key={aseg.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInsurers.includes(aseg.id)}
                        onChange={() => handleInsurerToggle(aseg.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {aseg.nombre}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 5. Quién Atiende */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Quién Atiende *
              </label>
              <select
                value={attendingUserId}
                onChange={(e) => {
                  setAttendingUserId(e.target.value);
                  setAgenteUserId(''); // Limpiar agente cuando cambia quien atiende
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Seleccione...</option>
                {attendingUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.nombre_completo} - {user.rol}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Estatus - Condicional según tipo de trámite */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Estatus *
              </label>
              {isCotizacionEmision ? (
                // Para Cotización/Emisión: mostrar estatus específicos
                <select
                  value={estatusNombre}
                  onChange={(e) => setEstatusNombre(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {COTIZACION_EMISION_STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                // Para Otro: mostrar progreso genérico
                <select
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value) as 0 | 50 | 100)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {PROGRESS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 7. Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha *
              </label>
              <input
                type="datetime-local"
                value={requestDatetime}
                onChange={(e) => setRequestDatetime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* 8. Avance % */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Avance % *
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value) as 0 | 50 | 100)}
                  className="w-full"
                  disabled={isCotizacionEmision}
                />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">0%</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{progressPercent}%</span>
                  <span className="text-gray-600 dark:text-gray-400">100%</span>
                </div>
                {isCotizacionEmision && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    El avance se calcula automáticamente según el estatus de Cotización/Emisión
                  </p>
                )}
              </div>
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prioridad *
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>

          {/* Instrucciones / Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción / Instrucciones
            </label>
            <textarea
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Describa los detalles del trámite..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Guardando...' : (isEditMode ? 'Actualizar Registro' : 'Crear Registro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
