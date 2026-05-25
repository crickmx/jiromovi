import { useState, useMemo, useEffect } from 'react';
import { Search, Phone, Globe, Smartphone, Shield, MessageCircle, AlertTriangle } from 'lucide-react';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';
import { type SeguwalletInsurer, formatPhoneDisplay, callLink, whatsappLink, getInsurerLogoUrl } from '../lib/insurerTypes';
import { useSiniestroLogger } from '../lib/useSiniestroLogger';
import { getContrastColor } from '../lib/contrastUtils';

function LogoFallback({ nombre, size = 'md' }: { nombre: string; size?: 'sm' | 'md' }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className={`w-full h-full flex items-center justify-center bg-neutral-100 rounded-xl ${size === 'sm' ? '' : ''}`}>
      <span className={`font-bold text-neutral-400 ${size === 'sm' ? 'text-xs' : 'text-lg'}`}>{initials}</span>
    </div>
  );
}

function AseguradoraCard({ ins, primary }: { ins: SeguwalletInsurer; primary: string }) {
  const [logoError, setLogoError] = useState(false);
  const { logClick } = useSiniestroLogger('directory');

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  const logoSrc = getInsurerLogoUrl(ins);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Logo + name */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-100 bg-white flex-shrink-0 shadow-sm">
          {logoSrc && !logoError ? (
            <img src={logoSrc} alt={ins.name} className="w-full h-full object-contain p-1" onError={() => setLogoError(true)} />
          ) : (
            <LogoFallback nombre={ins.name} />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-neutral-900 text-base leading-tight">{ins.name}</h3>
          {ins.customer_service_phone && (
            <a href={callLink(ins.customer_service_phone)} className="flex items-center gap-1.5 mt-1.5 group">
              <Phone className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[var(--brand)] transition-colors" style={{ '--brand': primary } as any} />
              <span className="text-sm font-medium text-neutral-600 group-hover:text-[var(--brand)] transition-colors" style={{ '--brand': primary } as any}>
                {formatPhoneDisplay(ins.customer_service_phone)}
              </span>
            </a>
          )}
        </div>
      </div>

      {/* Siniestros highlight */}
      {ins.claims_phone && (
        <div className="mx-6 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Siniestros</p>
            <a
              href={callLink(ins.claims_phone)}
              onClick={() => logClick(ins, 'call')}
              className="text-sm font-semibold text-red-700 hover:text-red-800 transition-colors"
            >
              {formatPhoneDisplay(ins.claims_phone)}
            </a>
          </div>
        </div>
      )}

      <div className="mx-6 border-t border-neutral-100" />

      {/* Actions */}
      <div className="px-5 py-4 space-y-2">
        {ins.payment_url && (
          <button onClick={() => openLink(ins.payment_url!)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:opacity-90"
            style={{
              backgroundColor: ins.primary_color || primary,
              color: getContrastColor(ins.primary_color || primary),
            }}>
            <div className="flex items-center gap-2"><Globe className="w-4 h-4 opacity-80" />Pagar en linea</div>
            <span className="text-xs opacity-60">→</span>
          </button>
        )}

        {ins.general_conditions_url && (
          <button onClick={() => openLink(ins.general_conditions_url!)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700 text-sm font-medium transition-all">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 opacity-60" />Condiciones Generales</div>
            <span className="text-neutral-400 text-xs">→</span>
          </button>
        )}

        {ins.customer_service_whatsapp && (
          <a href={whatsappLink(ins.customer_service_whatsapp)} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 text-sm font-medium transition-all">
            <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 opacity-70" />WhatsApp Atencion</div>
            <span className="text-emerald-400 text-xs">→</span>
          </a>
        )}

        {(ins.ios_app_url || ins.android_app_url) && (
          <div className="flex gap-2">
            {ins.ios_app_url && (
              <button onClick={() => openLink(ins.ios_app_url!)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 text-xs font-medium transition-all">
                <Smartphone className="w-3.5 h-3.5" />App iOS
              </button>
            )}
            {ins.android_app_url && (
              <button onClick={() => openLink(ins.android_app_url!)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 text-xs font-medium transition-all">
                <Smartphone className="w-3.5 h-3.5" />App Android
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SeguwalletAseguradoras() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [insurers, setInsurers] = useState<SeguwalletInsurer[]>([]);
  const [loading, setLoading] = useState(true);
  const { brand } = useAgentBrand();
  const primary = brand.primaryColor;

  useEffect(() => {
    supabase
      .from('seguwallet_insurers')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_directory', true)
      .is('deleted_at', null)
      .order('display_order')
      .then(({ data }) => {
        setInsurers(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return insurers;
    const q = search.toLowerCase();
    return insurers.filter(i => i.name.toLowerCase().includes(q));
  }, [search, insurers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Aseguradoras</h1>
        <p className="text-sm text-neutral-500 mt-1">Acceso rapido a pagos, apps, siniestros y condiciones generales</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: searchFocused ? primary : '#a3a3a3' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
          placeholder="Buscar aseguradora..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-all shadow-sm"
          style={{ borderColor: searchFocused ? primary + '80' : '#e5e5e5', boxShadow: searchFocused ? `0 0 0 3px ${primary}15` : undefined }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <Search className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">
            {search ? `Sin resultados para "${search}"` : 'No hay aseguradoras disponibles'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ins => <AseguradoraCard key={ins.id} ins={ins} primary={primary} />)}
        </div>
      )}

      <p className="text-xs text-neutral-400 text-center pb-2">
        Informacion de referencia. Para reportar un siniestro, usa el boton de emergencia o contacta directamente a tu aseguradora.
      </p>
    </div>
  );
}
