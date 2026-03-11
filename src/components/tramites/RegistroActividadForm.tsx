import { useState, useEffect } from 'react';
import { X, User, Briefcase, Shield, Clock, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTramiteActivityTypes,
  getInsuranceTypes,
  getAseguradoras,
  getOfficeUsersForRequester,
  getUsersWhoCanAttend,
  createRegistroActividad,
  formatDateTimeForInput,
  formatDateTimeFromInput
} from '../../lib/registroActividadesUtils';
import {
  validateRegistroActividadForm,
  PROGRESS_OPTIONS,
  type RegistroActividadFormData,
  type TramiteActivityType,
  type InsuranceType,
  type Aseguradora,
  type UsuarioOficina
} from '../../lib/registroActividadesTypes';

interface RegistroActividadFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function RegistroActividadForm({ onClose, onSuccess }: RegistroActividadFormProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Catálogos
  const [tramiteTypes, setTramiteTypes] = useState<TramiteActivityType[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [officeUsers, setOfficeUsers] = useState<UsuarioOficina[]>([]);
  const [attendingUsers, setAttendingUsers] = useState<UsuarioOficina[]>([]);

  // Form data
  const [activitySubtypeId, setActivitySubtypeId] = useState('');
  const [requesterUserId, setRequesterUserId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([]);
  const [attendingUserId, setAttendingUserId] = useState('');
  const [requestDatetime, setRequestDatetime] = useState(formatDateTimeForInput(new Date()));
  const [completionDatetime, setCompletionDatetime] = useState('');
  const [progressPercent, setProgressPercent] = useState<0 | 25 | 50 | 75 | 100>(0);
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [instrucciones, setInstrucciones] = useState('');

  // Multiselect state
  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);
  const [insurerSearchTerm, setInsurerSearchTerm] = useState('');

  useEffect(() => {
    loadCatalogs();
  }, []);

  useEffect(() => {
    // Preseleccionar usuario actual en "Quién Atiende"
    if (usuario && attendingUsers.length > 0 && !attendingUserId) {
      const currentUser = attendingUsers.find(u => u.id === usuario.id);
      if (currentUser) {
        setAttendingUserId(usuario.id);
      }
    }
  }, [usuario, attendingUsers]);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [types, insurance, insurers, office, attending] = await Promise.all([
        getTramiteActivityTypes(),
        getInsuranceTypes(),
        getAseguradoras(),
        getOfficeUsersForRequester(),
        getUsersWhoCanAttend()
      ]);

      setTramiteTypes(types);
      setInsuranceTypes(insurance);
      setAseguradoras(insurers);
      setOfficeUsers(office);
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
      requester_user_id: requesterUserId,
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
      await createRegistroActividad({
        ...formData,
        creado_por: usuario!.id
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating registro actividad:', error);
      setErrors([error.message || 'Error al crear el registro de actividad']);
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
              Nuevo Registro de Actividades
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
            {/* Tipo de Trámite */}
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
                {tramiteTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Solicitante */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Solicitante *
              </label>
              <select
                value={requesterUserId}
                onChange={(e) => setRequesterUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Seleccione...</option>
                {officeUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.nombre_completo} - {user.rol}
                    {user.oficina_nombre && ` (${user.oficina_nombre})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Seguro */}
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

            {/* Quién Atiende */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Quién Atiende *
              </label>
              <select
                value={attendingUserId}
                onChange={(e) => setAttendingUserId(e.target.value)}
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
          </div>

          {/* Aseguradoras (multiselect) */}
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
            {/* Fecha y Hora de Solicitud */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha y Hora de Solicitud *
              </label>
              <input
                type="datetime-local"
                value={requestDatetime}
                onChange={(e) => setRequestDatetime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            {/* Fecha y Hora de Finalización */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Fecha y Hora de Finalización
              </label>
              <input
                type="datetime-local"
                value={completionDatetime}
                onChange={(e) => setCompletionDatetime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Avance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Avance *
              </label>
              <select
                value={progressPercent}
                onChange={(e) => setProgressPercent(Number(e.target.value) as 0 | 25 | 50 | 75 | 100)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                {PROGRESS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              Descripción / Instrucciones *
            </label>
            <textarea
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Describa los detalles del trámite..."
              required
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
              {loading ? 'Guardando...' : 'Crear Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
