import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Calendar, ChevronDown, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand, SEGUWALLET_LOGO } from '../lib/AgentBrandContext';
import { cn } from '../../lib/utils';

const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
  'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
  'Yucatán', 'Zacatecas',
];

const GENDER_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'no_binario', label: 'No binario' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

interface FormData {
  state: string;
  municipality: string;
  birth_date: string;
  gender: string;
  terms_accepted: boolean;
}

export function SeguwalletCompleteProfile() {
  const navigate = useNavigate();
  const { customer, activeTerms, needsProfileCompletion, needsTermsAcceptance, refresh, loading } = useSeguwallet();
  const { brand } = useAgentBrand();

  const [step, setStep] = useState<'profile' | 'terms' | 'done'>('profile');
  const [form, setForm] = useState<FormData>({
    state: customer?.state || '',
    municipality: customer?.municipality || '',
    birth_date: customer?.birth_date || '',
    gender: customer?.gender || '',
    terms_accepted: false,
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Completa tu perfil | Seguwallet';
  }, []);

  useEffect(() => {
    if (!loading && customer) {
      if (!needsProfileCompletion && !needsTermsAcceptance) {
        navigate('/seguwallet/dashboard', { replace: true });
        return;
      }
      // If profile already complete but terms need acceptance, skip to terms step
      if (!needsProfileCompletion && needsTermsAcceptance) {
        setStep('terms');
      }
    }
  }, [loading, customer, needsProfileCompletion, needsTermsAcceptance, navigate]);

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="w-10 h-10 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
      </div>
    );
  }

  const validateProfile = () => {
    if (!form.state) return 'Selecciona tu estado.';
    if (!form.municipality.trim()) return 'Escribe tu municipio.';
    if (!form.birth_date) return 'Ingresa tu fecha de nacimiento.';
    if (!form.gender) return 'Selecciona tu género.';
    return null;
  };

  const handleProfileNext = () => {
    const err = validateProfile();
    if (err) { setError(err); return; }
    setError('');
    if (needsTermsAcceptance) {
      setStep('terms');
    } else {
      handleSaveAll();
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        updated_at: now,
      };

      if (needsProfileCompletion) {
        Object.assign(updates, {
          state: form.state,
          municipality: form.municipality.trim(),
          birth_date: form.birth_date,
          gender: form.gender,
          profile_completed: true,
          profile_completed_at: now,
        });
      }

      if (needsTermsAcceptance && activeTerms) {
        if (!form.terms_accepted) {
          setError('Debes aceptar los términos y condiciones para continuar.');
          setSaving(false);
          return;
        }
        Object.assign(updates, {
          terms_accepted: true,
          terms_accepted_at: now,
          terms_version_accepted: activeTerms.version,
          terms_id_accepted: activeTerms.id,
        });
      }

      const { error: updateError } = await supabase
        .from('seguwallet_customers')
        .update(updates)
        .eq('auth_user_id', customer.auth_user_id);

      if (updateError) throw updateError;

      // Log events
      const events: Array<{ customer_id: string; event_type: string; metadata: Record<string, unknown> }> = [];
      if (needsProfileCompletion) {
        events.push({ customer_id: customer.id, event_type: 'profile_completed', metadata: {} });
      }
      if (needsTermsAcceptance && activeTerms) {
        const wasAlreadyAccepted = customer.terms_accepted;
        events.push({
          customer_id: customer.id,
          event_type: wasAlreadyAccepted ? 'terms_reaccepted' : 'terms_accepted',
          metadata: { version: activeTerms.version, terms_id: activeTerms.id },
        });
      }
      if (events.length > 0) {
        await supabase.from('seguwallet_customer_events').insert(events);
      }

      // Fire transactional notifications to the agent (non-blocking)
      if (customer.agent_user_id) {
        if (needsProfileCompletion) {
          supabase.rpc('notify', {
            p_event_code: 'seguwallet_perfil_completado',
            p_user_ids: [customer.agent_user_id],
            p_payload: { cliente_nombre: customer.full_name || 'Cliente' },
            p_entity_id: customer.id,
          }).then(({ error }) => {
            if (error) console.error('[complete-profile] notify perfil_completado error:', error);
          });
        }
        if (needsTermsAcceptance && activeTerms) {
          supabase.rpc('notify', {
            p_event_code: 'seguwallet_terminos_aceptados',
            p_user_ids: [customer.agent_user_id],
            p_payload: {
              cliente_nombre: customer.full_name || 'Cliente',
              version_terminos: activeTerms.version,
            },
            p_entity_id: customer.id,
          }).then(({ error }) => {
            if (error) console.error('[complete-profile] notify terminos_aceptados error:', error);
          });
        }
      }

      setStep('done');
      await refresh();
      setTimeout(() => navigate('/seguwallet/dashboard', { replace: true }), 1800);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const primaryColor = brand.primaryColor || '#1C37E0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <img
          src={brand.displayLogo}
          alt="Logo"
          className="h-8 object-contain"
          onError={e => { (e.target as HTMLImageElement).src = SEGUWALLET_LOGO; }}
        />
        <span className="text-xs text-neutral-400">
          {customer.full_name.split(' ')[0]}
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-md">

          {/* Progress dots */}
          {(needsProfileCompletion || needsTermsAcceptance) && step !== 'done' && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {needsProfileCompletion && (
                <div className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  step === 'profile' ? "w-8 bg-[#1C37E0]" : "bg-emerald-400"
                )} style={step === 'profile' ? { backgroundColor: primaryColor } : {}} />
              )}
              {needsTermsAcceptance && (
                <div className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  step === 'terms' ? "w-8 bg-[#1C37E0]" : step === 'done' ? "bg-emerald-400" : "bg-neutral-200"
                )} style={step === 'terms' ? { backgroundColor: primaryColor } : {}} />
              )}
            </div>
          )}

          {/* ── PROFILE STEP ── */}
          {step === 'profile' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}18` }}>
                  <User className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Completa tu perfil</h1>
                <p className="text-sm text-neutral-500 mt-1.5">Solo toma 1 minuto. Necesitamos algunos datos para personalizar tu experiencia.</p>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                    Estado *
                  </label>
                  <div className="relative">
                    <select
                      value={form.state}
                      onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                      className="w-full appearance-none px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all pr-10 text-neutral-900"
                    >
                      <option value="">Selecciona tu estado</option>
                      {MEXICAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {/* Municipality */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                    Municipio / Alcaldía *
                  </label>
                  <input
                    type="text"
                    value={form.municipality}
                    onChange={e => setForm(p => ({ ...p, municipality: e.target.value }))}
                    placeholder="Ej. Monterrey, Benito Juárez..."
                    className="w-full px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-neutral-900"
                  />
                </div>

                {/* Birth date */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1 opacity-60" />
                    Fecha de nacimiento *
                  </label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))}
                    max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                    className="w-full px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-neutral-900"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-2">
                    Género *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENDER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, gender: opt.value }))}
                        className={cn(
                          "px-4 py-3 rounded-2xl border text-sm font-medium transition-all text-left",
                          form.gender === opt.value
                            ? "border-[#1C37E0] bg-blue-50 text-[#1C37E0] font-semibold"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                        )}
                        style={form.gender === opt.value ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}0f` } : {}}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleProfileNext}
                disabled={saving}
                className="w-full py-4 rounded-2xl text-white text-sm font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {needsTermsAcceptance ? 'Continuar' : saving ? 'Guardando...' : 'Finalizar'}
              </button>
            </div>
          )}

          {/* ── TERMS STEP ── */}
          {step === 'terms' && activeTerms && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}18` }}>
                  <FileText className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Términos y Condiciones</h1>
                <p className="text-sm text-neutral-500 mt-1.5">
                  {customer.terms_accepted
                    ? 'Se ha publicado una nueva versión. Revisa y acepta los términos actualizados.'
                    : 'Lee y acepta los términos para acceder a tu portal.'}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Terms preview card */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{activeTerms.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Versión {activeTerms.version}</p>
                  </div>
                  <button
                    onClick={() => setShowTermsModal(true)}
                    className="text-xs font-semibold text-[#1C37E0] hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Leer completo
                  </button>
                </div>
                <div className="px-5 py-4 max-h-40 overflow-y-auto text-xs text-neutral-600 leading-relaxed">
                  {activeTerms.content.substring(0, 400)}
                  {activeTerms.content.length > 400 && (
                    <span>... <button onClick={() => setShowTermsModal(true)} className="font-semibold text-[#1C37E0] hover:underline" style={{ color: primaryColor }}>ver más</button></span>
                  )}
                </div>
              </div>

              {/* Accept checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setForm(p => ({ ...p, terms_accepted: !p.terms_accepted }))}
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    form.terms_accepted ? "border-[#1C37E0] bg-[#1C37E0]" : "border-neutral-300 bg-white group-hover:border-neutral-400"
                  )}
                  style={form.terms_accepted ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                >
                  {form.terms_accepted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm text-neutral-700 leading-relaxed">
                  He leído y acepto los{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="font-semibold hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Términos y Condiciones
                  </button>
                  {' '}versión {activeTerms.version}.
                </span>
              </label>

              <div className="flex gap-3">
                {needsProfileCompletion && (
                  <button
                    onClick={() => setStep('profile')}
                    className="flex-1 py-4 rounded-2xl border border-neutral-200 bg-white text-neutral-700 text-sm font-medium transition-all hover:bg-neutral-50"
                  >
                    Atrás
                  </button>
                )}
                <button
                  onClick={handleSaveAll}
                  disabled={saving || !form.terms_accepted}
                  className="flex-1 py-4 rounded-2xl text-white text-sm font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </span>
                  ) : 'Aceptar y continuar'}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE STEP ── */}
          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">¡Todo listo!</h2>
              <p className="text-sm text-neutral-500">Redirigiendo a tu portal...</p>
              <div className="w-6 h-6 border-2 border-neutral-200 border-t-emerald-500 rounded-full animate-spin mx-auto mt-2" />
            </div>
          )}
        </div>
      </main>

      {/* Terms full modal */}
      {showTermsModal && activeTerms && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTermsModal(false)} />
          <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div>
                <p className="font-bold text-neutral-900">{activeTerms.title}</p>
                <p className="text-xs text-neutral-400">Versión {activeTerms.version}</p>
              </div>
              <button onClick={() => setShowTermsModal(false)} className="p-2 rounded-xl hover:bg-neutral-100 transition-colors text-neutral-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
              {activeTerms.content}
            </div>
            <div className="px-5 py-4 border-t border-neutral-100">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full py-3.5 rounded-2xl text-white text-sm font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
