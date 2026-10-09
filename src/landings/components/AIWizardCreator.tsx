import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Globe,
  Users,
  Palette,
  LayoutGrid,
  Loader2,
  CheckCircle2,
  X
} from 'lucide-react';
import type { UnifiedLanding, Block } from '../types';

interface AIWizardCreatorProps {
  onClose: () => void;
  onCreated: (landing: UnifiedLanding) => void;
}

const TONES = [
  { id: 'profesional', label: 'Profesional', desc: 'Formal, confiable y corporativo' },
  { id: 'cercano', label: 'Cercano & Humano', desc: 'Amigable, empático y directo' },
  { id: 'premium', label: 'Premium & Elegante', desc: 'Exclusivo, de alta gama' },
  { id: 'moderno', label: 'Tech & Innovador', desc: 'Dinámico, ágil y moderno' },
];

const SECTION_OPTIONS = [
  { id: 'hero', label: 'Hero Principal con CTA', default: true },
  { id: 'features', label: 'Beneficios & Ventajas (Grid)', default: true },
  { id: 'pricing', label: 'Planes & Precios', default: true },
  { id: 'testimonials', label: 'Testimonios & Prueba Social', default: true },
  { id: 'faq', label: 'Preguntas Frecuentes', default: true },
  { id: 'contact', label: 'Formulario de Cotización', default: true },
];

