import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, Hop as Home, FileText, CreditCard, FolderOpen, User, LogOut, Sparkles, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/seguwallet/dashboard', icon: Home, label: 'Inicio' },
  { to: '/seguwallet/polizas', icon: FileText, label: 'Mis Pólizas' },
  { to: '/seguwallet/cobranza', icon: CreditCard, label: 'Pagos' },
  { to: '/seguwallet/documentos', icon: FolderOpen, label: 'Documentos' },
  { to: '/seguwallet/chava', icon: Sparkles, label: 'Chava' },
  { to: '/seguwallet/perfil', icon: User, label: 'Mi Perfil' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { customer, agent, office, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const accentColor = office?.accent_color || '#0F4C81';
  const logoUrl = office?.logo_url || null;
  const agentName = agent ? `${agent.nombre} ${agent.apellidos}` : office?.nombre || 'Seguwallet';

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-slate-100"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {logoUrl ? (
              <img src={logoUrl} alt={agentName} className="h-7 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6" style={{ color: accentColor }} />
                <span className="font-bold text-slate-800 text-sm">{agentName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {customer && (
              <span className="hidden sm:block text-sm text-slate-600 font-medium">
                {customer.full_name}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl mx-auto w-full">
        {/* Sidebar */}
        <aside className={`
          fixed md:sticky top-14 left-0 h-[calc(100vh-3.5rem)] z-30
          w-56 bg-white border-r border-slate-200 flex flex-col py-4
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <nav className="flex-1 px-3 space-y-0.5">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                style={({ isActive }) => isActive ? { backgroundColor: accentColor } : {}}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${label === 'Chava' && !isActive ? 'text-emerald-500' : ''}`} />
                    {label}
                    {label === 'Chava' && (
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                      }`}>IA</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {agent && (
            <div className="mx-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400 mb-1">Tu agente</p>
              {agent.imagen_perfil_url && (
                <img src={agent.imagen_perfil_url} alt={agentName} className="w-8 h-8 rounded-full mb-1.5 object-cover" />
              )}
              <p className="text-xs font-semibold text-slate-700 leading-snug">{agentName}</p>
              {agent.celular_laboral && (
                <p className="text-xs text-slate-400 mt-0.5">{agent.celular_laboral}</p>
              )}
            </div>
          )}
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
