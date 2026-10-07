import { useState, useEffect } from 'react';
import { UserPlus, Upload, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert } from '../components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { optimizarImagenAvatar } from '../lib/imageOptimizer';

interface Oficina {
  id: string;
  nombre: string;
}

type RolRegistro = 'Empleado' | 'Agente';

export default function RegistroPersonal() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    rol: 'Empleado' as RolRegistro,
    nombre: '',
    apellidos: '',
    puesto: '',
    oficina_id: '',
    fecha_nacimiento: '',
    fecha_ingreso: '',
    celular_laboral: '',
    email_laboral: '',
    extension_telefonica: '',
    imagen_perfil_url: '',
    equipo_computo: '',
    equipo_celular: '',
    cedula_cnsf: '',
    celular_personal: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    cargarOficinas();
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.classList.add('public-page');
    return () => { if (root) root.classList.remove('public-page'); };
  }, []);

  const cargarOficinas = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-active-oficinas`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (Array.isArray(result.oficinas)) {
          setOficinas(result.oficinas);
          return;
        }
      }
    } catch (err) {
      console.error('Error cargando oficinas vía edge function:', err);
    }

    const { data } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (data) setOficinas(data);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado debe ser una imagen (JPG, PNG, WebP)');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);
      setImageInfo('Optimizando y comprimiendo imagen...');

      const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      // Comprimir, centrar y convertir automáticamente a formato optimizado (JPEG 512x512)
      const { file: optimizedFile, dataUrl, sizeBytes } = await optimizarImagenAvatar(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        squareCrop: true,
      });

      setImagePreview(dataUrl);
      const optimizedSizeKB = (sizeBytes / 1024).toFixed(0);
      setImageInfo(`Optimizada: ${originalSizeMB} MB ➔ ${optimizedSizeKB} KB`);

      const filePath = `avatars/${Date.now()}_${Math.random().toString(36).substring(7)}_${optimizedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, optimizedFile, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, imagen_perfil_url: publicUrl }));
    } catch (err: any) {
      console.error('Error al optimizar/subir imagen:', err);
      setError('Error al procesar la imagen: ' + err.message);
      setImagePreview(null);
      setImageInfo(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.apellidos.trim()) newErrors.apellidos = 'Los apellidos son obligatorios';
    if (!formData.oficina_id) newErrors.oficina_id = 'La oficina es obligatoria';
    if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'La fecha de nacimiento es obligatoria';

    // Email laboral/acceso es SIEMPRE obligatorio
    if (!formData.email_laboral.trim()) {
      newErrors.email_laboral = 'El correo electrónico es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_laboral)) {
      newErrors.email_laboral = 'El correo electrónico no es válido';
    }

    if (formData.rol === 'Empleado') {
      if (!formData.puesto.trim()) newErrors.puesto = 'El puesto es obligatorio';
      if (!formData.fecha_ingreso) newErrors.fecha_ingreso = 'La fecha de ingreso es obligatoria';
      if (!formData.celular_laboral.trim()) newErrors.celular_laboral = 'El celular laboral es obligatorio';
    } else {
      // Para Agentes: Celular Laboral / WhatsApp es obligatorio, cédula CNSF es OPCIONAL
      if (!formData.celular_laboral.trim()) {
        newErrors.celular_laboral = 'El celular laboral / WhatsApp es obligatorio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generarContraseñaSegura = (): string => {
    const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const minusculas = 'abcdefghijklmnopqrstuvwxyz';
    const numeros = '0123456789';
    const especiales = '!@#$%&*-_+=';
    const todos = mayusculas + minusculas + numeros + especiales;

    let contraseña = '';
    contraseña += mayusculas[Math.floor(Math.random() * mayusculas.length)];
    contraseña += minusculas[Math.floor(Math.random() * minusculas.length)];
    contraseña += numeros[Math.floor(Math.random() * minusculas.length)];
    contraseña += especiales[Math.floor(Math.random() * especiales.length)];

    for (let i = 4; i < 16; i++) {
      contraseña += todos[Math.floor(Math.random() * todos.length)];
    }

    return contraseña.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Por favor corrige los errores señalados en el formulario');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const contraseñaAleatoria = generarContraseñaSegura();
      const emailNormalizado = formData.email_laboral.trim().toLowerCase();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-employee`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            password: contraseñaAleatoria,
            userData: {
              nombre: formData.nombre.trim().toUpperCase(),
              apellidos: formData.apellidos.trim().toUpperCase(),
              rol: formData.rol, // 'Empleado' (Colaborador) o 'Agente'
              email_laboral: emailNormalizado,
              email_personal: null,
              puesto: formData.rol === 'Empleado' ? formData.puesto.trim() : 'Agente de Seguros',
              oficina_id: formData.oficina_id,
              fecha_nacimiento: formData.fecha_nacimiento,
              fecha_ingreso: formData.rol === 'Empleado' ? formData.fecha_ingreso : null,
              celular_laboral: formData.celular_laboral.trim(),
              celular_personal: formData.celular_personal.trim() || null,
              cedula_cnsf: formData.cedula_cnsf.trim() || null,
              extension_telefonica: formData.extension_telefonica.trim(),
              imagen_perfil_url: formData.imagen_perfil_url || '/display-avatar.png',
              equipo_computo: formData.equipo_computo.trim(),
              equipo_celular: formData.equipo_celular.trim(),
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar usuario');
      }

      setSuccess(true);

    } catch (err: any) {
      console.error('Error al registrar usuario:', err);
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Registro enviado correctamente
          </h2>
          <p className="text-neutral-600 dark:text-white/70 mb-4">
            Tu solicitud de registro fue enviada exitosamente. Un administrador revisará tu información y activará tu cuenta en breve.
          </p>
          <p className="text-sm text-neutral-500 dark:text-white/50">
            Recibirás un correo electrónico con tus credenciales de acceso una vez que tu cuenta sea activada.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-6 mb-6">
            <img
              src="/logojiro.png"
              alt="JIRO y Asociados"
              className="h-16 object-contain"
            />
            <div className="h-12 w-px bg-neutral-300 dark:bg-white/20"></div>
            <img
              src="/movirecurso_1.png"
              alt="MOVI Digital"
              className="h-16 object-contain"
            />
          </div>
          <PageHeader
            title="Registro de Personal"
            description="Pre-registro para colaboradores y agentes de JIRO"
            icon={UserPlus}
          />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <div className="ml-2">{error}</div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              ¿Cómo te vas a registrar?
            </h2>
            <p className="text-sm text-neutral-500 dark:text-white/60 mb-4">
              Selecciona el tipo de perfil para mostrar los campos correspondientes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'Empleado' as RolRegistro, label: 'Colaborador', desc: 'Personal interno con puesto y línea laboral JIRO.' },
                { key: 'Agente' as RolRegistro, label: 'Agente', desc: 'Agente de seguros y fianzas de JIRO.' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, rol: item.key });
                    setErrors({});
                    setError(null);
                  }}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    formData.rol === item.key
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-neutral-200 dark:border-white/10 hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">{item.label}</p>
                      <p className="text-sm text-neutral-500 dark:text-white/60 mt-1">
                        {item.desc}
                      </p>
                    </div>
                    {formData.rol === item.key && <CheckCircle className="w-6 h-6 text-primary shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Tu nombre de pila"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && <p className="text-sm text-red-500 mt-1">{errors.nombre}</p>}
              </div>

              <div>
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  placeholder="Tus apellidos paterno y materno"
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                  className={errors.apellidos ? 'border-red-500' : ''}
                />
                {errors.apellidos && <p className="text-sm text-red-500 mt-1">{errors.apellidos}</p>}
              </div>

              <div>
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento *</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                  className={errors.fecha_nacimiento ? 'border-red-500' : ''}
                />
                {errors.fecha_nacimiento && <p className="text-sm text-red-500 mt-1">{errors.fecha_nacimiento}</p>}
              </div>

              {formData.rol === 'Empleado' && (
                <div>
                  <Label htmlFor="fecha_ingreso">Fecha de Ingreso a JIRO *</Label>
                  <Input
                    id="fecha_ingreso"
                    type="date"
                    value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                    className={errors.fecha_ingreso ? 'border-red-500' : ''}
                  />
                  {errors.fecha_ingreso && <p className="text-sm text-red-500 mt-1">{errors.fecha_ingreso}</p>}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {formData.rol === 'Empleado' ? 'Datos del Colaborador y Contacto' : 'Datos del Agente y Contacto'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.rol === 'Empleado' && (
                <div>
                  <Label htmlFor="puesto">Puesto *</Label>
                  <Input
                    id="puesto"
                    placeholder="Ej: Ejecutivo de Cuenta, Mesa de Control..."
                    value={formData.puesto}
                    onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                    className={errors.puesto ? 'border-red-500' : ''}
                  />
                  {errors.puesto && <p className="text-sm text-red-500 mt-1">{errors.puesto}</p>}
                </div>
              )}

              <div>
                <Label htmlFor="oficina_id">Oficina / Sucursal JIRO *</Label>
                <Select
                  value={formData.oficina_id}
                  onValueChange={(value) => setFormData({ ...formData, oficina_id: value })}
                >
                  <SelectTrigger className={errors.oficina_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona una oficina" />
                  </SelectTrigger>
                  <SelectContent>
                    {oficinas.map((oficina) => (
                      <SelectItem key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.oficina_id && <p className="text-sm text-red-500 mt-1">{errors.oficina_id}</p>}
              </div>

              {formData.rol === 'Empleado' ? (
                <>
                  <div>
                    <Label htmlFor="celular_laboral">Celular Laboral (Línea JIRO) *</Label>
                    <Input
                      id="celular_laboral"
                      type="tel"
                      placeholder="10 dígitos (ej: 4491234567)"
                      value={formData.celular_laboral}
                      onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                      className={errors.celular_laboral ? 'border-red-500' : ''}
                    />
                    {errors.celular_laboral && <p className="text-sm text-red-500 mt-1">{errors.celular_laboral}</p>}
                  </div>

                  <div>
                    <Label htmlFor="email_laboral">E-Mail Laboral JIRO (Acceso a MOVI) *</Label>
                    <Input
                      id="email_laboral"
                      type="email"
                      placeholder="nombre.apellido@jiro.mx"
                      value={formData.email_laboral}
                      onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                      className={errors.email_laboral ? 'border-red-500' : ''}
                    />
                    {errors.email_laboral && <p className="text-sm text-red-500 mt-1">{errors.email_laboral}</p>}
                  </div>

                  <div>
                    <Label htmlFor="extension_telefonica">Extensión / Teléfono Fijo</Label>
                    <Input
                      id="extension_telefonica"
                      placeholder="Ej: 104 o teléfono directo"
                      value={formData.extension_telefonica}
                      onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="celular_laboral">Celular Laboral / WhatsApp *</Label>
                    <Input
                      id="celular_laboral"
                      type="tel"
                      placeholder="10 dígitos para avisos y trámites"
                      value={formData.celular_laboral}
                      onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                      className={errors.celular_laboral ? 'border-red-500' : ''}
                    />
                    {errors.celular_laboral && <p className="text-sm text-red-500 mt-1">{errors.celular_laboral}</p>}
                  </div>

                  <div>
                    <Label htmlFor="email_laboral">E-Mail (para acceso a la plataforma) *</Label>
                    <Input
                      id="email_laboral"
                      type="email"
                      placeholder="tu.correo@ejemplo.com"
                      value={formData.email_laboral}
                      onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                      className={errors.email_laboral ? 'border-red-500' : ''}
                    />
                    {errors.email_laboral && <p className="text-sm text-red-500 mt-1">{errors.email_laboral}</p>}
                  </div>

                  <div>
                    <Label htmlFor="cedula_cnsf">Cédula CNSF (Opcional)</Label>
                    <Input
                      id="cedula_cnsf"
                      placeholder="Ej: A1234567"
                      value={formData.cedula_cnsf}
                      onChange={(e) => setFormData({ ...formData, cedula_cnsf: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="extension_telefonica">Teléfono Fijo / Oficina</Label>
                    <Input
                      id="extension_telefonica"
                      placeholder="Teléfono fijo de oficina o despacho"
                      value={formData.extension_telefonica}
                      onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="celular_personal">Celular Personal (Opcional)</Label>
                    <Input
                      id="celular_personal"
                      type="tel"
                      placeholder="Teléfono personal alternativo"
                      value={formData.celular_personal}
                      onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>

          {formData.rol === 'Empleado' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                Equipos Asignados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="equipo_computo">Equipo de Cómputo</Label>
                  <Input
                    id="equipo_computo"
                    placeholder="Ej: Dell Latitude 5420 / Mac Mini M2"
                    value={formData.equipo_computo}
                    onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                  />
                  <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                    Marca y modelo del equipo asignado
                  </p>
                </div>

                <div>
                  <Label htmlFor="equipo_celular">Equipo Celular</Label>
                  <Input
                    id="equipo_celular"
                    placeholder="Ej: iPhone 13 Pro / Samsung A54"
                    value={formData.equipo_celular}
                    onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                  />
                  <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
                    Marca y modelo del equipo celular asignado
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1">
              Foto de Perfil
            </h2>
            <p className="text-sm text-neutral-500 dark:text-white/60 mb-4">
              Sube una foto clara de frente. Nuestro sistema la optimiza y centra automáticamente.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary shadow-sm"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full shadow">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center border-2 border-dashed border-neutral-300 dark:border-white/20">
                    <UserPlus className="w-8 h-8 text-neutral-400 dark:text-white/40" />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="imagen_perfil" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-lg transition-colors inline-flex text-sm font-medium">
                      <Upload className="w-4 h-4" />
                      <span>{imagePreview ? 'Cambiar fotografía' : 'Seleccionar fotografía'}</span>
                    </div>
                  </Label>
                  <Input
                    id="imagen_perfil"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imageInfo ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {imageInfo}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-white/50 mt-2">
                      Formatos: JPG, PNG, WebP o fotos de celular (se comprimen automáticamente).
                    </p>
                  )}
                </div>
              </div>
              {uploadingImage && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Optimizando y guardando imagen...
                </div>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-center">
            <Button
              type="submit"
              disabled={loading || uploadingImage}
              className="min-w-[300px] py-6 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enviando registro...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Enviar Registro
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-neutral-500 dark:text-white/50 mt-4">
            Al enviar este formulario, tu información será revisada por un administrador. <br />
            Recibirás una notificación cuando tu cuenta sea activada.
          </p>
        </form>
      </div>
    </div>
  );
}
