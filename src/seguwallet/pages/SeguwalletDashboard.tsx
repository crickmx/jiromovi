import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calculator, Clock, AlertTriangle, Phone, Mail, Globe, MessageCircle, ChevronRight } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

function AgentCard({ primary, secondary }: { primary: string; secondary: string }) {
  const { brand } = useAgentBrand();

  if (!brand.agentName || brand.agentName === 'Tu Agente') return null;

  const getInitials = () => {
    const parts = brand.agentName.split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Color strip */}
      <div
        className="h-2"
        style={{ background: `linear-gradient(90deg, ${primary} 0%, ${secondary} 100%)` }}
      />

      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Tu agente de seguros</p>

        <div className="flex items-center gap-4 mb-5">
          {brand.profileImageUrl ? (
            <img
              src={brand.profileImageUrl}
              alt={brand.agentName}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 ring-2 ring-white shadow-md"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-md"
              style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
            >
              {getInitials()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-neutral-900 text-base leading-snug truncate">{brand.agentName}</p>
            {brand.officeName && (
              <p className="text-xs text-neutral-500 mt-0.5 truncate">{brand.officeName}</p>
            )}
            {brand.email && (
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{brand.email}</p>
            )}
          </div>
        </div>

        {/* Contact buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {brand.whatsappUrl && (
            <a
              href={brand.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-[#25D366]/5 hover:border-[#25D366]/30 transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center group-hover:bg-[#25D366]/20 transition-colors">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-500 group-hover:text-[#25D366] transition-colors">WhatsApp</span>
            </a>
          )}

          {brand.telUrl && (
            <a
              href={brand.telUrl}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-neutral-100 bg-neutral-50 hover:border-neutral-200 transition-all group"
              style={{}}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-opacity"
                style={{ backgroundColor: primary + '15' }}
              >
                <Phone className="w-4 h-4" style={{ color: primary }} />
              </div>
              <span className="text-[10px] font-semibold text-neutral-500 group-hover:text-neutral-700 transition-colors">Llamar</span>
            </a>
          )}

          {brand.mailtoUrl && (
            <a
              href={brand.mailtoUrl}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                <Mail className="w-4 h-4 text-neutral-500" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-500 group-hover:text-neutral-700 transition-colors">Correo</span>
            </a>
          )}

          {brand.webUrl && (
            <a
              href={brand.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                <Globe className="w-4 h-4 text-neutral-500" />
              </div>
              <span className="text-[10px] font-semibold text-neutral-500 group-hover:text-neutral-700 transition-colors">Web</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function SeguwalletDashboard() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const navigate = useNavigate();
  const [policyCount, setPolicyCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const primary = brand.primaryColor;
  const secondary = brand.secondaryColor;

  useEffect(() => {
    if (!customer) return;
    loadData();
  }, [customer]);

  const loadData = async () => {
    if (!customer) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase.rpc('get_seguwallet_poliza_counts', { p_auth_id: user.id });
      if (error) throw error;

      if (data && data.length > 0) {
        setPolicyCount(Number(data[0].total_vigentes) || 0);
        setExpiringCount(Number(data[0].proximas_vencer) || 0);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const firstName = customer?.full_name
    ? customer.full_name.split(' ')[0].toLowerCase().replace(/\b\w/, c => c.toUpperCase())
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 border-[3px] border-neutral-200 rounded-full animate-spin"
          style={{ borderTopColor: primary }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Welcome hero */}
      <div
        className="relative rounded-3xl overflow-hidden p-6 sm:p-8 text-white shadow-xl"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-[0.08] translate-x-16 -translate-y-16" style={{ backgroundColor: 'white' }} />
        <div className="absolute bottom-0 left-16 w-32 h-32 rounded-full opacity-[0.05] translate-y-12" style={{ backgroundColor: 'white' }} />

        <div className="relative">
          <p className="text-sm font-medium opacity-75 mb-1">Bienvenido de vuelta</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {firstName ? `Hola, ${firstName}` : 'Tu wallet de seguros'}
          </h1>
          <p className="text-sm opacity-70 mt-1.5">Gestiona tus polizas y solicita cotizaciones en segundos.</p>

          <button
            onClick={() => navigate('/seguwallet/polizas')}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-sm font-semibold transition-all"
          >
            Ver mis polizas
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className="bg-white rounded-2xl border border-neutral-200/50 p-5 shadow-sm hover:shadow-md transition-all group text-left"
          style={{ '--hover-border': primary + '40' } as any}
        >
          <div
            className="p-2.5 rounded-xl w-fit mb-3 transition-colors"
            style={{ backgroundColor: primary + '12' }}
          >
            <FileText className="w-5 h-5" style={{ color: primary }} />
          </div>
          <p className="text-3xl font-bold text-neutral-900">{policyCount}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Polizas vigentes</p>
        </button>

        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className={cn(
            "bg-white rounded-2xl border border-neutral-200/50 p-5 shadow-sm hover:shadow-md transition-all group text-left",
          )}
        >
          <div className={cn(
            "p-2.5 rounded-xl w-fit mb-3 transition-colors",
            expiringCount > 0 ? "bg-amber-50" : "bg-neutral-50"
          )}>
            {expiringCount > 0
              ? <AlertTriangle className="w-5 h-5 text-amber-500" />
              : <Clock className="w-5 h-5 text-neutral-400" />
            }
          </div>
          <p className="text-3xl font-bold text-neutral-900">{expiringCount}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Proximas a vencer</p>
          {expiringCount > 0 && (
            <p className="text-[10px] text-amber-500 font-semibold mt-1">En los proximos 30 dias</p>
          )}
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className="rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:brightness-105 transition-all text-left"
          style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
        >
          <FileText className="w-6 h-6 mb-3 opacity-80" />
          <p className="font-bold text-sm">Mis polizas</p>
          <p className="text-xs opacity-65 mt-0.5">Consulta tus coberturas</p>
        </button>

        <button
          onClick={() => navigate('/seguwallet/cotizar')}
          className="rounded-2xl p-5 text-white shadow-lg hover:shadow-xl hover:brightness-105 transition-all text-left bg-white"
          style={{ border: `2px solid ${primary}25`, color: primary }}
        >
          <Calculator className="w-6 h-6 mb-3 opacity-80" style={{ color: primary }} />
          <p className="font-bold text-sm" style={{ color: primary }}>Cotizar seguro</p>
          <p className="text-xs mt-0.5 text-neutral-400">Solicita una propuesta</p>
        </button>
      </div>

      {/* Agent card */}
      <AgentCard primary={primary} secondary={secondary} />
    </div>
  );
}
