import { useState, useEffect } from 'react';
import { 
  UserPlus, Upload, Loader as Loader2, CircleAlert as AlertCircle, 
  CircleCheck as CheckCircle, Sparkles, ArrowRight, ArrowLeft, 
  Building2, Phone, Mail, User, Shield, Briefcase, Globe, 
  CreditCard, Laptop, Smartphone, RotateCcw, Check, CheckCircle2
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
      setError('El archivo seleccionado debe ser una imagen');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);
      setImageInfo('Optimizando...');

      const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      const { file: optimizedFile, dataUrl, sizeBytes } = await optimizarImagenAvatar(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        squareCrop: true,
      });

      setImagePreview(dataUrl);
      const optimizedSizeKB = (sizeBytes / 1024).toFixed(0);
      setImageInfo(`${originalSizeMB}MB ➔ ${optimizedSizeKB}KB`);

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
      console.error('Error al optimizar imagen:', err);
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
      if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'Fecha de nacimiento obligatoria';
      if (!formData.fecha_ingreso) newErrors.fecha_ingreso = 'Fecha de ingreso obligatoria';
    }

    if (stepNumber === 2) {
      if (!formData.oficina_id) newErrors.oficina_id = 'La oficina es obligatoria';

      if (!formData.email_laboral.trim()) {
        newErrors.email_laboral = 'El correo electrónico es obligatorio';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_laboral)) {
        newErrors.email_laboral = 'El correo electrónico no es válido';
      }

      if (!formData.celular_laboral.trim()) {
        newErrors.celular_laboral = 'El celular laboral / WhatsApp es obligatorio';
      }

      if (formData.rol === 'Empleado') {
        if (!formData.puesto.trim()) newErrors.puesto = 'El puesto es obligatorio';
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
      setError('Por favor completa los campos obligatorios antes de continuar');
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const generarContraseñaSegura = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let res = '';
    for (let i = 0; i < 16; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setError('Hay campos obligatorios pendientes.');
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
    { number: 1, title: 'Perfil e Identidad', subtitle: 'Tipo de cuenta y datos', icon: User },
    { number: 2, title: 'Contacto y Sucursal', subtitle: 'Oficina, líneas y email', icon: Phone },
    { number: 3, title: 'Personalización', subtitle: 'Fotografía y adicionales', icon: Sparkles },
    { number: 4, title: 'Confirmación', subtitle: 'Revisión final', icon: CheckCircle2 },
  ];

  if (success) {
    return (
      <div className="min-h-screen lg:h-screen flex items-center justify-center bg-gradient-to-br from-[#0B132B] via-[#0D1B2A] to-[#1C2541] p-4 text-white">
        <Card className="max-w-md w-full p-8 text-center shadow-2xl bg-[#0F1E36]/90 border-blue-500/20 rounded-3xl animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-blue-500/20 border border-blue-400/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CheckCircle className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ¡Registro Enviado!
          </h2>
          <p className="text-blue-100/75 mb-5 text-sm leading-relaxed">
            Tu solicitud como <strong>{formData.rol === 'Empleado' ? 'Colaborador' : 'Agente'}</strong> fue enviada con éxito a la Mesa de Control.
          </p>
          <div className="bg-[#0A1628]/80 border border-blue-500/20 rounded-2xl p-4 text-left mb-5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-blue-300/60">Nombre:</span>
              <span className="font-semibold text-white">{formData.nombre} {formData.apellidos}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300/60">E-Mail Acceso:</span>
              <span className="font-mono font-medium text-blue-300">{formData.email_laboral}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300/60">Sucursal:</span>
              <span className="text-white/90">{getNombreOficina(formData.oficina_id)}</span>
            </div>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="w-full py-5 rounded-2xl font-semibold shadow-md bg-primary hover:bg-primary-hover text-white"
          >
            Nuevo registro
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-gradient-to-br from-[#0B132B] via-[#0D1B2A] to-[#14213D] text-white flex flex-col justify-between p-3 md:p-6 lg:p-8">
      
      {/* Contenedor Principal One-Full-Page en Desktop con tonalidades Azul Oscuro Midnight */}
      <div className="w-full max-w-6xl mx-auto h-full flex flex-col lg:flex-row gap-6 items-stretch justify-center">
        
        {/* ========================================================================= */}
        {/* SIDEBAR LATERAL IZQUIERDA (Azul Oscuro Elegante) */}
        {/* ========================================================================= */}
        <div className="lg:w-80 shrink-0 bg-[#0F1E36]/80 backdrop-blur-md rounded-3xl border border-blue-500/20 shadow-xl p-6 flex flex-col justify-between">
          <div>
            {/* Logos */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-blue-500/15">
              <img
                src="/logojiro.png"
                alt="JIRO y Asociados"
                className="h-9 object-contain brightness-110 filter drop-shadow"
              />
              <div className="h-6 w-px bg-blue-400/20"></div>
              <img
                src="/movirecurso_1.png"
                alt="MOVI Digital"
                className="h-8 object-contain brightness-110 filter drop-shadow"
              />
            </div>

            {/* Título de Sección */}
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Portal Oficial</span>
              <h1 className="text-xl font-bold text-white mt-0.5">Pre-Registro</h1>
              <p className="text-xs text-blue-200/60">Colaboradores y Agentes</p>
            </div>

            {/* Stepper Vertical */}
            <div className="space-y-2">
              {stepsMeta.map((s) => {
                const isPassed = currentStep > s.number;
                const isCurrent = currentStep === s.number;
                const Icon = s.icon;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => {
                      if (isPassed) setCurrentStep(s.number);
                    }}
                    disabled={!isPassed && !isCurrent}
                    className={`w-full text-left rounded-2xl p-3 transition-all flex items-center gap-3.5 ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-400/40'
                        : isPassed
                        ? 'bg-blue-900/30 text-blue-200 hover:bg-blue-900/50 border border-blue-500/20'
                        : 'text-blue-200/30 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : isPassed
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-950/40 text-blue-400/50'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : s.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : ''}`}>
                        {s.title}
                      </p>
                      <p className={`text-[10px] truncate ${isCurrent ? 'text-white/80' : 'text-blue-300/40'}`}>
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer del sidebar: Borrador & Info */}
          <div className="pt-4 border-t border-blue-500/15 mt-6 text-xs text-blue-200/60 space-y-2">
            {draftRestored && (
              <div className="flex items-center justify-between text-[11px] text-blue-300 bg-blue-950/40 border border-blue-500/20 p-2 rounded-xl">
                <span className="flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3 text-blue-400" /> Progreso guardado</span>
                <button
                  type="button"
                  onClick={limpiarBorrador}
                  className="hover:underline font-bold text-blue-300"
                  title="Reiniciar formulario"
                >
                  Reiniciar
                </button>
              </div>
            )}
            <p className="text-[11px] text-blue-300/40 text-center">
              JIRO y Asociados &bull; MOVI Digital
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANEL PRINCIPAL DERECHO (Azul Medianoche Profundo) */}
        {/* ========================================================================= */}
        <div className="flex-1 bg-[#0F1E36]/90 backdrop-blur-md rounded-3xl border border-blue-500/20 shadow-xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-full">
          
          <form id="registro-form" onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
            <div>
              {/* Notificación de Error */}
              {error && (
                <Alert variant="destructive" className="mb-4 rounded-2xl py-2.5 shadow-sm text-xs bg-red-950/50 border-red-500/40 text-red-200 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <div className="ml-2 font-medium">{error}</div>
                </Alert>
              )}

              {/* ========================================================================= */}
              {/* PASO 1: IDENTIDAD Y TIPO DE PERFIL */}
              {/* ========================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-blue-500/15 pb-3 mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-400" />
                      1. Identidad y Tipo de Perfil
                    </h2>
                    <p className="text-xs text-blue-200/60">Selecciona el tipo de cuenta y completa tus datos generales.</p>
                  </div>

                  {/* Selector de Perfil Compacto */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { key: 'Empleado' as RolRegistro, label: 'Colaborador', desc: 'Personal interno JIRO', icon: Briefcase },
                      { key: 'Agente' as RolRegistro, label: 'Agente', desc: 'Agente de seguros y fianzas', icon: Shield },
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
                          className={`rounded-2xl border-2 p-3.5 text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600/20 shadow-md ring-1 ring-blue-400/40'
                              : 'border-blue-500/20 hover:border-blue-400/40 bg-[#0A1628]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-950/60 text-blue-300'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-white truncate">{item.label}</p>
                              <p className="text-[10px] text-blue-200/60 truncate">{item.desc}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Campos de Identidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <Label htmlFor="nombre" className="text-xs font-semibold text-blue-100">Nombre(s) *</Label>
                      <Input
                        id="nombre"
                        placeholder="Ej: Juan Carlos"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.nombre ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.nombre && <p className="text-[10px] text-red-400 mt-0.5">{errors.nombre}</p>}
                    </div>

                    <div>
                      <Label htmlFor="apellidos" className="text-xs font-semibold text-blue-100">Apellidos *</Label>
                      <Input
                        id="apellidos"
                        placeholder="Ej: Pérez García"
                        value={formData.apellidos}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.apellidos ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.apellidos && <p className="text-[10px] text-red-400 mt-0.5">{errors.apellidos}</p>}
                    </div>

                    <div>
                      <Label htmlFor="fecha_nacimiento" className="text-xs font-semibold text-blue-100">Fecha de Nacimiento *</Label>
                      <Input
                        id="fecha_nacimiento"
                        type="date"
                        value={formData.fecha_nacimiento}
                        onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white ${errors.fecha_nacimiento ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.fecha_nacimiento && <p className="text-[10px] text-red-400 mt-0.5">{errors.fecha_nacimiento}</p>}
                    </div>

                    <div>
                      <Label htmlFor="fecha_ingreso" className="text-xs font-semibold text-blue-100">Fecha de Ingreso a JIRO *</Label>
                      <Input
                        id="fecha_ingreso"
                        type="date"
                        value={formData.fecha_ingreso}
                        onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white ${errors.fecha_ingreso ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.fecha_ingreso && <p className="text-[10px] text-red-400 mt-0.5">{errors.fecha_ingreso}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* PASO 2: CONTACTO Y OFICINA */}
              {/* ========================================================================= */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-blue-500/15 pb-3 mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-400" />
                      2. Ubicación y Datos de Contacto
                    </h2>
                    <p className="text-xs text-blue-200/60">Indica tu sucursal y canales directos de contacto.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <Label htmlFor="oficina_id" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        Sucursal / Oficina JIRO *
                      </Label>
                      <Select
                        value={formData.oficina_id}
                        onValueChange={(value) => setFormData({ ...formData, oficina_id: value })}
                      >
                        <SelectTrigger className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white ${errors.oficina_id ? 'border-red-500 ring-1 ring-red-500' : ''}`}>
                          <SelectValue placeholder="Selecciona una oficina" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl bg-[#0F1E36] border-blue-500/30 text-white">
                          {oficinas.map((oficina) => (
                            <SelectItem key={oficina.id} value={oficina.id} className="text-xs text-white hover:bg-blue-600/30">
                              {oficina.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.oficina_id && <p className="text-[10px] text-red-400 mt-0.5">{errors.oficina_id}</p>}
                    </div>

                    {formData.rol === 'Empleado' ? (
                      <div>
                        <Label htmlFor="puesto" className="text-xs font-semibold text-blue-100">Puesto en JIRO *</Label>
                        <Input
                          id="puesto"
                          placeholder="Ej: Ejecutivo de Cuenta, Mesa de Control..."
                          value={formData.puesto}
                          onChange={(e) => setFormData({ ...formData, puesto: e.target.value })}
                          className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.puesto ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                        />
                        {errors.puesto && <p className="text-[10px] text-red-400 mt-0.5">{errors.puesto}</p>}
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="cedula_cnsf" className="text-xs font-semibold text-blue-100">Cédula CNSF (Opcional)</Label>
                        <Input
                          id="cedula_cnsf"
                          placeholder="Ej: A1234567"
                          value={formData.cedula_cnsf}
                          onChange={(e) => setFormData({ ...formData, cedula_cnsf: e.target.value })}
                          className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="email_laboral" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        E-Mail (Acceso a MOVI) *
                      </Label>
                      <Input
                        id="email_laboral"
                        type="email"
                        placeholder={formData.rol === 'Empleado' ? 'nombre.apellido@jiro.mx' : 'tu.correo@ejemplo.com'}
                        value={formData.email_laboral}
                        onChange={(e) => setFormData({ ...formData, email_laboral: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.email_laboral ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.email_laboral && <p className="text-[10px] text-red-400 mt-0.5">{errors.email_laboral}</p>}
                    </div>

                    <div>
                      <Label htmlFor="celular_laboral" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        Celular / WhatsApp *
                      </Label>
                      <Input
                        id="celular_laboral"
                        type="tel"
                        placeholder="10 dígitos (ej: 4491234567)"
                        value={formData.celular_laboral}
                        onChange={(e) => setFormData({ ...formData, celular_laboral: e.target.value })}
                        className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.celular_laboral ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.celular_laboral && <p className="text-[10px] text-red-400 mt-0.5">{errors.celular_laboral}</p>}
                    </div>

                    <div>
                      <Label htmlFor="extension_telefonica" className="text-xs font-semibold text-blue-100">Extensión / Teléfono Fijo</Label>
                      <Input
                        id="extension_telefonica"
                        placeholder="Ej: Ext. 104 o teléfono directo"
                        value={formData.extension_telefonica}
                        onChange={(e) => setFormData({ ...formData, extension_telefonica: e.target.value })}
                        className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                      />
                    </div>

                    <div>
                      <Label htmlFor="celular_personal" className="text-xs font-semibold text-blue-100">Celular Personal (Opcional)</Label>
                      <Input
                        id="celular_personal"
                        type="tel"
                        placeholder="Teléfono móvil adicional"
                        value={formData.celular_personal}
                        onChange={(e) => setFormData({ ...formData, celular_personal: e.target.value })}
                        className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* PASO 3: FOTO Y ADICIONALES */}
              {/* ========================================================================= */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-blue-500/15 pb-3 mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      3. Foto de Perfil & Datos Opcionales
                    </h2>
                    <p className="text-xs text-blue-200/60">Optimización de imagen y personalizaciones adicionales.</p>
                  </div>

                  {/* Foto con Compresión */}
                  <div className="bg-[#0A1628]/70 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative group shrink-0">
                        <img
                          src={imagePreview}
                          alt="Avatar"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-blue-400 shadow-md"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-0.5 rounded-full shadow">
                          <Check className="w-3 h-3" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-blue-950/50 flex items-center justify-center border border-dashed border-blue-400/30 shrink-0">
                        <UserPlus className="w-6 h-6 text-blue-300/50" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <Label htmlFor="imagen_perfil" className="cursor-pointer">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-sm inline-flex text-xs font-semibold">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{imagePreview ? 'Cambiar foto' : 'Subir fotografía'}</span>
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
                        <p className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> {imageInfo}
                        </p>
                      ) : (
                        <p className="text-[11px] text-blue-200/50 mt-1 truncate">
                          La imagen se recorta 1:1 y se comprime automáticamente.
                        </p>
                      )}
                    </div>

                    {uploadingImage && (
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                    )}
                  </div>

                  {/* Campos Opcionales según Rol */}
                  {formData.rol === 'Agente' ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <Label htmlFor="web_slug" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-blue-400" />
                          Slug para Sitio Web Personal (Opcional)
                        </Label>
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-2.5 py-2 text-[11px] text-blue-300 bg-blue-950/60 border border-r-0 border-blue-500/25 rounded-l-xl h-10">
                            agentedeseguros.website/
                          </span>
                          <Input
                            id="web_slug"
                            placeholder="tu-nombre"
                            value={formData.web_slug}
                            onChange={(e) => setFormData({ ...formData, web_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            className="rounded-l-none rounded-r-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                          />
                        </div>
                        {errors.web_slug && <p className="text-[10px] text-red-400 mt-0.5">{errors.web_slug}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <Label htmlFor="banco" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                            Banco (Comisiones)
                          </Label>
                          <Input
                            id="banco"
                            placeholder="Ej: BBVA, Banorte..."
                            value={formData.banco}
                            onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                            className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                          />
                        </div>
                        <div>
                          <Label htmlFor="clabe" className="text-xs font-semibold text-blue-100">Cuenta CLABE (18 dígitos)</Label>
                          <Input
                            id="clabe"
                            maxLength={18}
                            placeholder="012345678901234567"
                            value={formData.clabe}
                            onChange={(e) => setFormData({ ...formData, clabe: e.target.value.replace(/[^0-9]/g, '') })}
                            className={`mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30 ${errors.clabe ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          />
                          {errors.clabe && <p className="text-[10px] text-red-400 mt-0.5">{errors.clabe}</p>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label htmlFor="equipo_computo" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                          <Laptop className="w-3.5 h-3.5 text-blue-400" />
                          Equipo de Cómputo (Opcional)
                        </Label>
                        <Input
                          id="equipo_computo"
                          placeholder="Ej: Dell Latitude / Mac Mini"
                          value={formData.equipo_computo}
                          onChange={(e) => setFormData({ ...formData, equipo_computo: e.target.value })}
                          className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                        />
                      </div>
                      <div>
                        <Label htmlFor="equipo_celular" className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                          Equipo Celular (Opcional)
                        </Label>
                        <Input
                          id="equipo_celular"
                          placeholder="Ej: iPhone 13 Pro / Samsung A54"
                          value={formData.equipo_celular}
                          onChange={(e) => setFormData({ ...formData, equipo_celular: e.target.value })}
                          className="mt-1 rounded-xl h-10 text-xs bg-[#0A1628]/80 border-blue-500/25 text-white placeholder:text-blue-300/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* PASO 4: CONFIRMACIÓN Y PRE-CREDENCIAL */}
              {/* ========================================================================= */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-blue-500/15 pb-3 mb-3">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      4. Revisión y Confirmación
                    </h2>
                    <p className="text-xs text-blue-200/60">Verifica que tus datos sean correctos antes de enviar.</p>
                  </div>

                  {/* Pre-Credencial Azul Medianoche */}
                  <div className="bg-gradient-to-br from-[#0B1930] via-[#0E2442] to-[#0A1628] text-white rounded-2xl p-4 shadow-xl border border-blue-500/30">
                    <div className="flex items-center gap-4">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Avatar"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-blue-400 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-blue-950/60 flex items-center justify-center border border-blue-400/30 shrink-0">
                          <User className="w-7 h-7 text-blue-300/50" />
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white mb-1 shadow-sm">
                          {formData.rol === 'Empleado' ? 'COLABORADOR JIRO' : 'AGENTE DE SEGUROS'}
                        </span>
                        <h3 className="text-base font-bold truncate">
                          {formData.nombre} {formData.apellidos}
                        </h3>
                        <p className="text-xs text-blue-200/80 truncate">
                          {formData.rol === 'Empleado' ? formData.puesto : 'Asesor Profesional en Seguros'}
                        </p>
                        <p className="text-[11px] text-blue-300/60 flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-blue-400" /> {getNombreOficina(formData.oficina_id)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-blue-500/20 text-[11px]">
                      <div>
                        <span className="text-blue-300/50 block text-[10px]">Correo de Acceso:</span>
                        <span className="font-mono text-blue-300 font-medium truncate block">{formData.email_laboral}</span>
                      </div>
                      <div>
                        <span className="text-blue-300/50 block text-[10px]">Celular / WhatsApp:</span>
                        <span className="text-white/90 truncate block">{formData.celular_laboral}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* BOTONES DE NAVEGACIÓN INFERIORES */}
            {/* ========================================================================= */}
            <div className="border-t border-blue-500/15 pt-4 mt-6 flex justify-between items-center gap-3">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border-blue-500/30 text-blue-200 hover:bg-blue-600/20 bg-transparent"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Atrás
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="px-8 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Confirmar Registro
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
