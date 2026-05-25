import { useEffect, useState } from 'react';
import { Calculator, ChevronRight, CheckCircle, ArrowLeft, Send, Loader2, FileText } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface QuoteLink {
  id: string;
  slug: string;
  form_type: string;
  form_title: string;
  status: string;
  quote_form_template_id: string | null;
}

interface QuoteTemplate {
  id: string;
  form_type: string;
  form_title: string;
  description: string | null;
  fields_json: any;
}

type Step = 'list' | 'form' | 'done';

const FORM_TYPE_ICONS: Record<string, string> = {
  gmm: '🏥',
  autos: '🚗',
  vida: '💙',
  danos: '🏠',
  default: '📋',
};

function getFormIcon(formType: string): string {
  const key = Object.keys(FORM_TYPE_ICONS).find(k => formType?.toLowerCase().includes(k));
  return key ? FORM_TYPE_ICONS[key] : FORM_TYPE_ICONS.default;
}

export function SeguwalletCotizar() {
  const { customer } = useSeguwallet();
  const [links, setLinks] = useState<QuoteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('list');
  const [selectedLink, setSelectedLink] = useState<QuoteLink | null>(null);
  const [template, setTemplate] = useState<QuoteTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (customer) loadLinks();
  }, [customer]);

  const loadLinks = async () => {
    if (!customer) return;
    try {
      const { data } = await supabase
        .from('shared_quote_form_links')
        .select('id, slug, form_type, form_title, status, quote_form_template_id')
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

  const handleSelectLink = async (link: QuoteLink) => {
    setSelectedLink(link);
    setStep('form');
    setNotes('');
    setSubmitError('');
    setTemplateLoading(true);

    try {
      let tpl: QuoteTemplate | null = null;
      if (link.quote_form_template_id) {
        const { data } = await supabase
          .from('quote_form_templates')
          .select('id, form_type, form_title, description, fields_json')
          .eq('id', link.quote_form_template_id)
          .maybeSingle();
        tpl = data;
      } else {
        const { data } = await supabase
          .from('quote_form_templates')
          .select('id, form_type, form_title, description, fields_json')
          .eq('form_type', link.form_type)
          .eq('is_active', true)
          .maybeSingle();
        tpl = data;
      }
      setTemplate(tpl);
    } catch (err) {
      console.error(err);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink || !customer) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const resp = await fetch(
        `${supabaseUrl}/functions/v1/submit-shared-quote-form/${selectedLink.slug}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            client_name: customer.full_name,
            client_email: customer.email,
            client_phone: customer.phone || null,
            client_whatsapp: customer.phone || null,
            notes: notes.trim() || null,
            data_json: {
              origin: 'Seguwallet',
              seguwallet_customer_id: customer.id,
            },
            source: 'seguwallet',
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok || result.error) {
        throw new Error(result.message || result.error || 'Error al enviar la solicitud');
      }

      setStep('done');
    } catch (err: any) {
      setSubmitError(err.message || 'Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep('list');
    setSelectedLink(null);
    setTemplate(null);
    setNotes('');
    setSubmitError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
      </div>
    );
  }

  // Success screen
  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Solicitud enviada</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Tu solicitud de cotizacion de <span className="font-semibold text-neutral-700">{selectedLink?.form_title}</span> fue enviada exitosamente. Tu agente la revisara pronto.
          </p>
          <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 text-left">
            <p className="text-xs font-semibold text-blue-700 mb-2">Datos enviados</p>
            <div className="space-y-1">
              <p className="text-xs text-neutral-700"><span className="text-neutral-500">Nombre: </span>{customer?.full_name}</p>
              <p className="text-xs text-neutral-700"><span className="text-neutral-500">Correo: </span>{customer?.email}</p>
              {customer?.phone && (
                <p className="text-xs text-neutral-700"><span className="text-neutral-500">Telefono: </span>{customer.phone}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleBack}
            className="mt-6 w-full py-3 rounded-xl bg-[#1C37E0] text-white text-sm font-bold hover:bg-[#1630C8] transition-colors shadow-lg shadow-blue-600/20"
          >
            Solicitar otra cotizacion
          </button>
        </div>
      </div>
    );
  }

  // Form screen
  if (step === 'form' && selectedLink) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{selectedLink.form_title}</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Solicitar cotizacion</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-6">
          {templateLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Pre-filled customer info */}
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Tus datos de contacto</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="w-8 h-8 rounded-lg bg-[#1C37E0] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {((customer?.full_name?.split(' ')[0]?.[0] || '') + (customer?.full_name?.split(' ')[1]?.[0] || '')).toUpperCase() || 'SW'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{customer?.full_name}</p>
                      <p className="text-xs text-neutral-500 truncate">{customer?.email}</p>
                      {customer?.phone && <p className="text-xs text-neutral-400">{customer.phone}</p>}
                    </div>
                    <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">Verificado</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 mt-2">Tu agente recibira estos datos con tu solicitud.</p>
              </div>

              {/* Template description */}
              {template?.description && (
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                  <p className="text-xs text-neutral-600 leading-relaxed">{template.description}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Notas adicionales <span className="font-normal text-neutral-400">(opcional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Agrega cualquier informacion relevante para tu cotizacion (edad, vehiculo, tipo de cobertura, etc.)"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                />
              </div>

              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200",
                  "bg-[#1C37E0] hover:bg-[#1630C8]",
                  "shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar solicitud
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // List screen
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Cotizar seguro</h1>
        <p className="text-sm text-neutral-500 mt-1">Solicita una cotizacion a tu agente</p>
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <Calculator className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">No hay formularios disponibles</p>
          <p className="text-xs text-neutral-400 mt-1">Tu agente aun no ha configurado formularios de cotizacion</p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#1C37E0]/10 flex-shrink-0">
              <FileText className="w-4 h-4 text-[#1C37E0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800">Como funciona</p>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                Selecciona el tipo de seguro que te interesa. Tu solicitud sera enviada directamente a tu agente con tus datos de contacto ya precargados.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {links.map(link => {
              const icon = getFormIcon(link.form_type);
              return (
                <button
                  key={link.id}
                  onClick={() => handleSelectLink(link)}
                  className="w-full bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5 hover:shadow-md hover:border-blue-100 transition-all group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-xl flex-shrink-0">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-neutral-900 text-sm">{link.form_title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 capitalize">{link.form_type?.replace(/_/g, ' ')}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-[#1C37E0] transition-colors flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
