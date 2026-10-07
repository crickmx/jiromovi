import { useState, useEffect } from 'react';
import { 
  UserPlus, Upload, Loader as Loader2, CircleAlert as AlertCircle, 
  CircleCheck as CheckCircle, Sparkles, ArrowRight, ArrowLeft, 
  Building2, Phone, Mail, User, Shield, Briefcase, Globe, 
  CreditCard, Laptop, Smartphone, RotateCcw, Check
} from 'lucide-react';
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

const STORAGE_DRAFT_KEY = 'movi_registro_personal_wizard_draft_v3';

export default function RegistroPersonal() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

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
    web_slug: '',
    banco: '',
    clabe: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar oficinas
  useEffect(() => {
    cargarOficinas();
  }, []);

  // Clases para layout público
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.classList.add('public-page');
    return () => { if (root) root.classList.remove('public-page'); };
  }, []);

  // Cargar borrador persistente de localStorage al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          setFormData(prev => ({ ...prev, ...parsed.formData }));
          if (parsed.formData.imagen_perfil_url) {
            setImagePreview(parsed.formData.imagen_perfil_url);
          }
        }
        if (parsed.step && typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= 4) {
          setCurrentStep(parsed.step);
        }
        setDraftRestored(true);
      }
    } catch (e) {
      console.warn('Error al restaurar borrador:', e);
    }
  }, []);

  // Guardar en localStorage ante cualquier cambio
  useEffect(() => {
    if (!success) {
      try {
        localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify({
          formData,
          step: currentStep,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Error al guardar borrador:', e);
      }
    }
  }, [formData, currentStep, success]);

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

  const limpiarBorrador = () => {
    if (confirm('¿Deseas reiniciar el formulario y borrar los datos capturados?')) {
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      setFormData({
        rol: 'Empleado',
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
        web_slug: '',
        banco: '',
        clabe: '',
      });
      setImagePreview(null);
      setImageInfo(null);
      setCurrentStep(1);
      setErrors({});
      setError(null);
      setDraftRestored(false);
    }
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

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio';
      if (!formData.apellidos.trim()) newErrors.apellidos = 'Los apellidos son obligatorios';
      if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'La fecha de nacimiento es obligatoria';
      if (!formData.fecha_ingreso) newErrors.fecha_ingreso = 'La fecha de ingreso a JIRO es obligatoria';
    }

    if (stepNumber === 2) {
      if (!formData.oficina_id) newErrors.oficina_id = 'La oficina es obligatoria';

      if (!formData.email_laboral.trim()) {
        newErrors.email_laboral = 'El correo electrónico es obligatorio';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_laboral)) {
        newErrors.email_laboral = 'El correo electrónico no es válido';
      }

      if (!formData.celular_laboral.trim()) {
        newErrors.celular_laboral = 'El celular de contacto / WhatsApp es obligatorio';
      }

      if (formData.rol === 'Empleado') {
        if (!formData.puesto.trim()) newErrors.puesto = 'El puesto es obligatorio';
      }
    }

    if (stepNumber === 3) {
      if (formData.web_slug && !/^[a-z0-9-]+$/.test(formData.web_slug)) {
        newErrors.web_slug = 'El slug solo puede contener letras minúsculas, números y guiones';
      }
      if (formData.clabe && formData.clabe.trim().length !== 18) {
        newErrors.clabe = 'La CLABE interbancaria debe tener exactamente 18 dígitos';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    setError(null);
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setError('Por favor completa los campos obligatorios antes de continuar');
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setError('Hay campos obligatorios pendientes por completar.');
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
              rol: formData.rol,
              email_laboral: emailNormalizado,
              email_personal: null,
              puesto: formData.rol === 'Empleado' ? formData.puesto.trim() : 'Agente de Seguros',
              oficina_id: formData.oficina_id,
              fecha_nacimiento: formData.fecha_nacimiento,
              fecha_ingreso: formData.fecha_ingreso || null,
              celular_laboral: formData.celular_laboral.trim(),
              celular_personal: formData.celular_personal.trim() || null,
              cedula_cnsf: formData.cedula_cnsf.trim() || null,
              extension_telefonica: formData.extension_telefonica.trim(),
              imagen_perfil_url: formData.imagen_perfil_url || '/display-avatar.png',
              equipo_computo: formData.equipo_computo.trim(),
              equipo_celular: formData.equipo_celular.trim(),
              web_slug: formData.web_slug.trim() || null,
              banco: formData.banco.trim() || '',
              clabe: formData.clabe.trim() || '',
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrar usuario');
      }

      localStorage.removeItem(STORAGE_DRAFT_KEY);
      setSuccess(true);

    } catch (err: any) {
      console.error('Error al registrar usuario:', err);
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const getNombreOficina = (id: string) => {
    return oficinas.find(o => o.id === id)?.nombre || 'Oficina seleccionada';
  };

  const stepsMeta = [
    { number: 1, title: 'Identidad', subtitle: 'Perfil y datos' },
    { number: 2, title: 'Contacto', subtitle: 'Oficina y líneas' },
    { number: 3, title: 'Personalización', subtitle: 'Foto y adicionales' },
    { number: 4, title: 'Confirmación', subtitle: 'Revisión final' },
  ];

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-white to-blue-50/30 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 p-4">
        <Card className="max-w-lg w-full p-8 text-center shadow-xl border-neutral-200 dark:border-white/10 rounded-3xl animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">
            ¡Registro Enviado!
          </h2>
          <p className="text-neutral-600 dark:text-white/75 mb-6 text-base leading-relaxed">
            Tu solicitud de registro como <strong>{formData.rol === 'Empleado' ? 'Colaborador' : 'Agente'}</strong> fue recibida exitosamente. Un administrador revisará tu información para activar tu cuenta.
          </p>
          <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Nombre:</span>
              <span className="font-semibold text-neutral-900 dark:text-white">{formData.nombre} {formData.apellidos}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">E-Mail de Acceso:</span>
              <span className="font-mono font-medium text-primary">{formData.email_laboral}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Oficina:</span>
              <span className="text-neutral-800 dark:text-white/90">{getNombreOficina(formData.oficina_id)}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-white/50 mb-6">
            Recibirás un correo electrónico de bienvenida con tus accesos directos en cuanto tu cuenta sea activada.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full py-6 text-base rounded-2xl shadow-md"
          >
            Enviar otro registro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-blue-50/20 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Cabecera / Logos */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-6 mb-4">
            <img
              src="/logojiro.png"
              alt="JIRO y Asociados"
              className="h-14 object-contain filter drop-shadow-sm"
            />
            <div className="h-10 w-px bg-neutral-300 dark:bg-white/20"></div>
            <img
              src="/movirecurso_1.png"
              alt="MOVI Digital"
              className="h-14 object-contain filter drop-shadow-sm"
            />
          </div>
          <PageHeader
            title="Pre-Registro JIRO"
            description="Portal de alta para colaboradores y agentes de seguros"
            icon={UserPlus}
          />
        </div>

        {/* Notificación de borrador restaurado */}
        {draftRestored && (
          <div className="mb-6 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Hemos recuperado tu progreso anterior automáticamente.</span>
            </div>
            <button
              type="button"
              onClick={limpiarBorrador}
              className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Empezar de cero
            </button>
          </div>
        )}

        {/* Stepper Wizard Indicator */}
        <div className="mb-8 bg-surface-card rounded-2xl p-4 md:p-6 border border-soft shadow-sm">
          <div className="grid grid-cols-4 gap-2 relative">
            {stepsMeta.map((s) => {
              const isPassed = currentStep > s.number;
              const isCurrent = currentStep === s.number;
              return (
                <div key={s.number} className="flex flex-col items-center text-center">
                  <div
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 mb-1.5 ${
                      isPassed
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-primary text-white ring-4 ring-primary/20 shadow-md scale-105'
                        : 'bg-neutral-100 dark:bg-white/10 text-neutral-400 dark:text-white/40'
                    }`}
                  >
                    {isPassed ? <Check className="w-5 h-5 stroke-[2.5]" /> : s.number}
                  </div>
                  <span className={`text-xs md:text-sm font-semibold truncate ${
                    isCurrent ? 'text-primary dark:text-primary-light' : 'text-neutral-600 dark:text-white/60'
                  }`}>
                    {s.title}
                  </span>
                  <span className="hidden md:inline text-[11px] text-neutral-400 dark:text-white/40">
                    {s.subtitle}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Barra de progreso interactiva */}
          <div className="w-full bg-neutral-100 dark:bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Mensaje de Error General */}
        {error && (
          <Alert variant="destructive" className="mb-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4" />
            <div className="ml-2 font-medium">{error}</div>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* ========================================================================= */}
          {/* PASO 1: TIPO DE PERFIL E IDENTIDAD */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="p-6 md:p-8 rounded-3xl border-neutral-200/80 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    1. ¿Cómo te vas a registrar?
                  </h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/60 mb-6">
                  Elige tu perfil para personalizar los datos requeridos.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {[
                    { 
                      key: 'Empleado' as RolRegistro, 
                      label: 'Colaborador', 
                      desc: 'Personal interno con puesto y línea laboral JIRO.',
                      icon: Briefcase 
                    },
                    { 
                      key: 'Agente' as RolRegistro, 
                      label: 'Agente', 
                      desc: 'Agente de seguros y fianzas de JIRO.',
                      icon: Shield 
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = formData.rol === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, rol: item.key });
                          setErrors({});
                          setError(null);
                        }}
                        className={`rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                            : 'border-neutral-200 dark:border-white/10 hover:border-primary/40 bg-surface-card'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-neutral-100 dark:bg-white/10 text-neutral-600'}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-base text-neutral-900 dark:text-white">{item.label}</p>
                              <p className="text-xs text-neutral-500 dark:text-white/60 mt-0.5">{item.desc}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-neutral-100 dark:border-white/10 pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      Datos de Identidad
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombre" className="text-xs font-semibold">Nombre(s) *</Label>
                      <Input
                        id="nombre"
                        placeholder="Ej: Juan Carlos"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className={`mt-1 rounded-xl ${errors.nombre ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.nombre && <p className="text-xs text-red-500 mt-1 font-medium">{errors.nombre}</p>}
                    </div>

                    <div>
                      <Label htmlFor="apellidos" className="text-xs font-semibold">Apellidos *</Label>
                      <Input
                        id="apellidos"
                        placeholder="Ej: Pérez García"
                        value={formData.apellidos}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        className={`mt-1 rounded-xl ${errors.apellidos ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.apellidos && <p className="text-xs text-red-500 mt-1 font-medium">{errors.apellidos}</p>}
                    </div>

                    <div>
                      <Label htmlFor="fecha_nacimiento" className="text-xs font-semibold">Fecha de Nacimiento *</Label>
                      <Input
                        id="fecha_nacimiento"
                        type="date"
                        value={formData.fecha_nacimiento}
                        onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                        className={`mt-1 rounded-xl ${errors.fecha_nacimiento ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.fecha_nacimiento && <p className="text-xs text-red-500 mt-1 font-medium">{errors.fecha_nacimiento}</p>}
                    </div>

                    <div>
                      <Label htmlFor="fecha_ingreso" className="text-xs font-semibold">Fecha de Ingreso a JIRO *</Label>
                      <Input
                        id="fecha_ingreso"
                        type="date"
                        value={formData.fecha_ingreso}
                        onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                        className={`mt-1 rounded-xl ${errors.fecha_ingreso ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.fecha_ingreso && <p className="text-xs text-red-500 mt-1 font-medium">{errors.fecha_ingreso}</p>}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Botonera Paso 1 */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="px-8 py-6 rounded-2xl text-base font-semibold shadow-md flex items-center gap-2"
                >
                  Continuar a Contacto
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PASO 2: DATOS DE CONTACTO Y PUESTO */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="p-6 md:p-8 rounded-3xl border-neutral-200/80 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    2. Ubicación y Contacto
                  </h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/60 mb-6">
                  {formData.rol === 'Empleado' ? 'Información operativa del colaborador en JIRO.' : 'Sucursal y canales de comunicación del agente.'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="oficina_id" className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      Sucursal / Oficina JIRO *
                    </Label>
                    <Select
                      value={formData.oficina_id}
                      onValueChange={(value) => setFormData({ ...formData, oficina_id: value })}
                    >
                      <SelectTrigger className={`mt-1 rounded-xl ${errors.oficina_id ? 'border-red-500 ring-1 ring-red-500' : ''}`}>
                        <SelectValue placeholder="Selecciona una oficina" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {oficinas.map((oficina) => (
                          <SelectItem key={oficina.id} value={oficina.id}>
                            {oficina.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.oficina_id && <p className="text-xs text-red-500 mt-1 font-medium">{errors.oficina_id}</p>}
                  </div>

                  {formData.rol === 'Empleado' ? (
                    <div>
                      <Label htmlFor="puesto" className="text-xs font-semibold">Puesto en JIRO *</Label>
                      <Input
                        id="puesto"
                        placeholder="Ej: Ejecutivo de Cuenta, Mesa de Control..."
                        value={formData.puesto}
                        onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                        className={`mt-1 rounded-xl ${errors.puesto ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.puesto && <p className="text-xs text-red-500 mt-1 font-medium">{errors.puesto}</p>}
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="cedula_cnsf" className="text-xs font-semibold">Cédula CNSF (Opcional)</Label>
                      <Input
                        id="cedula_cnsf"
                        placeholder="Ej: A1234567"
                        value={formData.cedula_cnsf}
                        onChange={(e) => setFormData({ ...formData, cedula_cnsf: e.target.value })}
                        className="mt-1 rounded-xl"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">Si cuentas con cédula CNSF, regístrala aquí.</p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email_laboral" className="text-xs font-semibold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      E-Mail Principal (Acceso a MOVI) *
                    </Label>
                    <Input
                      id="email_laboral"
                      type="email"
                      placeholder={formData.rol === 'Empleado' ? 'nombre.apellido@jiro.mx' : 'tu.correo@ejemplo.com'}
                      value={formData.email_laboral}
                      onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                      className={`mt-1 rounded-xl ${errors.email_laboral ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {errors.email_laboral ? (
                      <p className="text-xs text-red-500 mt-1 font-medium">{errors.email_laboral}</p>
                    ) : (
                      <p className="text-[11px] text-neutral-400 mt-1">Será tu identificador único de inicio de sesión.</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="celular_laboral" className="text-xs font-semibold flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      {formData.rol === 'Empleado' ? 'Celular Laboral (Línea JIRO) *' : 'Celular Laboral / WhatsApp *'}
                    </Label>
                    <Input
                      id="celular_laboral"
                      type="tel"
                      placeholder="10 dígitos (ej: 4491234567)"
                      value={formData.celular_laboral}
                      onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                      className={`mt-1 rounded-xl ${errors.celular_laboral ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {errors.celular_laboral && <p className="text-xs text-red-500 mt-1 font-medium">{errors.celular_laboral}</p>}
                  </div>

                  <div>
                    <Label htmlFor="extension_telefonica" className="text-xs font-semibold">Extensión / Teléfono Fijo</Label>
                    <Input
                      id="extension_telefonica"
                      placeholder="Ej: Ext. 104 o teléfono directo"
                      value={formData.extension_telefonica}
                      onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                      className="mt-1 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="celular_personal" className="text-xs font-semibold">Celular Personal Alternativo (Opcional)</Label>
                    <Input
                      id="celular_personal"
                      type="tel"
                      placeholder="Teléfono móvil adicional"
                      value={formData.celular_personal}
                      onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                      className="mt-1 rounded-xl"
                    />
                  </div>
                </div>
              </Card>

              {/* Botonera Paso 2 */}
              <div className="flex justify-between items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  className="px-6 py-6 rounded-2xl text-base font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="px-8 py-6 rounded-2xl text-base font-semibold shadow-md flex items-center gap-2"
                >
                  Continuar a Personalización
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PASO 3: FOTO DE PERFIL Y DATOS ADICIONALES */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Foto de Perfil con Optimizador */}
              <Card className="p-6 md:p-8 rounded-3xl border-neutral-200/80 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    3. Foto de Perfil & Herramientas
                  </h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/60 mb-6">
                  Sube tu fotografía de perfil y personaliza tus herramientas adicionales.
                </p>

                <div className="bg-neutral-50/70 dark:bg-white/5 border border-neutral-200/70 dark:border-white/10 rounded-2xl p-5 mb-6">
                  <Label className="text-xs font-bold text-neutral-700 dark:text-white/80 block mb-3">Fotografía para Perfil</Label>
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {imagePreview ? (
                      <div className="relative group">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-24 h-24 rounded-2xl object-cover border-2 border-primary shadow-md"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full shadow">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-neutral-100 dark:bg-white/10 flex items-center justify-center border-2 border-dashed border-neutral-300 dark:border-white/20">
                        <UserPlus className="w-8 h-8 text-neutral-400 dark:text-white/40" />
                      </div>
                    )}
                    
                    <div className="flex-1 text-center sm:text-left">
                      <Label htmlFor="imagen_perfil" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white hover:bg-primary/90 rounded-xl transition-all shadow-sm inline-flex text-sm font-semibold">
                          <Upload className="w-4 h-4" />
                          <span>{imagePreview ? 'Cambiar fotografía' : 'Subir fotografía'}</span>
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
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 flex items-center justify-center sm:justify-start gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> {imageInfo}
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-400 dark:text-white/40 mt-1.5">
                          Formatos aceptados: JPG, PNG, WebP o fotos de celular (se optimizan al instante).
                        </p>
                      )}
                    </div>
                  </div>

                  {uploadingImage && (
                    <div className="flex items-center gap-2 text-sm text-primary font-medium animate-pulse mt-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Optimizando y guardando imagen...
                    </div>
                  )}
                </div>

                {/* Datos Específicos por Rol */}
                {formData.rol === 'Agente' ? (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      Página Web Pública (Opcional)
                    </h3>
                    <div>
                      <Label htmlFor="web_slug" className="text-xs font-semibold">Slug para tu Sitio Web</Label>
                      <div className="flex items-center mt-1">
                        <span className="inline-flex items-center px-3 py-2 text-xs text-neutral-500 bg-neutral-100 dark:bg-white/10 border border-r-0 border-neutral-300 dark:border-white/10 rounded-l-xl">
                          agentedeseguros.website/
                        </span>
                        <Input
                          id="web_slug"
                          placeholder="tu-nombre-o-marca"
                          value={formData.web_slug}
                          onChange={(e) => setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          className="rounded-l-none rounded-r-xl"
                        />
                      </div>
                      {errors.web_slug && <p className="text-xs text-red-500 mt-1">{errors.web_slug}</p>}
                    </div>

                    <div className="border-t border-neutral-100 dark:border-white/10 pt-4 mt-6">
                      <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90 flex items-center gap-2 mb-3">
                        <CreditCard className="w-4 h-4 text-primary" />
                        Dispersión de Comisiones (Opcional)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="banco" className="text-xs font-semibold">Institución Bancaria</Label>
                          <Input
                            id="banco"
                            placeholder="Ej: BBVA, Santander, Banorte..."
                            value={formData.banco}
                            onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                            className="mt-1 rounded-xl"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clabe" className="text-xs font-semibold">Cuenta CLABE (18 dígitos)</Label>
                          <Input
                            id="clabe"
                            maxLength={18}
                            placeholder="012345678901234567"
                            value={formData.clabe}
                            onChange={(e) => setFormData({ ...formData, clabe: e.target.value.replace(/[^0-9]/g, '') })}
                            className={`mt-1 rounded-xl ${errors.clabe ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          />
                          {errors.clabe && <p className="text-xs text-red-500 mt-1">{errors.clabe}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-primary" />
                      Equipos de Trabajo Asignados (Opcional)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="equipo_computo" className="text-xs font-semibold flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-neutral-500" />
                          Equipo de Cómputo
                        </Label>
                        <Input
                          id="equipo_computo"
                          placeholder="Ej: Dell Latitude 5420 / Mac Mini M2"
                          value={formData.equipo_computo}
                          onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                          className="mt-1 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor="equipo_celular" className="text-xs font-semibold flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-neutral-500" />
                          Equipo Celular
                        </Label>
                        <Input
                          id="equipo_celular"
                          placeholder="Ej: iPhone 13 Pro / Samsung A54"
                          value={formData.equipo_celular}
                          onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                          className="mt-1 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Botonera Paso 3 */}
              <div className="flex justify-between items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  className="px-6 py-6 rounded-2xl text-base font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="px-8 py-6 rounded-2xl text-base font-semibold shadow-md flex items-center gap-2"
                >
                  Revisar Resumen
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PASO 4: RESUMEN Y CONFIRMACIÓN */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="p-6 md:p-8 rounded-3xl border-neutral-200/80 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                    4. Confirmación de Datos
                  </h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-white/60 mb-6">
                  Por favor revisa la información antes de enviar tu solicitud de registro.
                </p>

                {/* Pre-Credencial Digital */}
                <div className="bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900 text-white rounded-3xl p-6 shadow-xl border border-white/10 mb-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Foto de perfil"
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                        <User className="w-10 h-10 text-white/40" />
                      </div>
                    )}
                    
                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary text-white mb-1 shadow-sm">
                        {formData.rol === 'Empleado' ? 'COLABORADOR JIRO' : 'AGENTE DE SEGUROS'}
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">
                        {formData.nombre} {formData.apellidos}
                      </h3>
                      <p className="text-sm text-white/70">
                        {formData.rol === 'Empleado' ? formData.puesto : 'Asesor Profesional en Seguros'}
                      </p>
                      <p className="text-xs text-white/50 flex items-center justify-center sm:justify-start gap-1">
                        <Building2 className="w-3.5 h-3.5" /> {getNombreOficina(formData.oficina_id)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
                    <div>
                      <span className="text-white/50 block">Correo de Acceso:</span>
                      <span className="font-mono font-medium text-blue-300">{formData.email_laboral}</span>
                    </div>
                    <div>
                      <span className="text-white/50 block">Celular / WhatsApp:</span>
                      <span className="font-medium text-white/90">{formData.celular_laboral}</span>
                    </div>
                    <div>
                      <span className="text-white/50 block">Fecha de Ingreso:</span>
                      <span className="text-white/90">{formData.fecha_ingreso || 'No registrada'}</span>
                    </div>
                    {formData.rol === 'Agente' && formData.web_slug && (
                      <div>
                        <span className="text-white/50 block">Página Web:</span>
                        <span className="text-emerald-300 font-mono">agentedeseguros.website/{formData.web_slug}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center text-xs text-neutral-500 dark:text-white/50 space-y-1">
                  <p>Al hacer clic en "Enviar Registro", tu información se enviará a la Mesa de Control.</p>
                  <p>Recibirás un correo electrónico de confirmación una vez que tu cuenta sea validada.</p>
                </div>
              </Card>

              {/* Botonera Paso 4 */}
              <div className="flex justify-between items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="px-6 py-6 rounded-2xl text-base font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Modificar datos
                </Button>

                <Button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="px-10 py-6 rounded-2xl text-base font-bold shadow-xl flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Registrando usuario...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Confirmar y Enviar Registro
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
