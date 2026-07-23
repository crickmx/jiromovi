import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import {
  MapPin, Phone, Mail, Zap, RefreshCw, Hand, UserCheck, Clock,
  CheckCircle2, ExternalLink, ShieldAlert, Loader2,
} from 'lucide-react';

// Sub-sección de Mi CRM: leads de seguros.express (Parte H).
// Sólo para agentes con seguros_express_habilitado = true.

interface PosibleLead {
  id: string;
  tipo_seguro_interes: string | null;
  direccion_manual: string | null;
  lat: number | null;
  lng: number | null;
  anillo_km_actual: number;
  created_at: string;
}

interface LeadElegido {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  tipo_seguro_interes: string | null;
  direccion_manual: string | null;
  estado: string;
  crm_contacto_id: string | null;
  updated_at: string;
}

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ESTADO_BADGE: Record<string, string> = {
  contactado: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  convertido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  expirado: 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/50',
};

export default function CRMLeadsSegurosExpress() {
  useEffect(() => { document.title = 'Mis Leads seguros.express · MOVI'; }, []);
  const { usuario } = useMoviAuth();
  const habilitado = !!(usuario as any)?.seguros_express_habilitado;
  const agLat = (usuario as any)?.ubicacion_lat ?? null;
  const agLng = (usuario as any)?.ubicacion_lng ?? null;

  const [posibles, setPosibles] = useState<PosibleLead[]>([]);
  const [elegidos, setElegidos] = useState<LeadElegido[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const cargar = useCallback(async () => {
    if (!usuario?.id) return;
    // Posibles: sólo columnas NO sensibles (RLS ya acota los visibles en alcance).
    const posiblesReq = supabase
      .from('express_leads')
      .select('id, tipo_seguro_interes, direccion_manual, lat, lng, anillo_km_actual, created_at')
      .eq('estado', 'notificado')
      .is('agente_asignado_id', null)
      .order('created_at', { ascending: false });
    // Elegidos: los que yo tomé (datos completos).
    const elegidosReq = supabase
      .from('express_leads')
      .select('id, nombre, telefono, email, tipo_seguro_interes, direccion_manual, estado, crm_contacto_id, updated_at')
      .eq('agente_asignado_id', usuario.id)
      .order('updated_at', { ascending: false });

    const [pRes, eRes] = await Promise.all([posiblesReq, elegidosReq]);
    if (!pRes.error && pRes.data) setPosibles(pRes.data as PosibleLead[]);
    if (!eRes.error && eRes.data) setElegidos(eRes.data as LeadElegido[]);
    setLoading(false);
  }, [usuario?.id]);

  useEffect(() => {
    if (!habilitado) { setLoading(false); return; }
    cargar();
    const t = setInterval(cargar, 30000); // refresco ligero para captar nuevos leads
    return () => clearInterval(t);
  }, [habilitado, cargar]);

  async function tomarLead(id: string) {
    setClaimingId(id);
    try {
      const { data, error } = await supabase.rpc('claim_express_lead', { p_lead_id: id });
      if (error) throw error;
      if (!data?.success) {
        if (data?.reason === 'ya_tomado') {
          showToast('Este lead ya fue tomado por otro agente.', 'error');
        } else if (data?.reason === 'fuera_de_alcance') {
          showToast('Este lead ya no está dentro de tu alcance.', 'error');
        } else {
          showToast('No se pudo tomar el lead.', 'error');
        }
      } else {
        showToast('¡Lead tomado! Ya puedes ver sus datos de contacto.', 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error al tomar el lead.', 'error');
    } finally {
      setClaimingId(null);
      await cargar();
    }
  }

  async function convertir(id: string) {
    setConvertingId(id);
    try {
      const { data, error } = await supabase.rpc('convert_express_lead_to_crm', { p_lead_id: id, p_notas: null });
      if (error) throw error;
      if (!data?.success) {
        showToast('No se pudo convertir el lead.', 'error');
      } else {
        showToast('Lead convertido a contacto en Mi CRM.', 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error al convertir el lead.', 'error');
    } finally {
      setConvertingId(null);
      await cargar();
    }
  }

  if (!habilitado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-neutral-400" />
        <h1 className="mt-4 text-xl font-bold text-neutral-900 dark:text-white">
          seguros.express no está habilitado en tu cuenta
        </h1>
        <p className="mt-2 text-neutral-500 dark:text-white/50">
          Pide a un administrador que te habilite para empezar a recibir leads cercanos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Mis Leads seguros.express</h1>
            <p className="text-sm text-neutral-500 dark:text-white/50">
              Toma un lead cercano para ver sus datos y contactarlo.
            </p>
          </div>
        </div>
        <button
          onClick={cargar}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>
      ) : (
        <div className="space-y-8">
          {/* Posibles leads */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/50">
              <Hand className="h-4 w-4" /> Posibles leads ({posibles.length})
            </h2>
            {posibles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400 dark:border-white/10 dark:text-white/40">
                No hay leads disponibles en tu zona por ahora.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {posibles.map((l) => {
                  const dist = (agLat != null && agLng != null && l.lat != null && l.lng != null)
                    ? Math.round(distanciaKm(agLat, agLng, l.lat, l.lng)) : null;
                  return (
                    <div key={l.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-start justify-between">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                          {l.tipo_seguro_interes || 'Seguro'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <Clock className="h-3 w-3" />
                          {new Date(l.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-sm text-neutral-600 dark:text-white/60">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {l.direccion_manual
                          ? l.direccion_manual
                          : dist != null ? `A ~${dist} km de tu ubicación` : 'Ubicación aproximada compartida'}
                      </p>
                      <button
                        onClick={() => tomarLead(l.id)}
                        disabled={claimingId === l.id}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        {claimingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                        Tomar lead
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Leads elegidos */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/50">
              <UserCheck className="h-4 w-4" /> Leads elegidos ({elegidos.length})
            </h2>
            {elegidos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400 dark:border-white/10 dark:text-white/40">
                Aún no has tomado ningún lead.
              </p>
            ) : (
              <div className="space-y-3">
                {elegidos.map((l) => (
                  <div key={l.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900 dark:text-white">{l.nombre}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADO_BADGE[l.estado] || 'bg-neutral-100 text-neutral-500'}`}>
                            {l.estado}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">{l.tipo_seguro_interes || 'Seguro'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-white/70">
                          <a href={`tel:${l.telefono}`} className="flex items-center gap-1.5 hover:text-sky-600">
                            <Phone className="h-3.5 w-3.5" /> {l.telefono}
                          </a>
                          {l.email && (
                            <a href={`mailto:${l.email}`} className="flex items-center gap-1.5 hover:text-sky-600">
                              <Mail className="h-3.5 w-3.5" /> {l.email}
                            </a>
                          )}
                          {l.direccion_manual && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {l.direccion_manual}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {l.estado === 'convertido' && l.crm_contacto_id ? (
                          <Link
                            to={`/mi-crm/contactos/${l.crm_contacto_id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Ver en CRM
                          </Link>
                        ) : l.estado !== 'expirado' ? (
                          <button
                            onClick={() => convertir(l.id)}
                            disabled={convertingId === l.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {convertingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Convertir a CRM
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
