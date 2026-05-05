import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Building2, Cake, Award, ExternalLink,
  Settings, ClipboardList, UserPlus,
  MessageSquare, Package, Megaphone, ChevronRight
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import { UsuariosPendientes } from '../components/UsuariosPendientes';
import { ResumenVacaciones } from '../components/ResumenVacaciones';
import { ProximasReservas } from '../components/ProximasReservas';
import { TramitesWidget } from '../components/TramitesWidget';
import { ProximasCapacitaciones } from '../components/ProximasCapacitaciones';
import CalendarioEventos from '../components/CalendarioEventos';
import { UltimoComunicado } from '../components/UltimoComunicado';
import { getMiPaginaWebFull } from '../lib/webUrlUtils';
import { getOfficeLogo } from '../lib/logoUtils';
import MoviPreloader from '../components/MoviPreloader';
import { getSmartAnalysis } from '../lib/dashboardWelcomeService';
import type { SmartAnalysisResult } from '../lib/dashboardWelcomeService';
import { SmartAnalysisCard } from '../components/SmartAnalysisCard';
import { HomeDashboardSummary } from '../components/home/HomeDashboardSummary';
import { cn } from '@/lib/utils';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};

interface QuickActionProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  sublabel: string;
  onClick: () => void;
}

function QuickAction({ icon: Icon, iconColor, label, sublabel, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4 shadow-card hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-white/15 transition-all duration-200 ease-smooth group cursor-pointer text-left hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] w-full"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-xl", iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-white/20 group-hover:text-neutral-400 dark:group-hover:text-white/40 group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{label}</p>
      <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">{sublabel}</p>
    </button>
  );
}

interface KPICardProps {
  value: number | string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  onClick?: () => void;
}

