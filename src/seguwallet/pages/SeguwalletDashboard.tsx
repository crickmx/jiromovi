import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Clock, AlertTriangle, User } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { getSeguwalletSicasClients, getAgentInfo } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function SeguwalletDashboard() {
  const { customer } = useSeguwallet();
  const navigate = useNavigate();
  const [sicasClients, setSicasClients] = useState<any[]>([]);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [policyCount, setPolicyCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;
    loadData();
  }, [customer]);

  const loadData = async () => {
    if (!customer) return;
    try {
      const [clients, agent] = await Promise.all([
        getSeguwalletSicasClients(customer.id),
        getAgentInfo(customer.agent_user_id),
      ]);
      setSicasClients(clients);
      setAgentInfo(agent);

      if (clients.length > 0) {
        const clientIds = clients.map((c: any) => c.sicas_client_id);

        const { count } = await supabase
          .from('sicas_documents')
          .select('id', { count: 'exact', head: true })
          .in('desp_id', clientIds)
          .eq('is_vigente', true);

        setPolicyCount(count || 0);

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const { count: expCount } = await supabase
          .from('sicas_documents')
          .select('id', { count: 'exact', head: true })
          .in('desp_id', clientIds)
          .eq('is_vigente', true)
          .lte('vigencia_hasta', thirtyDaysFromNow.toISOString());

        setExpiringCount(expCount || 0);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
          Hola, <span className="text-[#1C37E0]">{toTitleCase(customer?.full_name?.split(' ')[0] || '')}</span>
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Bienvenido a tu wallet de seguros</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className="bg-white rounded-2xl border border-neutral-200/50 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group text-left"
        >
          <div className="p-2.5 rounded-xl bg-blue-50 w-fit mb-3 group-hover:bg-blue-100 transition-colors">
            <FileText className="w-5 h-5 text-[#1C37E0]" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{policyCount}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Polizas vigentes</p>
        </button>

        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className={cn(
            "bg-white rounded-2xl border border-neutral-200/50 p-5 shadow-sm hover:shadow-md transition-all group text-left",
            expiringCount > 0 ? "hover:border-amber-200" : "hover:border-blue-200"
          )}
        >
          <div className={cn(
            "p-2.5 rounded-xl w-fit mb-3 transition-colors",
            expiringCount > 0 ? "bg-amber-50 group-hover:bg-amber-100" : "bg-neutral-50 group-hover:bg-neutral-100"
          )}>
            {expiringCount > 0
              ? <AlertTriangle className="w-5 h-5 text-amber-600" />
              : <Clock className="w-5 h-5 text-neutral-400" />
            }
          </div>
          <p className="text-2xl font-bold text-neutral-900">{expiringCount}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Proximas a vencer</p>
        </button>

        <button
          onClick={() => navigate('/seguwallet/descargas')}
          className="bg-white rounded-2xl border border-neutral-200/50 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group text-left"
        >
          <div className="p-2.5 rounded-xl bg-blue-50 w-fit mb-3 group-hover:bg-blue-100 transition-colors">
            <Download className="w-5 h-5 text-[#1C37E0]" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{sicasClients.length}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Clientes vinculados</p>
        </button>
      </div>

      {/* Agent info */}
      {agentInfo && (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-5">
          <div className="flex items-center gap-4">
            {agentInfo.imagen_perfil_url ? (
              <img src={agentInfo.imagen_perfil_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#1C37E0] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500 mb-0.5">Tu agente de seguros</p>
              <p className="font-bold text-neutral-900 truncate">
                {agentInfo.nombre_publico || `${toTitleCase(agentInfo.nombre || '')} ${toTitleCase(agentInfo.apellidos || '')}`}
              </p>
              {agentInfo.oficinas?.nombre && (
                <p className="text-xs text-neutral-500 mt-0.5">{agentInfo.oficinas.nombre}</p>
              )}
            </div>
            {agentInfo.celular_laboral && (
              <a
                href={`tel:${agentInfo.celular_laboral}`}
                className="px-4 py-2 rounded-xl bg-blue-50 text-[#1C37E0] text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                Contactar
              </a>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/seguwallet/polizas')}
          className="bg-[#1C37E0] rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20 hover:bg-[#1630C8] hover:shadow-xl hover:shadow-blue-600/30 transition-all text-left"
        >
          <FileText className="w-6 h-6 mb-3 opacity-80" />
          <p className="font-bold text-sm">Ver mis polizas</p>
          <p className="text-xs opacity-70 mt-0.5">Consulta tus coberturas</p>
        </button>
        <button
          onClick={() => navigate('/seguwallet/descargas')}
          className="bg-[#3B58F0] rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 hover:bg-[#2A47DF] hover:shadow-xl hover:shadow-blue-500/30 transition-all text-left"
        >
          <Download className="w-6 h-6 mb-3 opacity-80" />
          <p className="font-bold text-sm">Centro de descargas</p>
          <p className="text-xs opacity-70 mt-0.5">Documentos y recibos</p>
        </button>
      </div>
    </div>
  );
}
