import { useState, useEffect, useMemo } from 'react';
import { X, Phone, MessageCircle, Search, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type SeguwalletInsurer, formatPhoneDisplay, callLink, whatsappLink, getInsurerLogoUrl } from '../lib/insurerTypes';
import { useSiniestroLogger } from '../lib/useSiniestroLogger';

interface Props {
  onClose: () => void;
}

function LogoFallback({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-xl">
      <span className="text-xs font-bold text-red-300">{initials}</span>
    </div>
  );
}

export function ReportarSiniestroModal({ onClose }: Props) {
  const [insurers, setInsurers] = useState<SeguwalletInsurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('seguwallet_insurers')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_claims', true)
      .is('deleted_at', null)
      .order('display_order')
      .then(({ data }) => {
        const withClaims = (data || []).filter(
          ins => ins.claims_phone || ins.claims_whatsapp
        );
        setInsurers(withClaims);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return insurers;
    const q = search.toLowerCase();
    return insurers.filter(i => i.name.toLowerCase().includes(q));
  }, [search, insurers]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-neutral-100 bg-red-600 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Reportar Siniestro</h2>
              <p className="text-xs text-red-100">Contacto directo con area de siniestros</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info bar */}
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700 leading-relaxed">
            Selecciona tu aseguradora para comunicarte directamente con el area de siniestros.
            Ten a la mano tu <strong>numero de poliza</strong>, nombre del asegurado y ubicacion del evento.
          </p>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-neutral-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar aseguradora..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all"
            />
          </div>
        </div>

        {/* Insurers list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-[3px] border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">
                {search ? `Sin resultados para "${search}"` : 'No hay aseguradoras configuradas para siniestros'}
              </p>
            </div>
          ) : (
            filtered.map(ins => (
              <InsurerClaimsCard key={ins.id} ins={ins} />
            ))
          )}
        </div>

        {/* Safe area for mobile */}
        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}

function InsurerClaimsCard({ ins }: { ins: SeguwalletInsurer }) {
  const [logoError, setLogoError] = useState(false);
  const { logClick } = useSiniestroLogger('modal');
  const logoSrc = getInsurerLogoUrl(ins);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:border-red-200 hover:shadow-md transition-all">
      {/* Top row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-100 bg-white flex-shrink-0 shadow-sm">
          {logoSrc && !logoError ? (
            <img src={logoSrc} alt={ins.name} className="w-full h-full object-contain p-0.5" onError={() => setLogoError(true)} />
          ) : (
            <LogoFallback nombre={ins.name} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-neutral-900 text-sm">{ins.name}</p>
          {ins.claims_instructions && (
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed line-clamp-2">{ins.claims_instructions}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        {ins.claims_phone && (
          <a
            href={callLink(ins.claims_phone)}
            onClick={() => logClick(ins, 'call')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-sm"
          >
            <Phone className="w-4 h-4" />
            <span>Llamar{ins.claims_phone ? ` ${formatPhoneDisplay(ins.claims_phone)}` : ''}</span>
          </a>
        )}
        {ins.claims_whatsapp && (
          <a
            href={whatsappLink(ins.claims_whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logClick(ins, 'whatsapp')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>
    </div>
  );
}