function KPICard({ value, label, icon: Icon, iconColor, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 p-4 shadow-card transition-all duration-200 ease-smooth",
        onClick && "cursor-pointer hover:shadow-card-hover hover:border-neutral-300 dark:hover:border-white/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
      )}
    >
      <div className={cn("inline-flex p-2 rounded-xl mb-3", iconColor)}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { usuario: currentUser } = useAuth();
  const isAdmin = currentUser?.rol === 'Administrador';
  const isGerente = currentUser?.rol === 'Gerente';
  const isAdminOrGerente = isAdmin || isGerente;
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalOficinas, setTotalOficinas] = useState(0);
  const [proximosCumpleanos, setProximosCumpleanos] = useState<Usuario[]>([]);
  const [proximosAniversarios, setProximosAniversarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [birthdayFilter, setBirthdayFilter] = useState<'next_month' | 'custom'>('next_month');
  const [customBirthdayDate, setCustomBirthdayDate] = useState('');
  const [officeLogo, setOfficeLogo] = useState<string>('/logojiro.png');
  const [officeName, setOfficeName] = useState<string>('JIRO');
  const [analysisResult, setAnalysisResult] = useState<SmartAnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const isLoadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const renderCountRef = useRef(0);
  const initCountRef = useRef(0);

  useEffect(() => {
    renderCountRef.current++;

    if (!currentUser?.id) return;
    if (isLoadingRef.current) return;

    const userChanged = lastUserIdRef.current !== currentUser.id;
    if (!userChanged && lastUserIdRef.current) {
      if (isAdminOrGerente) {
        loadDashboardData();
      }
      return;
    }

    const initializeDashboard = async () => {
      initCountRef.current++;
      isLoadingRef.current = true;
      lastUserIdRef.current = currentUser.id;
      setLoading(true);
      const startTime = Date.now();

      try {
        await loadOfficeLogo();
        loadSmartAnalysis(currentUser.id);

        const shouldLoadData = currentUser.rol === 'Administrador' || currentUser.rol === 'Gerente';
        if (shouldLoadData) {
          await loadDashboardData();
        }

        const elapsedTime = Date.now() - startTime;
        const minDisplayTime = 800;
        if (elapsedTime < minDisplayTime) {
          await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsedTime));
        }
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    initializeDashboard();
  }, [birthdayFilter, customBirthdayDate, currentUser?.id]);

  const loadSmartAnalysis = async (userId: string, forceRegenerate = false) => {
    try {
      setLoadingAnalysis(true);
      const result = await getSmartAnalysis(userId, forceRegenerate);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error loading smart analysis:', error);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const loadOfficeLogo = async () => {
    if (!currentUser?.id) return;
    const logo = await getOfficeLogo(currentUser.id);
    setOfficeLogo(logo);

    const { data: userData } = await supabase
      .from('usuarios')
      .select('oficina_id, oficinas(nombre)')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (userData?.oficinas?.nombre) {
      setOfficeName(userData.oficinas.nombre.toUpperCase());
    }
  };

  const loadDashboardData = async () => {
    try {
      let usuariosQuery = supabase.from('usuarios').select('id', { count: 'exact', head: true });
      if (isGerente && currentUser?.oficina_id) {
        usuariosQuery = usuariosQuery.eq('oficina_id', currentUser.oficina_id);
      }

      const promises: Promise<any>[] = [
        usuariosQuery,
        getCumpleanos(),
        getAniversarios(),
      ];

      if (!isGerente) {
        promises.splice(1, 0, supabase.from('oficinas').select('id', { count: 'exact', head: true }));
      }

      const results = await Promise.all(promises);
      setTotalUsuarios(results[0].count || 0);
      if (!isGerente) {
        setTotalOficinas(results[1].count || 0);
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    }
  };

  const getCumpleanos = async () => {
    const today = new Date();
    let targetMonth: number;

    if (birthdayFilter === 'custom' && customBirthdayDate) {
      const customDate = new Date(customBirthdayDate);
      targetMonth = customDate.getMonth() + 1;
    } else {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      targetMonth = nextMonth.getMonth() + 1;
    }

    let query = supabase
      .from('usuarios')
      .select('*, oficinas(nombre)')
      .not('fecha_nacimiento', 'is', null)
      .order('fecha_nacimiento');

    if (isGerente && currentUser?.oficina_id) {
      query = query.eq('oficina_id', currentUser.oficina_id);
    }

    const { data } = await query;

    const filtered = data?.filter((usuario) => {
      if (!usuario.fecha_nacimiento) return false;
      const birthDate = new Date(usuario.fecha_nacimiento + 'T00:00:00');
      return birthDate.getMonth() + 1 === targetMonth;
    }) || [];

    setProximosCumpleanos(filtered);
    return filtered;
  };

  const getAniversarios = async () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const targetMonth = nextMonth.getMonth() + 1;

    let query = supabase
      .from('usuarios')
      .select('*, oficinas(nombre)')
      .not('fecha_ingreso', 'is', null)
      .order('fecha_ingreso');

    if (isGerente && currentUser?.oficina_id) {
      query = query.eq('oficina_id', currentUser.oficina_id);
    }

    const { data } = await query;

    const filtered = data?.filter((usuario) => {
      if (!usuario.fecha_ingreso) return false;
      const ingresoDate = new Date(usuario.fecha_ingreso + 'T00:00:00');
      return ingresoDate.getMonth() + 1 === targetMonth;
    }).map((usuario) => {
      const ingresoDate = new Date(usuario.fecha_ingreso! + 'T00:00:00');
      const years = today.getFullYear() - ingresoDate.getFullYear();
      return { ...usuario, yearsOfService: years };
    }) || [];

    setProximosAniversarios(filtered as any);
    return filtered;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate + 'T00:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age + 1;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-[2.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Welcome banner shared by both views
  const WelcomeBanner = () => (
    <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Hola, <span className="text-accent">{currentUser?.nombre}</span>
          </h1>
          <p className="text-sm text-neutral-500 dark:text-white/40 mt-0.5 font-medium">
            {officeName}
          </p>
        </div>
        <img
          src={officeLogo}
          alt="Logo oficina"
          className="h-10 w-auto object-contain flex-shrink-0 ml-4"
        />
      </div>

      <SmartAnalysisCard
        result={analysisResult}
        loading={loadingAnalysis}
        onRefresh={() => currentUser?.id && loadSmartAnalysis(currentUser.id, true)}
        userName={currentUser?.nombre_completo?.split(' ')[0]}
      />

      {currentUser?.web_slug && (
        <div className="mt-4">
          <a
            href={getMiPaginaWebFull(currentUser.web_slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-medium text-sm hover:bg-accent-hover transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Mi Pagina Web
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );

  // Non-admin/gerente view
  if (!isAdminOrGerente) {
    return (
      <div className="space-y-4">
        <WelcomeBanner />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction
            icon={ClipboardList}
            iconColor="bg-accent/8 dark:bg-accent/15 text-accent"
            label="Tramites"
            sublabel="Ver todos"
            onClick={() => navigate('/tramites')}
          />
          <QuickAction
            icon={UserPlus}
            iconColor="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
            label="Mi CRM"
            sublabel="Gestionar contactos"
            onClick={() => navigate('/mi-crm')}
          />
          <QuickAction
            icon={Megaphone}
            iconColor="bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400"
            label="Mercadotecnia"
            sublabel="Mi marca y web"
            onClick={() => navigate('/mercadotecnia')}
          />
          <QuickAction
            icon={() => (
              <img src="/movirecurso_11.png" alt="Seguros Education" className="w-5 h-5 object-contain" />
            )}
            iconColor="bg-neutral-50 dark:bg-white/8"
            label="Seguros Education"
            sublabel="Capacitacion"
            onClick={() => navigate('/seguros-education')}
          />
        </div>

        {currentUser?.id && <HomeDashboardSummary userId={currentUser.id} />}

        <UltimoComunicado />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CalendarioEventos />
          <ProximasCapacitaciones />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TramitesWidget />
          <ResumenVacaciones />
          <ProximasReservas />
        </div>
      </div>
    );
  }

  // Admin/Gerente view
  return (
    <>
      <MoviPreloader
        isOpen={loading}
        userName={currentUser?.nombre || 'Usuario'}
        subtitle="Preparando tu Dashboard..."
        logoIconUrl="/logojiro.png"
        minDurationMs={800}
      />
      <div className="space-y-4">
        <WelcomeBanner />

        {/* KPI cards */}
        <div className={cn("grid gap-3", isGerente ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
          <KPICard
            value={totalUsuarios}
            label={isGerente ? 'Usuarios' : 'Total usuarios'}
            icon={Users}
            iconColor="bg-accent/8 dark:bg-accent/15 text-accent"
            onClick={() => navigate('/directorio')}
          />
          {!isGerente && (
            <KPICard
              value={totalOficinas}
              label="Oficinas"
              icon={Building2}
              iconColor="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              onClick={() => navigate('/oficinas')}
            />
          )}
          <KPICard
            value={proximosCumpleanos.length}
            label="Cumpleanos proximos"
            icon={Cake}
            iconColor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
          />
          <KPICard
            value={proximosAniversarios.length}
            label="Aniversarios"
            icon={Award}
            iconColor="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction
            icon={ClipboardList}
            iconColor="bg-accent/8 dark:bg-accent/15 text-accent"
            label="Tramites"
            sublabel="Ver todos"
            onClick={() => navigate('/tramites')}
          />
          <QuickAction
            icon={UserPlus}
            iconColor="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400"
            label="Mi CRM"
            sublabel="Gestionar contactos"
            onClick={() => navigate('/mi-crm')}
          />
          <QuickAction
            icon={Megaphone}
            iconColor="bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400"
            label="Mercadotecnia"
            sublabel="Mi marca y web"
            onClick={() => navigate('/mercadotecnia')}
          />
          <QuickAction
            icon={() => (
              <img src="/movirecurso_11.png" alt="Seguros Education" className="w-5 h-5 object-contain" />
            )}
            iconColor="bg-neutral-50 dark:bg-white/8"
            label="Seguros Education"
            sublabel="Capacitacion"
            onClick={() => navigate('/seguros-education')}
          />
        </div>

        {/* Admin-only config shortcuts */}
        {currentUser?.rol === 'Administrador' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <QuickAction
              icon={Settings}
              iconColor="bg-accent/8 dark:bg-accent/15 text-accent"
              label="Config Produccion"
              sublabel="Google Sheets"
              onClick={() => navigate('/produccion/configuracion')}
            />
            <QuickAction
              icon={Package}
              iconColor="bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400"
              label="Mapeo Vendedores"
              sublabel="Vincular usuarios"
              onClick={() => navigate('/mapeo-vendedores')}
            />
            <QuickAction
              icon={MessageSquare}
              iconColor="bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"
              label="Notificaciones"
              sublabel="Configurar plantillas"
              onClick={() => navigate('/notificaciones-transaccionales')}
            />
          </div>
        )}

        {currentUser?.id && <HomeDashboardSummary userId={currentUser.id} />}

        <UltimoComunicado />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CalendarioEventos />
          <ProximasCapacitaciones />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TramitesWidget />
          <ResumenVacaciones />
          <ProximasReservas />
        </div>

        {currentUser?.rol === 'Administrador' && <UsuariosPendientes />}

        {/* Birthdays & Anniversaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Birthdays */}
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15">
                    <Cake className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Proximos Cumpleanos</h2>
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={birthdayFilter}
                  onChange={(e) => setBirthdayFilter(e.target.value as 'next_month' | 'custom')}
                  className="bg-neutral-50 dark:bg-white/5 rounded-lg px-3 py-1.5 text-xs font-medium border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                >
                  <option value="next_month">Siguiente mes</option>
                  <option value="custom">Personalizado</option>
                </select>
                {birthdayFilter === 'custom' && (
                  <input
                    type="month"
                    value={customBirthdayDate}
                    onChange={(e) => setCustomBirthdayDate(e.target.value)}
                    className="bg-neutral-50 dark:bg-white/5 rounded-lg px-3 py-1.5 text-xs border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                  />
                )}
              </div>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {proximosCumpleanos.length === 0 ? (
                <p className="text-neutral-400 dark:text-white/30 text-center py-8 text-sm">No hay cumpleanos proximos</p>
              ) : (
                <div className="space-y-1.5">
                  {proximosCumpleanos.map((usuario) => (
                    <button
                      key={usuario.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left group"
                      onClick={() => navigate(`/usuario/${usuario.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {usuario.nombre[0]}{usuario.apellidos[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                            {usuario.nombre} {usuario.apellidos}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-white/40 truncate">{usuario.puesto}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                          {formatDate(usuario.fecha_nacimiento!)}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-white/40">
                          {calculateAge(usuario.fecha_nacimiento!)} anos
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Anniversaries */}
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/15">
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Aniversarios Laborales</h2>
                  <p className="text-xs text-neutral-500 dark:text-white/40">Siguiente mes</p>
                </div>
              </div>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {proximosAniversarios.length === 0 ? (
                <p className="text-neutral-400 dark:text-white/30 text-center py-8 text-sm">No hay aniversarios proximos</p>
              ) : (
                <div className="space-y-1.5">
                  {proximosAniversarios.map((usuario: any) => (
                    <button
                      key={usuario.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left group"
                      onClick={() => navigate(`/usuario/${usuario.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {usuario.nombre[0]}{usuario.apellidos[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-white text-sm truncate">
                            {usuario.nombre} {usuario.apellidos}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-white/40 truncate">{usuario.puesto}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {formatDate(usuario.fecha_ingreso!)}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-white/40">
                          {usuario.yearsOfService} {usuario.yearsOfService === 1 ? 'ano' : 'anos'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
