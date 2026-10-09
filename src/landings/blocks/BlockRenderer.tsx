import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  MessageSquare, 
  Star, 
  ShieldCheck, 
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import type { 
  Block, 
  HeroData, 
  TextSectionData, 
  FeatureGridData, 
  CTAData, 
  ContactFormData, 
  FAQData, 
  ImageTextData, 
  TestimonialsData, 
  VisualCloneSectionData,
  UnifiedLanding 
} from '../types';

interface BlockRendererProps {
  blocks: Block[];
  landing: UnifiedLanding;
}

export function BlockRenderer({ blocks, landing }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="py-20 text-center bg-gray-50 text-gray-500">
        <p className="text-sm font-medium">Esta landing aún no tiene bloques configurados.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-gray-900 font-sans antialiased selection:bg-[#F97316] selection:text-white">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'hero':
            return <HeroBlock key={block.id || idx} data={block.data as HeroData} landing={landing} />;
          case 'feature_grid':
            return <FeatureGridBlock key={block.id || idx} data={block.data as FeatureGridData} landing={landing} />;
          case 'text_section':
            return <TextSectionBlock key={block.id || idx} data={block.data as TextSectionData} landing={landing} />;
          case 'cta':
            return <CTABlock key={block.id || idx} data={block.data as CTAData} landing={landing} />;
          case 'contact_form':
            return <ContactFormBlock key={block.id || idx} data={block.data as ContactFormData} landing={landing} />;
          case 'faq':
            return <FAQBlock key={block.id || idx} data={block.data as FAQData} landing={landing} />;
          case 'testimonials':
            return <TestimonialsBlock key={block.id || idx} data={block.data as TestimonialsData} landing={landing} />;
          case 'image_text':
            return <ImageTextBlock key={block.id || idx} data={block.data as ImageTextData} landing={landing} />;
          case 'visual_clone_section':
            return <VisualCloneBlock key={block.id || idx} data={block.data as VisualCloneSectionData} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

// ── Hero Block ───────────────────────────────────────────────────────────────
function HeroBlock({ data, landing }: { data: HeroData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const secondary = landing.secondary_color || '#7E3AF2';
  const isCentered = data.align === 'center';
  const [formSubmitted, setFormSubmitted] = useState(false);

  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className={`flex flex-col ${isCentered ? 'items-center text-center' : 'items-start text-left'} max-w-4xl mx-auto space-y-6`}>
          
          {data.eyebrow && (
            <div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border shadow-xs"
              style={{ backgroundColor: `${primary}15`, color: primary, borderColor: `${primary}30` }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{data.eyebrow}</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-[1.12]">
            {data.title}
          </h1>

          {data.subtitle && (
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl font-normal">
              {data.subtitle}
            </p>
          )}

          {data.bullets && data.bullets.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {data.bullets.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-xs">
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-4 w-full sm:w-auto">
            {data.primaryButtonText && (
              <a
                href={data.primaryButtonUrl || '#contacto'}
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ backgroundColor: primary, boxShadow: `0 10px 25px -5px ${primary}40` }}
              >
                <span>{data.primaryButtonText}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}

            {data.secondaryButtonText && (
              <a
                href={data.secondaryButtonUrl || '#'}
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-sm font-bold text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <span>{data.secondaryButtonText}</span>
              </a>
            )}
          </div>

          {data.heroForm && data.heroForm.fields?.length > 0 && (
            <div className="w-full max-w-lg mt-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-xl text-left">
              {formSubmitted ? (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-bold text-gray-900 text-sm">¡Datos enviados con éxito!</p>
                  <p className="text-xs text-gray-500">Un asesor se pondrá en contacto a la brevedad.</p>
                </div>
              ) : (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setFormSubmitted(true);
                  }}
                  className="space-y-3"
                >
                  {data.heroForm.fields.map((f, i) => (
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                      <input
                        type={f.type || 'text'}
                        required={f.required}
                        placeholder={f.placeholder}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2"
                        style={{ outlineColor: primary }}
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl font-bold text-xs text-white transition-all shadow-md mt-2"
                    style={{ backgroundColor: primary }}
                  >
                    {data.heroForm.submitLabel || 'Enviar Solicitud'}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
}

// ── Feature Grid Block ───────────────────────────────────────────────────────
function FeatureGridBlock({ data, landing }: { data: FeatureGridData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const bg = data.background === 'gray' ? 'bg-gray-50' : 'bg-white';
  const cols = data.columns || 3;

  const colGrid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className={`py-16 md:py-24 ${bg}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {(data.eyebrow || data.title || data.subtitle) && (
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2.5">
            {data.eyebrow && (
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
                {data.eyebrow}
              </span>
            )}
            {data.title && <h2 className="text-3xl font-black text-gray-900">{data.title}</h2>}
            {data.subtitle && <p className="text-sm text-gray-600 leading-relaxed">{data.subtitle}</p>}
          </div>
        )}

        <div className={`grid grid-cols-1 ${colGrid} gap-6`}>
          {data.items?.map((item, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs hover:shadow-md transition-all space-y-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs"
                style={{ backgroundColor: `${primary}15`, color: primary }}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-gray-900">{item.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Text Section Block ───────────────────────────────────────────────────────
function TextSectionBlock({ data, landing }: { data: TextSectionData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const isCentered = data.align === 'center';

  return (
    <section className="py-16 bg-white">
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 ${isCentered ? 'text-center' : 'text-left'} space-y-4`}>
        {data.eyebrow && (
          <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
            {data.eyebrow}
          </span>
        )}
        {data.title && <h2 className="text-3xl font-black text-gray-900">{data.title}</h2>}
        <div 
          className="text-sm sm:text-base text-gray-700 leading-relaxed space-y-3"
          dangerouslySetInnerHTML={{ __html: data.body }}
        />
      </div>
    </section>
  );
}

// ── CTA Block ───────────────────────────────────────────────────────────────
function CTABlock({ data, landing }: { data: CTAData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const secondary = landing.secondary_color || '#7E3AF2';
  const isDark = data.background === 'dark';
  const isBrand = data.background !== 'light' && data.background !== 'dark';

  return (
    <section 
      className="py-16 md:py-20 text-white"
      style={{
        background: isBrand 
          ? `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`
          : isDark ? '#0f172a' : '#f8fafc',
        color: !isBrand && !isDark ? '#0f172a' : '#ffffff'
      }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        {data.eyebrow && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/20 uppercase tracking-wider">
            {data.eyebrow}
          </span>
        )}
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{data.title}</h2>
        {data.subtitle && <p className="text-sm sm:text-base opacity-90 max-w-xl mx-auto">{data.subtitle}</p>}

        <div className="pt-2 flex flex-wrap justify-center gap-4">
          <a
            href={data.buttonUrl || '#contacto'}
            className="px-8 py-3.5 rounded-xl font-extrabold text-sm bg-white text-gray-900 shadow-xl hover:bg-gray-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <span>{data.buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          {data.secondaryButtonText && (
            <a
              href={data.secondaryButtonUrl || '#'}
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2"
            >
              <span>{data.secondaryButtonText}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Contact Form Block ──────────────────────────────────────────────────────
function ContactFormBlock({ data, landing }: { data: ContactFormData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contacto" className="py-20 bg-gray-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <div className="p-8 rounded-3xl bg-white border border-gray-200 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            {data.eyebrow && (
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
                {data.eyebrow}
              </span>
            )}
            <h2 className="text-2xl font-black text-gray-900">{data.title}</h2>
            {data.subtitle && <p className="text-xs text-gray-500">{data.subtitle}</p>}
          </div>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-50 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="font-bold text-emerald-900 text-sm">{data.successMessage || '¡Información recibida!'}</p>
              <p className="text-xs text-emerald-700">Te contactaremos de inmediato.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
              {data.fields?.map((f, i) => (
                <div key={i}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      required={f.required}
                      rows={3}
                      placeholder={f.placeholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2"
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      required={f.required}
                      placeholder={f.placeholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl font-bold text-xs text-white transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}
              >
                <Send className="w-4 h-4" />
                <span>{data.submitButtonText || 'Enviar Mensaje'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── FAQ Block ───────────────────────────────────────────────────────────────
function FAQBlock({ data, landing }: { data: FAQData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {(data.eyebrow || data.title) && (
          <div className="text-center mb-12 space-y-2">
            {data.eyebrow && (
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
                {data.eyebrow}
              </span>
            )}
            {data.title && <h2 className="text-3xl font-black text-gray-900">{data.title}</h2>}
          </div>
        )}

        <div className="space-y-3">
          {data.items?.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden transition-all">
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between font-bold text-sm text-gray-900 hover:text-gray-700 cursor-pointer"
                >
                  <span>{item.question}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials Block ──────────────────────────────────────────────────────
function TestimonialsBlock({ data, landing }: { data: TestimonialsData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {(data.eyebrow || data.title) && (
          <div className="text-center mb-14 space-y-2">
            {data.eyebrow && (
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
                {data.eyebrow}
              </span>
            )}
            {data.title && <h2 className="text-3xl font-black text-gray-900">{data.title}</h2>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.items?.map((t, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="flex gap-1 text-amber-400">
                {[...Array(t.rating || 5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-gray-700 italic leading-relaxed">"{t.quote}"</p>
              <div>
                <p className="font-bold text-xs text-gray-900">{t.author}</p>
                {t.role && <p className="text-[11px] text-gray-500">{t.role}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Image Text Block ────────────────────────────────────────────────────────
function ImageTextBlock({ data, landing }: { data: ImageTextData; landing: UnifiedLanding }) {
  const primary = landing.primary_color || '#F97316';
  const imgRight = data.imagePosition === 'right';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className={`lg:col-span-6 space-y-4 ${imgRight ? 'order-1' : 'order-2'}`}>
            {data.eyebrow && (
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>
                {data.eyebrow}
              </span>
            )}
            <h2 className="text-3xl font-black text-gray-900">{data.title}</h2>
            <div className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: data.body }} />
            {data.buttonText && (
              <a
                href={data.buttonUrl || '#'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md active:scale-95"
                style={{ backgroundColor: primary }}
              >
                <span>{data.buttonText}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
          <div className={`lg:col-span-6 ${imgRight ? 'order-2' : 'order-1'}`}>
            <img
              src={data.imageUrl || 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80'}
              alt={data.imageAlt || data.title}
              className="rounded-3xl shadow-xl w-full object-cover max-h-[420px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Visual Clone Block ──────────────────────────────────────────────────────
function VisualCloneBlock({ data }: { data: VisualCloneSectionData }) {
  return (
    <div className="w-full relative">
      <div dangerouslySetInnerHTML={{ __html: data.html }} />
    </div>
  );
}
