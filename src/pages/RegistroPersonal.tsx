import { useState, useEffect } from 'react';
import { 
  UserPlus, Upload, Loader as Loader2, CircleAlert as AlertCircle, 
  CircleCheck as CheckCircle, Sparkles, ArrowRight, ArrowLeft, 
  Building2, Phone, Mail, User, Shield, Briefcase, Globe, 
  CreditCard, Laptop, Smartphone, RotateCcw, Check, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert } from '../components/ui/alert';
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

  useEffect(() => {
    cargarOficinas();
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.classList.add('public-page');
    return () => { if (root) root.classList.remove('public-page'); };
  }, []);

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
      console.error('Error cargando oficinas:', err);
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
      if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
      if (!formData.apellidos.trim()) newErrors.apellidos = 'Apellidos requeridos';
      if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'Fecha requerida';
      if (!formData.fecha_ingreso) newErrors.fecha_ingreso = 'Fecha requerida';
    }

    if (stepNumber === 2) {
      if (!formData.oficina_id) newErrors.oficina_id = 'Oficina requerida';

      if (!formData.email_laboral.trim()) {
        newErrors.email_laboral = 'Correo requerido';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_laboral)) {
        newErrors.email_laboral = 'Correo inválido';
      }

      if (!formData.celular_laboral.trim()) {
        newErrors.celular_laboral = 'Celular requerido';
      }

      if (formData.rol === 'Empleado') {
        if (!formData.puesto.trim()) newErrors.puesto = 'Puesto requerido';
      }
    }

    if (stepNumber === 3) {
      if (formData.web_slug && !/^[a-z0-9-]+$/.test(formData.web_slug)) {
        newErrors.web_slug = 'Solo minúsculas, números y guiones';
      }
      if (formData.clabe && formData.clabe.trim().length !== 18) {
        newErrors.clabe = 'La CLABE debe tener 18 dígitos';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    setError(null);
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    } else {
      setError('Completa los campos obligatorios para continuar.');
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
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
      setError('Hay campos obligatorios incompletos.');
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
    { number: 1, title: 'Perfil e Identidad', subtitle: 'Tipo de usuario y datos personales', icon: User },
    { number: 2, title: 'Ubicación y Contacto', subtitle: 'Sucursal, correo y celulares', icon: Phone },
    { number: 3, title: 'Personalización', subtitle: 'Fotografía y datos adicionales', icon: Sparkles },
    { number: 4, title: 'Confirmación Digital', subtitle: 'Resumen y envío a validación', icon: CheckCircle },
  ];

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-4">
        <Card className="max-w-md w-full p-8 text-center bg-surface-card border-white/10 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-500/30">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            ¡Registro Enviado!
          </h2>
          <p className="text-neutral-300 mb-6 text-sm leading-relaxed">
            Tu solicitud como <strong>{formData.rol === 'Empleado' ? 'Colaborador' : 'Agente'}</strong> fue recibida. Mesa de control activará tu cuenta en breve.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left mb-6 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">Nombre:</span>
              <span className="font-semibold text-white">{formData.nombre} {formData.apellidos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Acceso MOVI:</span>
              <span className="font-mono text-primary-light font-medium">{formData.email_laboral}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Sucursal:</span>
              <span className="text-neutral-200">{getNombreOficina(formData.oficina_id)}</span>
            </div>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="w-full py-5 text-sm font-bold rounded-2xl shadow-lg"
          >
            Nuevo Registro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-neutral-950 flex flex-col md:flex-row text-neutral-100 font-sans antialiased">
      
      {/* ========================================================================= */}
      {/* PANEL LATERAL FIJO (Desktop: 340px / 380px) */}
      {/* ========================================================================= */}
      <aside className="w-full md:w-[360px] lg:w-[400px] shrink-0 bg-neutral-900/95 border-b md:border-b-0 md:border-r border-white/10 p-6 md:p-8 flex flex-col justify-between relative z-10 backdrop-blur-xl">
        <div>
          {/* Logos */}
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <img
              src="/logojiro.png"
              alt="JIRO y Asociados"
              className="h-9 md:h-10 object-contain brightness-0 invert"
            />
            <div className="h-6 w-px bg-white/20"></div>
            <img
              src="/movirecurso_1.png"
              alt="MOVI Digital"
              className="h-8 md:h-9 object-contain"
            />
          </div>

          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/20 text-primary-light border border-primary/30 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Portal de Pre-Registro JIRO</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Alta de Personal
            </h1>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Completa los 4 pasos interactivos para generar tu ficha y acceso digital a MOVI.
            </p>
          </div>

          {/* Stepper Vertical (Desktop) */}
          <nav className="space-y-3 hidden md:block">
            {stepsMeta.map((s) => {
              const isPassed = currentStep > s.number;
              const isCurrent = currentStep === s.number;
              const Icon = s.icon;
              return (
                <div
                  key={s.number}
                  className={`flex items-start gap-3.5 p-3 rounded-2xl transition-all duration-300 relative ${
                    isCurrent
                      ? 'bg-white/10 border border-white/15 shadow-sm'
                      : isPassed
                      ? 'opacity-85 hover:opacity-100'
                      : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-transform ${
                      isPassed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-white ring-2 ring-primary/40 scale-105'
                        : 'bg-white/10 text-neutral-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold leading-tight ${isCurrent ? 'text-white' : 'text-neutral-300'}`}>
                      {s.number}. {s.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {s.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
          {draftRestored ? (
            <div className="flex items-center gap-1.5 text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Borrador activo</span>
            </div>
          ) : (
            <span>Paso {currentStep} de 4</span>
          )}

          <button
            type="button"
            onClick={limpiarBorrador}
            className="flex items-center gap-1 text-neutral-400 hover:text-white transition hover:underline"
            title="Reiniciar y borrar datos guardados"
          >
            <RotateCcw className="w-3 h-3" /> Reiniciar
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* CONTENIDO PRINCIPAL (Desktop: Full Height Scrollable Content) */}
      {/* ========================================================================= */}
      <main className="flex-1 md:h-screen md:overflow-y-auto bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 p-4 sm:p-6 lg:p-10 flex flex-col justify-between relative">
        
        {/* Barra superior de progreso móvil */}
        <div className="md:hidden mb-4">
          <div className="flex items-center justify-between text-xs font-bold mb-2 text-neutral-300">
            <span>Paso {currentStep}: {stepsMeta[currentStep - 1].title}</span>
            <span className="text-primary font-mono">{Math.round((currentStep / 4) * 100)}%</span>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Contenedor del Formulario Activo */}
        <div className="max-w-2xl mx-auto w-full my-auto py-2">
          
          {error && (
            <Alert variant="destructive" className="mb-5 rounded-2xl bg-red-950/40 border-red-800 text-red-200 text-xs shadow-md animate-in fade-in">
              <AlertCircle className="w-4 h-4" />
              <div className="ml-2 font-medium">{error}</div>
            </Alert>
          )}

          <form id="registro-wizard-form" onSubmit={handleSubmit}>

            {/* ========================================================================= */}
            {/* PASO 1: PERFIL E IDENTIDAD */}
            {/* ========================================================================= */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
                  <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Selecciona tu perfil en JIRO
                  </h2>
                  <p className="text-xs text-neutral-400 mb-4">
                    Elige si te registras como colaborador interno o agente de seguros.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
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
                          className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                              : 'border-white/10 hover:border-white/20 bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-white/10 text-neutral-400'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-white">{item.label}</p>
                                <p className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</p>
                              </div>
                            </div>
                            {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-white/10 pt-5 space-y-4">
                    <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                      Datos Personales
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <Label htmlFor="nombre" className="text-xs font-medium text-neutral-300">Nombre(s) *</Label>
                        <Input
                          id="nombre"
                          placeholder="Ej: Juan Carlos"
                          value={formData.nombre}
                          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                          className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.nombre ? 'border-red-500' : ''}`}
                        />
                        {errors.nombre && <p className="text-[11px] text-red-400 mt-1">{errors.nombre}</p>}
                      </div>

                      <div>
                        <Label htmlFor="apellidos" className="text-xs font-medium text-neutral-300">Apellidos *</Label>
                        <Input
                          id="apellidos"
                          placeholder="Ej: Pérez García"
                          value={formData.apellidos}
                          onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                          className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.apellidos ? 'border-red-500' : ''}`}
                        />
                        {errors.apellidos && <p className="text-[11px] text-red-400 mt-1">{errors.apellidos}</p>}
                      </div>

                      <div>
                        <Label htmlFor="fecha_nacimiento" className="text-xs font-medium text-neutral-300">Fecha de Nacimiento *</Label>
                        <Input
                          id="fecha_nacimiento"
                          type="date"
                          value={formData.fecha_nacimiento}
                          onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                          className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.fecha_nacimiento ? 'border-red-500' : ''}`}
                        />
                        {errors.fecha_nacimiento && <p className="text-[11px] text-red-400 mt-1">{errors.fecha_nacimiento}</p>}
                      </div>

                      <div>
                        <Label htmlFor="fecha_ingreso" className="text-xs font-medium text-neutral-300">Fecha de Ingreso a JIRO *</Label>
                        <Input
                          id="fecha_ingreso"
                          type="date"
                          value={formData.fecha_ingreso}
                          onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                          className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.fecha_ingreso ? 'border-red-500' : ''}`}
                        />
                        {errors.fecha_ingreso && <p className="text-[11px] text-red-400 mt-1">{errors.fecha_ingreso}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PASO 2: CONTACTO Y UBICACIÓN */}
            {/* ========================================================================= */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
                  <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    Ubicación y Contacto
                  </h2>
                  <p className="text-xs text-neutral-400 mb-5">
                    Sucursal asignada y canales principales de comunicación.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <Label htmlFor="oficina_id" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        Sucursal JIRO *
                      </Label>
                      <Select
                        value={formData.oficina_id}
                        onValueChange={(value) => setFormData({ ...formData, oficina_id: value })}
                      >
                        <SelectTrigger className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.oficina_id ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Selecciona una sucursal" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-white/15 text-white rounded-xl">
                          {oficinas.map((oficina) => (
                            <SelectItem key={oficina.id} value={oficina.id}>
                              {oficina.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.oficina_id && <p className="text-[11px] text-red-400 mt-1">{errors.oficina_id}</p>}
                    </div>

                    {formData.rol === 'Empleado' ? (
                      <div>
                        <Label htmlFor="puesto" className="text-xs font-medium text-neutral-300">Puesto *</Label>
                        <Input
                          id="puesto"
                          placeholder="Ej: Ejecutivo de Cuenta, Mesa de Control..."
                          value={formData.puesto}
                          onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                          className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.puesto ? 'border-red-500' : ''}`}
                        />
                        {errors.puesto && <p className="text-[11px] text-red-400 mt-1">{errors.puesto}</p>}
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="cedula_cnsf" className="text-xs font-medium text-neutral-300">Cédula CNSF (Opcional)</Label>
                        <Input
                          id="cedula_cnsf"
                          placeholder="Ej: A1234567"
                          value={formData.cedula_cnsf}
                          onChange={(e) => setFormData({ ...formData, cedula_cnsf: e.target.value })}
                          className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="email_laboral" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        E-Mail (Acceso a MOVI) *
                      </Label>
                      <Input
                        id="email_laboral"
                        type="email"
                        placeholder={formData.rol === 'Empleado' ? 'nombre.apellido@jiro.mx' : 'tu.correo@ejemplo.com'}
                        value={formData.email_laboral}
                        onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                        className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.email_laboral ? 'border-red-500' : ''}`}
                      />
                      {errors.email_laboral && <p className="text-[11px] text-red-400 mt-1">{errors.email_laboral}</p>}
                    </div>

                    <div>
                      <Label htmlFor="celular_laboral" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        {formData.rol === 'Empleado' ? 'Celular Laboral (Línea JIRO) *' : 'Celular Laboral / WhatsApp *'}
                      </Label>
                      <Input
                        id="celular_laboral"
                        type="tel"
                        placeholder="10 dígitos (ej: 4491234567)"
                        value={formData.celular_laboral}
                        onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                        className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.celular_laboral ? 'border-red-500' : ''}`}
                      />
                      {errors.celular_laboral && <p className="text-[11px] text-red-400 mt-1">{errors.celular_laboral}</p>}
                    </div>

                    <div>
                      <Label htmlFor="extension_telefonica" className="text-xs font-medium text-neutral-300">Extensión / Teléfono Fijo</Label>
                      <Input
                        id="extension_telefonica"
                        placeholder="Ej: Ext. 104 o teléfono directo"
                        value={formData.extension_telefonica}
                        onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                        className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="celular_personal" className="text-xs font-medium text-neutral-300">Celular Personal (Opcional)</Label>
                      <Input
                        id="celular_personal"
                        type="tel"
                        placeholder="Móvil secundario"
                        value={formData.celular_personal}
                        onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                        className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PASO 3: PERSONALIZACIÓN Y FOTO */}
            {/* ========================================================================= */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
                  <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Fotografía y Datos Opcionales
                  </h2>
                  <p className="text-xs text-neutral-400 mb-5">
                    Sube tu fotografía y personaliza tus herramientas adicionales.
                  </p>

                  {/* Foto de Perfil */}
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-4 mb-5 flex flex-col sm:flex-row items-center gap-4">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-primary shadow-md"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full shadow">
                          <Check className="w-3 h-3" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border-2 border-dashed border-white/20">
                        <UserPlus className="w-7 h-7 text-neutral-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 text-center sm:text-left">
                      <Label htmlFor="imagen_perfil" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl transition text-xs font-bold inline-flex shadow-sm">
                          <Upload className="w-3.5 h-3.5" />
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
                        <p className="text-[11px] text-emerald-400 font-semibold mt-1.5 flex items-center justify-center sm:justify-start gap-1">
                          <CheckCircle className="w-3 h-3" /> {imageInfo}
                        </p>
                      ) : (
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Se comprime y centra automáticamente al subir (JPG, PNG, WebP).
                        </p>
                      )}
                    </div>
                  </div>

                  {uploadingImage && (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse mb-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Optimizando y guardando imagen...
                    </div>
                  )}

                  {/* Datos Opcionales según rol */}
                  {formData.rol === 'Agente' ? (
                    <div className="space-y-4 pt-1">
                      <div>
                        <Label htmlFor="web_slug" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-primary" />
                          Slug de Página Web Pública (Opcional)
                        </Label>
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-2.5 py-2 text-xs text-neutral-400 bg-white/5 border border-r-0 border-white/10 rounded-l-xl">
                            agentedeseguros.website/
                          </span>
                          <Input
                            id="web_slug"
                            placeholder="tu-nombre"
                            value={formData.web_slug}
                            onChange={(e) => setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            className="bg-white/5 border-white/10 text-white rounded-l-none rounded-r-xl text-sm"
                          />
                        </div>
                        {errors.web_slug && <p className="text-[11px] text-red-400 mt-1">{errors.web_slug}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                        <div>
                          <Label htmlFor="banco" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-primary" />
                            Banco (Comisiones)
                          </Label>
                          <Input
                            id="banco"
                            placeholder="Ej: BBVA, Banorte..."
                            value={formData.banco}
                            onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                            className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clabe" className="text-xs font-medium text-neutral-300">Cuenta CLABE (18 dígitos)</Label>
                          <Input
                            id="clabe"
                            maxLength={18}
                            placeholder="012345678901234567"
                            value={formData.clabe}
                            onChange={(e) => setFormData({ ...formData, clabe: e.target.value.replace(/[^0-9]/g, '') })}
                            className={`mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm ${errors.clabe ? 'border-red-500' : ''}`}
                          />
                          {errors.clabe && <p className="text-[11px] text-red-400 mt-1">{errors.clabe}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div>
                        <Label htmlFor="equipo_computo" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-neutral-400" />
                          Equipo de Cómputo (Opcional)
                        </Label>
                        <Input
                          id="equipo_computo"
                          placeholder="Ej: Dell Latitude / Mac Mini"
                          value={formData.equipo_computo}
                          onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                          className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="equipo_celular" className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                          Equipo Celular (Opcional)
                        </Label>
                        <Input
                          id="equipo_celular"
                          placeholder="Ej: iPhone 13 / Galaxy A54"
                          value={formData.equipo_celular}
                          onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                          className="mt-1 bg-white/5 border-white/10 text-white rounded-xl text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PASO 4: CONFIRMACIÓN Y RESUMEN */}
            {/* ========================================================================= */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
                  <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    Revisión de Pre-Credencial
                  </h2>
                  <p className="text-xs text-neutral-400 mb-5">
                    Confirma tus datos antes de enviar tu registro a validación.
                  </p>

                  <div className="bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-white/15 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Foto de perfil"
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/50 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                          <User className="w-8 h-8 text-neutral-400" />
                        </div>
                      )}
                      
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white mb-1">
                          {formData.rol === 'Empleado' ? 'COLABORADOR JIRO' : 'AGENTE DE SEGUROS'}
                        </span>
                        <h3 className="text-xl font-extrabold text-white truncate">
                          {formData.nombre} {formData.apellidos}
                        </h3>
                        <p className="text-xs text-neutral-300">
                          {formData.rol === 'Empleado' ? formData.puesto : 'Asesor en Seguros'}
                        </p>
                        <p className="text-xs text-neutral-400 flex items-center justify-center sm:justify-start gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-primary" /> {getNombreOficina(formData.oficina_id)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Correo de Acceso:</span>
                        <span className="font-mono text-primary-light font-medium">{formData.email_laboral}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Celular / WhatsApp:</span>
                        <span className="text-neutral-200">{formData.celular_laboral}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Ingreso a JIRO:</span>
                        <span className="text-neutral-200">{formData.fecha_ingreso || 'N/A'}</span>
                      </div>
                      {formData.rol === 'Agente' && formData.web_slug && (
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Página Web:</span>
                          <span className="text-emerald-400 font-mono">agentedeseguros.website/{formData.web_slug}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* BOTONERA INFERIOR FIJA / RESPONSIVA */}
            {/* ========================================================================= */}
            <div className="mt-6 flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="px-5 py-5 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Atrás
                </Button>
              ) : (
                <div></div>
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="px-7 py-5 rounded-2xl text-xs font-bold shadow-lg flex items-center gap-2"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="px-8 py-5 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Confirmar y Enviar Registro
                    </>
                  )}
                </Button>
              )}
            </div>

          </form>
        </div>

        {/* Footer discreto */}
        <div className="text-center text-[11px] text-neutral-500 mt-3">
          MOVI Digital & Grupo JIRO © {new Date().getFullYear()} — Plataforma de Gestión de Seguros
        </div>
      </main>

    </div>
  );
}
