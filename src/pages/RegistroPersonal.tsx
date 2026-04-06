import { useState, useEffect } from 'react';
import { UserPlus, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert } from '../components/ui/alert';

interface Oficina {
  id: string;
  nombre: string;
}

export default function RegistroPersonal() {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    puesto: '',
    oficina_id: '',
    fecha_nacimiento: '',
    fecha_ingreso_jiro: '',
    celular_laboral: '',
    email_laboral: '',
    extension_telefonica: '',
    imagen_perfil_url: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    cargarOficinas();
  }, []);

  const cargarOficinas = async () => {
    const { data, error } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (!error && data) {
      setOficinas(data);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, imagen_perfil_url: publicUrl }));
    } catch (err: any) {
      console.error('Error al subir imagen:', err);
      setError('Error al subir la imagen: ' + err.message);
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

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
    contraseña += numeros[Math.floor(Math.random() * numeros.length)];
    contraseña += especiales[Math.floor(Math.random() * especiales.length)];

    for (let i = 4; i < 16; i++) {
      contraseña += todos[Math.floor(Math.random() * todos.length)];
    }

    return contraseña.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Por favor corrige los errores en el formulario');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const contraseñaAleatoria = generarContraseñaSegura();

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
              rol: 'Empleado',
              email_laboral: formData.email_laboral.trim().toLowerCase(),
              puesto: formData.puesto.trim(),
              oficina_id: formData.oficina_id,
              fecha_nacimiento: formData.fecha_nacimiento,
              fecha_ingreso_jiro: formData.fecha_ingreso_jiro,
              celular_laboral: formData.celular_laboral.trim(),
              extension_telefonica: formData.extension_telefonica.trim(),
              imagen_perfil_url: formData.imagen_perfil_url || '/display-avatar.png',
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar empleado');
      }

      setSuccess(true);

    } catch (err: any) {
      console.error('Error al registrar empleado:', err);
      setError(err.message || 'Error al registrar empleado');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Registro enviado correctamente
          </h2>
          <p className="text-slate-600 mb-4">
            Tu solicitud de registro fue enviada exitosamente. Un administrador revisará tu información y activará tu cuenta en breve.
          </p>
          <p className="text-sm text-slate-500">
            Recibirás un correo electrónico con tus credenciales de acceso una vez que tu cuenta sea activada.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-6 mb-6">
            <img
              src="/logojiro.png"
              alt="JIRO y Asociados"
              className="h-16 object-contain"
            />
            <div className="h-12 w-px bg-slate-300"></div>
            <img
              src="/movirecurso_1.png"
              alt="MOVI Digital"
              className="h-16 object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Registro de Personal</h1>
              <p className="text-slate-600">Pre-registro para empleados de JIRO</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <div className="ml-2">{error}</div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Datos Personales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
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

              <div>
                <Label htmlFor="fecha_ingreso_jiro">Fecha de Ingreso a JIRO *</Label>
                <Input
                  id="fecha_ingreso_jiro"
                  type="date"
                  value={formData.fecha_ingreso_jiro}
                  onChange={(e) => setFormData({ ...formData, fecha_ingreso_jiro: e.target.value })}
                  className={errors.fecha_ingreso_jiro ? 'border-red-500' : ''}
                />
                {errors.fecha_ingreso_jiro && <p className="text-sm text-red-500 mt-1">{errors.fecha_ingreso_jiro}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Datos Laborales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="puesto">Puesto *</Label>
                <Input
                  id="puesto"
                  value={formData.puesto}
                  onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                  className={errors.puesto ? 'border-red-500' : ''}
                />
                {errors.puesto && <p className="text-sm text-red-500 mt-1">{errors.puesto}</p>}
              </div>

              <div>
                <Label htmlFor="oficina_id">Oficina *</Label>
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

              <div>
                <Label htmlFor="celular_laboral">Celular Laboral (Línea JIRO) *</Label>
                <Input
                  id="celular_laboral"
                  type="tel"
                  placeholder="5512345678"
                  value={formData.celular_laboral}
                  onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                  className={errors.celular_laboral ? 'border-red-500' : ''}
                />
                {errors.celular_laboral && <p className="text-sm text-red-500 mt-1">{errors.celular_laboral}</p>}
              </div>

              <div>
                <Label htmlFor="email_laboral">E-Mail Laboral (JIRO) *</Label>
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
                <Label htmlFor="extension_telefonica">Extensión Telefónica</Label>
                <Input
                  id="extension_telefonica"
                  placeholder="Ej: 123"
                  value={formData.extension_telefonica}
                  onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Foto de Perfil
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="imagen_perfil" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex">
                      <Upload className="w-4 h-4" />
                      <span>Seleccionar imagen</span>
                    </div>
                  </Label>
                  <Input
                    id="imagen_perfil"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    Imagen opcional. Máximo 5MB.
                  </p>
                </div>
              </div>
              {uploadingImage && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subiendo imagen...
                </div>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-center">
            <Button
              type="submit"
              disabled={loading || uploadingImage}
              className="min-w-[300px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando registro...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Enviar Registro
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            Al enviar este formulario, tu información será revisada por un administrador. <br />
            Recibirás un correo electrónico cuando tu cuenta sea activada.
          </p>
        </form>
      </div>
    </div>
  );
}