export function AIWizardCreator({ onClose, onCreated }: AIWizardCreatorProps) {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Salud & Gastos Médicos');
  const [businessDesc, setBusinessDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState('cercano');
  const [primaryColor, setPrimaryColor] = useState('#F97316');
  const [secondaryColor, setSecondaryColor] = useState('#7E3AF2');
  const [selectedSections, setSelectedSections] = useState<string[]>(['hero', 'features', 'pricing', 'testimonials', 'faq', 'contact']);

  const handleSlugify = (val: string) => {
    setName(val);
    if (!slug) {
      setSlug('/' + val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const toggleSection = (id: string) => {
    if (selectedSections.includes(id)) {
      setSelectedSections(selectedSections.filter((s) => s !== id));
    } else {
      setSelectedSections([...selectedSections, id]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    let cleanSlug = slug.trim();
    if (!cleanSlug.startsWith('/')) cleanSlug = '/' + cleanSlug;

    const generatedBlocks: Block[] = [];

    // 1. Hero
    if (selectedSections.includes('hero')) {
      generatedBlocks.push({
        id: 'hero-' + Date.now(),
        type: 'hero',
        data: {
          eyebrow: '★ Solución Inteligente 2026',
          title: name || 'Protección y Cobertura Integral',
          subtitle: businessDesc || 'Accede a la mejor atención personalizada con respaldo garantizado.',
          primaryButtonText: 'Cotizar Ahora',
          primaryButtonUrl: '#contacto',
          align: 'center'
        }
      });
    }

    // 2. Features
    if (selectedSections.includes('features')) {
      generatedBlocks.push({
        id: 'feat-' + Date.now(),
        type: 'feature_grid',
        data: {
          eyebrow: 'Ventajas Competitivas',
          title: '¿Por qué elegir ' + name + '?',
          subtitle: 'Diseñado específicamente para ' + (targetAudience || 'familias y profesionistas'),
          columns: 3,
          items: [
            { title: 'Atención Inmediata 24/7', description: 'Respuesta ágil por videollamada o WhatsApp.' },
            { title: 'Cero Deducible en Convenio', description: 'Sin desembolsos sorpresa al reportar tu evento.' },
            { title: 'Trámite 100% Digital', description: 'Activación en menos de 24 horas hábiles.' }
          ]
        }
      });
    }

    // 3. FAQ
    if (selectedSections.includes('faq')) {
      generatedBlocks.push({
        id: 'faq-' + Date.now(),
        type: 'faq',
        data: {
          eyebrow: 'Preguntas Frecuentes',
          title: 'Todo lo que necesitas saber',
          items: [
            { question: '¿Cómo solicito una cotización?', answer: 'Completa el formulario inferior y un asesor te enviará la propuesta de inmediato.' },
            { question: '¿Cuáles son los métodos de pago?', answer: 'Aceptamos transferencias y tarjetas con opción de pago mensual o anual con descuento.' }
          ]
        }
      });
    }

    // 4. Contact Form
    if (selectedSections.includes('contact')) {
      generatedBlocks.push({
        id: 'form-' + Date.now(),
        type: 'contact_form',
        data: {
          eyebrow: 'Cotización Inmediata',
          title: 'Comienza hoy mismo',
          subtitle: 'Déjanos tus datos para recibir asesoría personalizada.',
          submitButtonText: 'Recibir Cotización',
          fields: [
            { name: 'nombre', label: 'Nombre Completo', type: 'text', placeholder: 'Tu nombre', required: true },
            { name: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel', placeholder: '10 dígitos', required: true }
          ]
        }
      });
    }

    const newLanding: UnifiedLanding = {
      id: cleanSlug.replace('/', '').toLowerCase() || 'landing-' + Date.now(),
      name: name || 'Nueva Landing AI',
      slug: cleanSlug,
      description: businessDesc || 'Landing page generada automáticamente con el asistente de IA de Mekate Studio.',
      category,
      status: 'draft',
      version: 'v1.0.0',
      lastUpdated: 'Creado recién con IA',
      creationMode: 'ai_wizard',
      views: 0,
      conversion: '0.0%',
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      font_family: 'Poppins',
      blocks: generatedBlocks,
      seo: {
        meta_title: `${name} | Sitio Oficial`,
        meta_description: businessDesc.substring(0, 150),
        og_title: name,
        og_description: businessDesc.substring(0, 150),
        og_image_url: '',
        canonical_url: `https://landings.movi.digital${cleanSlug}`
      }
    };

    setLoading(false);
    onCreated(newLanding);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-gray-200 space-y-6">
        
        {/* Header Wizard */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F97316] to-[#7E3AF2] text-white flex items-center justify-center font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base text-gray-900">Generador de Landing con IA</h3>
              <p className="text-[11px] text-gray-500">Paso {step} de 3 · Mekate AI Studio</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Información Básica */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Proyecto / Landing *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleSlugify(e.target.value)}
                placeholder="Ej. Vida Platinum 360"
                className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ruta URL (Slug) *</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="/vida-platinum"
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="Salud & Gastos Médicos">Salud & Gastos Médicos</option>
                  <option value="Autos & Movilidad">Autos & Movilidad</option>
                  <option value="Vida & Ahorro">Vida & Ahorro</option>
                  <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                  <option value="Educación">Educación</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Descripción del Producto o Negocio</label>
              <textarea
                rows={3}
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                placeholder="Explica qué ofreces, beneficios clave y qué problema resuelves..."
                className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Siguiente: Tono y Audiencia</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Tono y Estilo */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Tono de Comunicación</label>
              <div className="grid grid-cols-2 gap-2.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      tone === t.id
                        ? 'border-[#F97316] bg-orange-50/40 shadow-xs ring-1 ring-[#F97316]'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-xs text-gray-900">{t.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Público Meta / Audiencia</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ej. Familias jóvenes con hijos, agentes de seguros, profesionistas"
                className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Color Primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-2.5 py-1.5 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Color Secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-2.5 py-1.5 uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Siguiente: Secciones</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Secciones y Generación */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Selecciona las Secciones a Generar</label>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_OPTIONS.map((sec) => {
                  const isChecked = selectedSections.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      onClick={() => toggleSection(sec.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isChecked ? 'border-[#F97316] bg-orange-50/40 ring-1 ring-[#F97316]' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-800">{sec.label}</span>
                      {isChecked && <Check className="w-4 h-4 text-[#F97316]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Atrás
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{loading ? 'Generando Landing con IA...' : 'Generar Landing Ahora'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
