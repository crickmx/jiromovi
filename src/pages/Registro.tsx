import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { UserPlus, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Oficina {
  id: string;
  nombre: string;
}

export default function Registro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loadingOficinas, setLoadingOficinas] = useState(true);

  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    whatsapp: '',
    esAgenteJiro: null as boolean | null,
    oficinaId: ''
  });

  const [errors, setErrors] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    whatsapp: '',
    esAgenteJiro: '',
    oficinaId: ''
  });

  // Cargar oficinas activas al montar
  useEffect(() => {
    cargarOficinas();
  }, []);

  const cargarOficinas = async () => {
    try {
      setLoadingOficinas(true);
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setOficinas(data || []);
    } catch (err) {
      console.error('Error cargando oficinas:', err);
    } finally {
      setLoadingOficinas(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validateWhatsApp = (phone: string): boolean => {
    // Validar formato mexicano: 10 dígitos
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const formatWhatsAppE164 = (phone: string): string => {
    // Convertir a formato E.164 (521 + 10 dígitos)
    const cleaned = phone.replace(/\D/g, '');
    return `521${cleaned}`;
  };

  const validateForm = (): boolean => {
    const newErrors = {
      nombre: '',
      apellidos: '',
      email: '',
      whatsapp: '',
      esAgenteJiro: '',
      oficinaId: ''
    };

    let isValid = true;

    // Validar nombre
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }

    // Validar apellidos
    if (!formData.apellidos.trim()) {
      newErrors.apellidos = 'Los apellidos son obligatorios';
      isValid = false;
    }

    // Validar email
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
      isValid = false;
    }

    // Validar WhatsApp
    if (!formData.whatsapp.trim()) {
      newErrors.whatsapp = 'El WhatsApp es obligatorio';
      isValid = false;
    } else if (!validateWhatsApp(formData.whatsapp)) {
      newErrors.whatsapp = 'Formato inválido (10 dígitos)';
      isValid = false;
    }

    // Validar si es agente
    if (formData.esAgenteJiro === null) {
      newErrors.esAgenteJiro = 'Debes responder esta pregunta';
      isValid = false;
    }

    // Validar oficina (solo si es agente)
    if (formData.esAgenteJiro && !formData.oficinaId) {
      newErrors.oficinaId = 'Debes seleccionar una oficina';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Formatear WhatsApp a E.164
      const whatsappE164 = formatWhatsAppE164(formData.whatsapp);

      // Llamar función de Supabase
      const { data, error: rpcError } = await supabase.rpc('procesar_registro_no_usuario', {
        p_nombre: formData.nombre.trim(),
        p_apellidos: formData.apellidos.trim(),
        p_email: formData.email.trim().toLowerCase(),
        p_whatsapp: whatsappE164,
        p_es_agente_jiro: formData.esAgenteJiro,
        p_oficina_id: formData.oficinaId || null,
        p_metadata: {
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (rpcError) {
        console.error('Error RPC:', rpcError);
        setError('Error al procesar el registro. Intenta nuevamente.');
        return;
      }

      if (data && !data.success) {
        setError(data.message || 'Error al procesar el registro');
        return;
      }

      // Éxito
      setSuccess(true);

    } catch (err: any) {
      console.error('Error en registro:', err);
      setError(err.message || 'Error al procesar el registro');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-neutral-900 mb-2">
              ¡Listo!
            </h2>
            <p className="text-neutral-600 text-lg">
              Recibimos tus datos. En breve un miembro del equipo te contactará.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 text-left">
            <p className="text-sm text-blue-800">
              <strong>Te contactaremos a:</strong>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              📧 {formData.email}
            </p>
            <p className="text-sm text-blue-700">
              📱 {formData.whatsapp}
            </p>
          </div>

          <Button
            onClick={() => navigate('/login')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-blue-600 p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <UserPlus className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Aún no soy usuario</h1>
          </div>
          <p className="text-blue-100">
            Completa el formulario y nos pondremos en contacto contigo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Error general */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.nombre
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-neutral-300 focus:ring-primary-500'
              }`}
              placeholder="Tu nombre"
              disabled={loading}
            />
            {errors.nombre && (
              <p className="text-sm text-red-500 mt-1">{errors.nombre}</p>
            )}
          </div>

          {/* Apellidos */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.apellidos}
              onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.apellidos
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-neutral-300 focus:ring-primary-500'
              }`}
              placeholder="Tus apellidos"
              disabled={loading}
            />
            {errors.apellidos && (
              <p className="text-sm text-red-500 mt-1">{errors.apellidos}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-neutral-300 focus:ring-primary-500'
              }`}
              placeholder="tu@email.com"
              disabled={loading}
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email}</p>
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              WhatsApp <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => {
                // Solo permitir números
                const value = e.target.value.replace(/\D/g, '');
                setFormData({ ...formData, whatsapp: value });
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.whatsapp
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-neutral-300 focus:ring-primary-500'
              }`}
              placeholder="5512345678 (10 dígitos)"
              maxLength={10}
              disabled={loading}
            />
            {errors.whatsapp && (
              <p className="text-sm text-red-500 mt-1">{errors.whatsapp}</p>
            )}
          </div>

          {/* ¿Es agente? */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              ¿Eres agente de Grupo JIRO? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="esAgenteJiro"
                  checked={formData.esAgenteJiro === true}
                  onChange={() => setFormData({ ...formData, esAgenteJiro: true })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  disabled={loading}
                />
                <span className="text-neutral-700">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="esAgenteJiro"
                  checked={formData.esAgenteJiro === false}
                  onChange={() => setFormData({ ...formData, esAgenteJiro: false, oficinaId: '' })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  disabled={loading}
                />
                <span className="text-neutral-700">No</span>
              </label>
            </div>
            {errors.esAgenteJiro && (
              <p className="text-sm text-red-500 mt-1">{errors.esAgenteJiro}</p>
            )}
          </div>

          {/* Oficina (condicional) */}
          {formData.esAgenteJiro === true && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Oficina <span className="text-red-500">*</span>
              </label>
              {loadingOficinas ? (
                <div className="text-sm text-neutral-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando oficinas...
                </div>
              ) : (
                <select
                  value={formData.oficinaId}
                  onChange={(e) => setFormData({ ...formData, oficinaId: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.oficinaId
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-neutral-300 focus:ring-primary-500'
                  }`}
                  disabled={loading}
                >
                  <option value="">Selecciona tu oficina</option>
                  {oficinas.map((oficina) => (
                    <option key={oficina.id} value={oficina.id}>
                      {oficina.nombre}
                    </option>
                  ))}
                </select>
              )}
              {errors.oficinaId && (
                <p className="text-sm text-red-500 mt-1">{errors.oficinaId}</p>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/login')}
              disabled={loading}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Enviar registro
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
