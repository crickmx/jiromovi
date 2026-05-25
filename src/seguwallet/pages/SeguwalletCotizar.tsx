import { useEffect, useState } from 'react';
import { ExternalLink, ChevronRight, Car, Heart, Home, Shield, Briefcase, Stethoscope, Package, Zap, Calculator } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';

interface QuoteLink {
  id: string;
  slug: string;
  form_type: string;
  form_title: string;
  status: string;
  public_url: string | null;
}

const FORM_TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string }> = {
  gmm:             { icon: Stethoscope, bg: '#0ea5e9' },
  vida:            { icon: Heart,       bg: '#ef4444' },
  autos:           { icon: Car,         bg: '#f59e0b' },
  auto:            { icon: Car,         bg: '#f59e0b' },
  danos:           { icon: Home,        bg: '#8b5cf6' },
  hogar:           { icon: Home,        bg: '#8b5cf6' },
  flotilla:        { icon: Briefcase,   bg: '#6366f1' },
  empresa:         { icon: Briefcase,   bg: '#6366f1' },
  negocio:         { icon: Briefcase,   bg: '#6366f1' },
  responsabilidad: { icon: Shield,      bg: '#10b981' },
  rc:              { icon: Shield,      bg: '#10b981' },
  transporte:      { icon: Package,     bg: '#f97316' },
  viaje:           { icon: Zap,         bg: '#14b8a6' },
};

function getFormConfig(formType: string) {
  const key = Object.keys(FORM_TYPE_CONFIG).find(k => formType?.toLowerCase().includes(k));
  return key ? FORM_TYPE_CONFIG[key] : { icon: Calculator, bg: '#6b7280' };
}

function buildPublicUrl(link: QuoteLink): string {
  if (link.public_url) return link.public_url;
  return `https://agentedeseguros.website/cotizar/${link.slug}`;
}

export function SeguwalletCotizar() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const [links, setLinks] = useState<QuoteLink[]>([]);
  const [loading, setLoading] = useState(true);

  const primary = brand.primaryColor;

  useEffect(() => {
    if (customer) loadLinks();
  }, [customer]);

  const loadLinks = async () => {
    if (!customer) return;
    try {
      const { data } = await supabase
        .from('shared_quote_form_links')
        .select('id, slug, form_type, form_title, status, public_url')
        .eq('agent_id', customer.agent_user_id)
        .eq('status', 'active')
        .order('form_title');
      setLinks((data || []) as QuoteLink[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (link: QuoteLink) => {
    window.open(buildPublicUrl(link), '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-neutral-200 rounded-full animate-spin" style={{ borderTopColor: primary }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Cotizar seguro</h1>
        <p className="text-sm text-neutral-500 mt-1">Elige el tipo de seguro y completa tu solicitud en segundos.</p>
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-7 h-7 text-neutral-300" />
          </div>
          <p className="text-sm font-semibold text-neutral-500">Formularios no disponibles</p>
          <p className="text-xs text-neutral-400 mt-1">No encontramos formularios de cotizacion activos para tu agente. Intenta mas tarde o contacta directamente a tu agente.</p>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: primary + '10', border: `1px solid ${primary}25` }}
          >
            <div className="p-2 rounded-xl flex-shrink-0" style={{ backgroundColor: primary + '18' }}>
              <ExternalLink className="w-4 h-4" style={{ color: primary }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">Como funciona</p>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                Selecciona el tipo de seguro. Se abrira el formulario de cotizacion donde podras ingresar tus datos y recibir una propuesta personalizada de tu agente.
              </p>
            </div>
          </div>

          {/* Insurance type grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {links.map(link => {
              const cfg = getFormConfig(link.form_type);
              const Icon = cfg.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => handleOpenForm(link)}
                  className="group bg-white rounded-2xl border border-neutral-200/60 shadow-sm hover:shadow-lg hover:border-neutral-200 transition-all duration-200 p-5 text-left flex flex-col gap-3 relative overflow-hidden"
                >
                  {/* Subtle color bleed top-right */}
                  <div
                    className="absolute top-0 right-0 w-20 h-20 rounded-bl-[48px] opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
                    style={{ backgroundColor: cfg.bg }}
                  />

                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: cfg.bg + '15' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: cfg.bg }} />
                  </div>

                  {/* Title */}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-neutral-900 text-sm leading-snug line-clamp-2">{link.form_title}</p>
                    <p className="text-[11px] text-neutral-400 mt-1 capitalize">{link.form_type?.replace(/_/g, ' ')}</p>
                  </div>

                  {/* CTA row */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: primary }}
                    >
                      Cotizar
                    </span>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0"
                      style={{ backgroundColor: primary + '15' }}
                    >
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: primary }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {brand.agentName && brand.agentName !== 'Tu Agente' && (
            <p className="text-xs text-neutral-400 text-center pt-1">
              Formularios de <span className="font-medium text-neutral-500">{brand.agentName}</span>. Tu agente recibira tu solicitud directamente.
            </p>
          )}
        </>
      )}
    </div>
  );
}
