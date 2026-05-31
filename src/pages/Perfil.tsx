import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';
import { User, Phone, Mail, MapPin, Shield, Globe, MessageCircle } from 'lucide-react';

export default function Perfil() {
  const { customer, agent, office } = useAuth();

  const agentName = agent ? `${agent.nombre} ${agent.apellidos}` : null;

  return (
    <Layout>
      <h1 className="text-xl font-bold text-slate-800 mb-6">Mi Perfil</h1>

      {/* Customer card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Mis datos</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">{customer?.full_name}</p>
            <p className="text-slate-500 text-sm">{customer?.email}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {customer?.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-300" />{customer.phone}
            </div>
          )}
          {customer?.whatsapp && (
            <div className="flex items-center gap-2 text-slate-600">
              <MessageCircle className="w-4 h-4 text-slate-300" />WhatsApp: {customer.whatsapp}
            </div>
          )}
        </div>
      </div>

      {/* Agent card */}
      {(agent || office) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Mi agente</h2>
          <div className="flex items-center gap-4 mb-4">
            {agent?.imagen_perfil_url ? (
              <img src={agent.imagen_perfil_url} alt={agentName || ''} className="w-14 h-14 rounded-2xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-7 h-7 text-slate-400" />
              </div>
            )}
            <div>
              <p className="font-bold text-slate-800">{agentName || office?.nombre}</p>
              {office?.nombre && agentName && <p className="text-slate-500 text-sm">{office.nombre}</p>}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {agent?.celular_laboral && (
              <a href={`tel:${agent.celular_laboral}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                <Phone className="w-4 h-4" />{agent.celular_laboral}
              </a>
            )}
            {agent?.email_laboral && (
              <a href={`mailto:${agent.email_laboral}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                <Mail className="w-4 h-4" />{agent.email_laboral}
              </a>
            )}
            {agent?.url_web_jiro && (
              <a href={agent.url_web_jiro} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                <Globe className="w-4 h-4" />Portal web
              </a>
            )}
            {office?.whatsapp && (
              <a href={`https://wa.me/${office.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </a>
            )}
            {office?.domicilio && (
              <div className="flex items-center gap-2 text-slate-600 sm:col-span-2">
                <MapPin className="w-4 h-4 text-slate-300" />{office.domicilio}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
