import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Oficina, RegistroEmpleadoFormData } from '../types';
import { useAuth } from '../context/AuthContext';

const initialFormData: RegistroEmpleadoFormData = {
  nombre: '',
  apellidos: '',
  puesto: '',
  oficina_id: '',
  fecha_nacimiento: '',
  fecha_ingreso_jiro: '',
  celular_laboral: '',
  email_laboral: '',
  extension_telefonica: '',
  foto_perfil_url: '',
  equipo_computo_marca: '',
  equipo_computo_modelo: '',
  equipo_celular_marca: '',
  equipo_celular_modelo: '',
};

export function RegistroPersonal() {
  const { session } = useAuth();
  const [formData, setFormData] = useState<RegistroEmpleadoFormData>(initialFormData);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegistroEmpleadoFormData, string>>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  useEffect(() => {
    cargarOficinas();
  }, []);

  async function cargarOficinas() {
    try {
      const { data, error } = await supabase
        .from('oficinas')
        .select('*')
        .eq('activa', true)
        .order('nombre');

      if (error) throw error;
      setOficinas(data || []);
    } catch (error) {
      console.error('Error cargando oficinas:', error);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof RegistroEmpleadoFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, foto_perfil_url: 'El archivo debe ser una imagen' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, foto_perfil_url: 'La imagen no debe superar 5MB' }));
      return;
    }

    setUploadingFoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `perfiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, foto_perfil_url: publicUrl }));
      setFotoPreview(publicUrl);
      setErrors(prev => ({ ...prev, foto_perfil_url: '' }));
    } catch (error) {
      console.error('Error subiendo foto:', error);
      setErrors(prev => ({ ...prev, foto_perfil_url: 'Error al subir la imagen' }));
    } finally {
      setUploadingFoto(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Partial<Record<keyof RegistroEmpleadoFormData, string>> = {};

    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.apellidos.trim()) newErrors.apellidos = 'Los apellidos son obligatorios';
    if (!formData.puesto.trim()) newErrors.puesto = 'El puesto es obligatorio';
    if (!formData.oficina_id) newErrors.oficina_id = 'La oficina es obligatoria';
    if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'La fecha de nacimiento es obligatoria';
    if (!formData.fecha_ingreso_jiro) newErrors.fecha_ingreso_jiro = 'La fecha de ingreso es obligatoria';
    if (!formData.celular_laboral.trim()) newErrors.celular_laboral = 'El celular laboral es obligatorio';
    if (!formData.email_laboral.trim()) {
      newErrors.email_laboral = 'El email laboral es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_laboral)) {
      newErrors.email_laboral = 'El email no es válido';
    }
    if (!formData.equipo_computo_marca.trim()) newErrors.equipo_computo_marca = 'La marca del equipo de cómputo es obligatoria';
    if (!formData.equipo_computo_modelo.trim()) newErrors.equipo_computo_modelo = 'El modelo del equipo de cómputo es obligatorio';
    if (!formData.equipo_celular_marca.trim()) newErrors.equipo_celular_marca = 'La marca del equipo celular es obligatoria';
    if (!formData.equipo_celular_modelo.trim()) newErrors.equipo_celular_modelo = 'El modelo del equipo celular es obligatorio';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) {
      setErrorMessage('Por favor, corrige los errores en el formulario');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/registrar-empleado`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar empleado');
      }

      setSuccessMessage(
        'Empleado registrado correctamente. El usuario fue creado con estatus pendiente de activación y deberá ser activado por un administrador antes de poder ingresar.'
      );
      setFormData(initialFormData);
      setFotoPreview('');

      setTimeout(() => {
        setSuccessMessage('');
      }, 10000);

    } catch (error) {
      console.error('Error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al registrar empleado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8">
            <h1 className="text-3xl font-bold text-white">Registro de Personal</h1>
            <p className="mt-2 text-blue-100">Formulario para alta de empleados internos de JIRO</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm text-red-700">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Datos Personales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.nombre ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>}
                  </div>

                  <div>
                    <label htmlFor="apellidos" className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="apellidos"
                      name="apellidos"
                      value={formData.apellidos}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.apellidos ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.apellidos && <p className="mt-1 text-sm text-red-600">{errors.apellidos}</p>}
                  </div>

                  <div>
                    <label htmlFor="fecha_nacimiento" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Nacimiento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="fecha_nacimiento"
                      name="fecha_nacimiento"
                      value={formData.fecha_nacimiento}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.fecha_nacimiento ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.fecha_nacimiento && <p className="mt-1 text-sm text-red-600">{errors.fecha_nacimiento}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Datos Laborales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="puesto" className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="puesto"
                      name="puesto"
                      value={formData.puesto}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.puesto ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.puesto && <p className="mt-1 text-sm text-red-600">{errors.puesto}</p>}
                  </div>

                  <div>
                    <label htmlFor="oficina_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Oficina <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="oficina_id"
                      name="oficina_id"
                      value={formData.oficina_id}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.oficina_id ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Seleccionar oficina</option>
                      {oficinas.map(oficina => (
                        <option key={oficina.id} value={oficina.id}>
                          {oficina.nombre}
                        </option>
                      ))}
                    </select>
                    {errors.oficina_id && <p className="mt-1 text-sm text-red-600">{errors.oficina_id}</p>}
                  </div>

                  <div>
                    <label htmlFor="fecha_ingreso_jiro" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Ingreso a JIRO <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="fecha_ingreso_jiro"
                      name="fecha_ingreso_jiro"
                      value={formData.fecha_ingreso_jiro}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.fecha_ingreso_jiro ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.fecha_ingreso_jiro && <p className="mt-1 text-sm text-red-600">{errors.fecha_ingreso_jiro}</p>}
                  </div>

                  <div>
                    <label htmlFor="celular_laboral" className="block text-sm font-medium text-gray-700 mb-1">
                      Celular Laboral (Línea JIRO) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="celular_laboral"
                      name="celular_laboral"
                      value={formData.celular_laboral}
                      onChange={handleInputChange}
                      placeholder="5512345678"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.celular_laboral ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.celular_laboral && <p className="mt-1 text-sm text-red-600">{errors.celular_laboral}</p>}
                  </div>

                  <div>
                    <label htmlFor="email_laboral" className="block text-sm font-medium text-gray-700 mb-1">
                      E-Mail Laboral (JIRO) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email_laboral"
                      name="email_laboral"
                      value={formData.email_laboral}
                      onChange={handleInputChange}
                      placeholder="usuario@jiro.com.mx"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.email_laboral ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.email_laboral && <p className="mt-1 text-sm text-red-600">{errors.email_laboral}</p>}
                  </div>

                  <div>
                    <label htmlFor="extension_telefonica" className="block text-sm font-medium text-gray-700 mb-1">
                      Extensión Telefónica
                    </label>
                    <input
                      type="text"
                      id="extension_telefonica"
                      name="extension_telefonica"
                      value={formData.extension_telefonica}
                      onChange={handleInputChange}
                      placeholder="Ej: 101"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Equipo Asignado
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="equipo_computo_marca" className="block text-sm font-medium text-gray-700 mb-1">
                      Marca de Equipo de Cómputo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="equipo_computo_marca"
                      name="equipo_computo_marca"
                      value={formData.equipo_computo_marca}
                      onChange={handleInputChange}
                      placeholder="Ej: HP, Dell, Lenovo"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.equipo_computo_marca ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.equipo_computo_marca && <p className="mt-1 text-sm text-red-600">{errors.equipo_computo_marca}</p>}
                  </div>

                  <div>
                    <label htmlFor="equipo_computo_modelo" className="block text-sm font-medium text-gray-700 mb-1">
                      Modelo de Equipo de Cómputo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="equipo_computo_modelo"
                      name="equipo_computo_modelo"
                      value={formData.equipo_computo_modelo}
                      onChange={handleInputChange}
                      placeholder="Ej: Pavilion 15, Latitude 5410"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.equipo_computo_modelo ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.equipo_computo_modelo && <p className="mt-1 text-sm text-red-600">{errors.equipo_computo_modelo}</p>}
                  </div>

                  <div>
                    <label htmlFor="equipo_celular_marca" className="block text-sm font-medium text-gray-700 mb-1">
                      Marca de Equipo Celular <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="equipo_celular_marca"
                      name="equipo_celular_marca"
                      value={formData.equipo_celular_marca}
                      onChange={handleInputChange}
                      placeholder="Ej: Apple, Samsung, Xiaomi"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.equipo_celular_marca ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.equipo_celular_marca && <p className="mt-1 text-sm text-red-600">{errors.equipo_celular_marca}</p>}
                  </div>

                  <div>
                    <label htmlFor="equipo_celular_modelo" className="block text-sm font-medium text-gray-700 mb-1">
                      Modelo de Equipo Celular <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="equipo_celular_modelo"
                      name="equipo_celular_modelo"
                      value={formData.equipo_celular_modelo}
                      onChange={handleInputChange}
                      placeholder="Ej: iPhone 13, Galaxy S21, Redmi Note 10"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.equipo_celular_modelo ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.equipo_celular_modelo && <p className="mt-1 text-sm text-red-600">{errors.equipo_celular_modelo}</p>}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                  Foto de Perfil
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="foto_perfil" className="block text-sm font-medium text-gray-700 mb-1">
                      Foto de Perfil (Opcional)
                    </label>
                    <input
                      type="file"
                      id="foto_perfil"
                      accept="image/*"
                      onChange={handleFotoChange}
                      disabled={uploadingFoto}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {errors.foto_perfil_url && <p className="mt-1 text-sm text-red-600">{errors.foto_perfil_url}</p>}
                    <p className="mt-1 text-sm text-gray-500">Tamaño máximo: 5MB. Formatos: JPG, PNG, GIF</p>
                  </div>

                  {(uploadingFoto || fotoPreview) && (
                    <div className="flex items-center justify-center">
                      {uploadingFoto ? (
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <p className="mt-2 text-sm text-gray-600">Subiendo imagen...</p>
                        </div>
                      ) : fotoPreview ? (
                        <div className="text-center">
                          <img
                            src={fotoPreview}
                            alt="Preview"
                            className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                          />
                          <p className="mt-2 text-sm text-green-600">Imagen cargada correctamente</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setFormData(initialFormData);
                  setFotoPreview('');
                  setErrors({});
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                disabled={loading}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpiar Formulario
              </button>
              <button
                type="submit"
                disabled={loading || uploadingFoto}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registrando...
                  </>
                ) : (
                  'Registrar Empleado'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
