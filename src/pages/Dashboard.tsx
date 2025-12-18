import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Building2, Calendar, Cake, Award, ExternalLink, Sparkles, TrendingUp, Settings } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { UsuariosPendientes } from '../components/UsuariosPendientes';
import { ResumenVacaciones } from '../components/ResumenVacaciones';
import { ProximasReservas } from '../components/ProximasReservas';
import { TramitesWidget } from '../components/TramitesWidget';
import { ProximasCapacitaciones } from '../components/ProximasCapacitaciones';
import CalendarioEventos from '../components/CalendarioEventos';
import { UltimoComunicado } from '../components/UltimoComunicado';
import RankingVendedor from '../components/RankingVendedor';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};

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

  useEffect(() => {
    if (isAdminOrGerente) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [birthdayFilter, customBirthdayDate, isAdminOrGerente]);

  const loadDashboardData = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const getCumpleanos = async () => {
    const today = new Date();
    let targetMonth: number;
    let targetYear: number;

    if (birthdayFilter === 'custom' && customBirthdayDate) {
      const customDate = new Date(customBirthdayDate);
      targetMonth = customDate.getMonth() + 1;
      targetYear = customDate.getFullYear();
    } else {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      targetMonth = nextMonth.getMonth() + 1;
      targetYear = nextMonth.getFullYear();
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
      const birthDate = new Date(usuario.fecha_nacimiento);
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
      const ingresoDate = new Date(usuario.fecha_ingreso);
      return ingresoDate.getMonth() + 1 === targetMonth;
    }).map((usuario) => {
      const ingresoDate = new Date(usuario.fecha_ingreso!);
      const years = today.getFullYear() - ingresoDate.getFullYear();
      return { ...usuario, yearsOfService: years };
    }) || [];

    setProximosAniversarios(filtered as any);
    return filtered;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
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
        <div className="w-10 h-10 border-[3px] border-ios-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdminOrGerente) {
    return (
      <div className="space-y-4 md:space-y-5">
        <div className="bg-white rounded-2xl md:rounded-ios-2xl shadow-ios-lg p-6 md:p-8 lg:p-10 border border-ios-gray-200/50">
          <div className="flex flex-col space-y-2 mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-ios-blue"></div>
              <span className="text-xs md:text-[13px] font-medium text-ios-gray-600 uppercase tracking-wide">Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-[34px] font-bold text-ios-gray-900 tracking-tight leading-tight">
              Hola, {currentUser?.nombre}
            </h1>
            <p className="text-sm md:text-base lg:text-[17px] text-ios-gray-600 leading-relaxed">
              Resumen de tus actividades
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
            {currentUser?.url_web_multicotizador ? (
              <a
                href={currentUser.url_web_multicotizador}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir Multicotizador Digital"
                className="flex items-center justify-center space-x-2 bg-ios-blue text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] hover:bg-ios-blue-dark shadow-ios transition-all duration-200 active:scale-95 w-full sm:w-auto"
              >
                <span className="truncate">Multicotizador Digital</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </a>
            ) : (
              <div
                title="URL no configurada"
                aria-label="Multicotizador Digital - URL no configurada"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] cursor-not-allowed opacity-60 w-full sm:w-auto"
              >
                <span className="truncate">Multicotizador Digital</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </div>
            )}
            {currentUser?.url_web_jiro ? (
              <a
                href={currentUser.url_web_jiro}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir Página Web de Contacto"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-900 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] hover:bg-ios-gray-200 transition-all duration-200 active:scale-95 w-full sm:w-auto"
              >
                <span className="truncate">Página web de contacto</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </a>
            ) : (
              <div
                title="URL no configurada"
                aria-label="Página Web de Contacto - URL no configurada"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] cursor-not-allowed opacity-60 w-full sm:w-auto"
              >
                <span className="truncate">Página web de contacto</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/seguros-education"
            className="group relative bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden transition-all duration-200 hover:shadow-ios-lg active:scale-[0.98]"
          >
            <div className="aspect-[16/9] w-full flex items-center justify-center bg-ios-gray-50 p-8">
              <img
                src="https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png"
                alt="Seguros Education"
                className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </div>
            <div className="px-5 py-4 border-t border-ios-gray-200/50">
              <h3 className="text-ios-gray-900 text-[17px] font-semibold">
                Seguros Education
              </h3>
              <p className="text-ios-gray-600 text-[13px] mt-1">Plataforma de capacitación</p>
            </div>
          </a>

          <a
            href="/multicotizador-digital"
            className="group relative bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden transition-all duration-200 hover:shadow-ios-lg active:scale-[0.98]"
          >
            <div className="aspect-[16/9] w-full flex items-center justify-center bg-ios-gray-50 p-8">
              <img
                src="https://movi.digital/wp-content/uploads/2025/02/Logo_MCD_v1-1.png"
                alt="Multicotizador Digital"
                className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </div>
            <div className="px-5 py-4 border-t border-ios-gray-200/50">
              <h3 className="text-ios-gray-900 text-[17px] font-semibold">
                Multicotizador Digital
              </h3>
              <p className="text-ios-gray-600 text-[13px] mt-1">Herramienta de cotización</p>
            </div>
          </a>
        </div>

        <RankingVendedor />

        <UltimoComunicado />

        <CalendarioEventos />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResumenVacaciones />
          <TramitesWidget />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProximasReservas />
          <ProximasCapacitaciones />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="bg-white rounded-2xl md:rounded-ios-2xl shadow-ios-lg p-6 md:p-8 lg:p-10 border border-ios-gray-200/50">
        <div className="flex flex-col space-y-2 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-ios-blue"></div>
            <span className="text-xs md:text-[13px] font-medium text-ios-gray-600 uppercase tracking-wide">Dashboard</span>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-[34px] font-bold text-ios-gray-900 tracking-tight leading-tight">
            Hola, {currentUser?.nombre}
          </h1>
          <p className="text-sm md:text-base lg:text-[17px] text-ios-gray-600 leading-relaxed">
            Panel de administración
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
            {currentUser?.url_web_multicotizador ? (
              <a
                href={currentUser.url_web_multicotizador}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir Multicotizador Digital"
                className="flex items-center justify-center space-x-2 bg-ios-blue text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] hover:bg-ios-blue-dark shadow-ios transition-all duration-200 active:scale-95 w-full sm:w-auto"
              >
                <span className="truncate">Multicotizador Digital</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </a>
            ) : (
              <div
                title="URL no configurada"
                aria-label="Multicotizador Digital - URL no configurada"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] cursor-not-allowed opacity-60 w-full sm:w-auto"
              >
                <span className="truncate">Multicotizador Digital</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </div>
            )}
            {currentUser?.url_web_jiro ? (
              <a
                href={currentUser.url_web_jiro}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir Página Web de Contacto"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-900 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] hover:bg-ios-gray-200 transition-all duration-200 active:scale-95 w-full sm:w-auto"
              >
                <span className="truncate">Página web de contacto</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </a>
            ) : (
              <div
                title="URL no configurada"
                aria-label="Página Web de Contacto - URL no configurada"
                className="flex items-center justify-center space-x-2 bg-ios-gray-100 text-ios-gray-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-ios-lg font-medium text-sm sm:text-[15px] cursor-not-allowed opacity-60 w-full sm:w-auto"
              >
                <span className="truncate">Página web de contacto</span>
                <ExternalLink className="w-4 h-4 stroke-[2] flex-shrink-0" />
              </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/seguros-education"
          className="group relative bg-white rounded-xl md:rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden transition-all duration-200 hover:shadow-ios-lg active:scale-[0.98]"
        >
          <div className="aspect-[16/9] w-full flex items-center justify-center bg-ios-gray-50 p-8">
            <img
              src="https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png"
              alt="Seguros Education"
              className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div className="px-5 py-4 border-t border-ios-gray-200/50">
            <h3 className="text-ios-gray-900 text-[17px] font-semibold">
              Seguros Education
            </h3>
            <p className="text-ios-gray-600 text-[13px] mt-1">Plataforma de capacitación</p>
          </div>
        </a>

        <a
          href="/multicotizador-digital"
          className="group relative bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden transition-all duration-200 hover:shadow-ios-lg active:scale-[0.98]"
        >
          <div className="aspect-[16/9] w-full flex items-center justify-center bg-ios-gray-50 p-8">
            <img
              src="https://movi.digital/wp-content/uploads/2025/02/Logo_MCD_v1-1.png"
              alt="Multicotizador Digital"
              className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div className="px-5 py-4 border-t border-ios-gray-200/50">
            <h3 className="text-ios-gray-900 text-[17px] font-semibold">
              Multicotizador Digital
            </h3>
            <p className="text-ios-gray-600 text-[13px] mt-1">Herramienta de cotización</p>
          </div>
        </a>
      </div>

      <CalendarioEventos />

      <UltimoComunicado />

      {currentUser?.rol === 'Administrador' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate('/produccion/configuracion')}
            className="group bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-6 cursor-pointer hover:shadow-ios-lg active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-ios bg-blue-100 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-blue-600 stroke-[2]" />
                  </div>
                  <h3 className="text-[20px] font-semibold text-ios-gray-900">Configurar Producción</h3>
                </div>
                <p className="text-[15px] text-ios-gray-600 mb-4">
                  Conecta tu hoja de Google Sheets con datos de producción
                </p>
                <p className="text-blue-600 text-[15px] font-medium group-hover:translate-x-1 transition-transform">
                  Configurar →
                </p>
              </div>
              <TrendingUp className="w-16 h-16 text-green-600/10 stroke-[1.5] ml-4" />
            </div>
          </div>

          <div
            onClick={() => navigate('/produccion/total')}
            className="group bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-6 cursor-pointer hover:shadow-ios-lg active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-ios bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600 stroke-[2]" />
                  </div>
                  <h3 className="text-[20px] font-semibold text-ios-gray-900">Producción Total</h3>
                </div>
                <p className="text-[15px] text-ios-gray-600 mb-4">
                  Consulta métricas y reportes de producción
                </p>
                <p className="text-blue-600 text-[15px] font-medium group-hover:translate-x-1 transition-transform">
                  Ver reportes →
                </p>
              </div>
              <TrendingUp className="w-16 h-16 text-blue-600/10 stroke-[1.5] ml-4" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TramitesWidget />
        <ProximasCapacitaciones />
      </div>

      <ResumenVacaciones />

      {currentUser?.rol === 'Administrador' && <UsuariosPendientes />}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isGerente ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 md:gap-4`}>
        <div
          onClick={() => navigate('/directorio')}
          className="bg-white rounded-xl md:rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-5 md:p-6 cursor-pointer hover:shadow-ios-lg active:scale-[0.98] transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-ios-gray-600 text-xs md:text-[13px] font-medium uppercase tracking-wide truncate">
                {isGerente ? 'Usuarios en mi Oficina' : 'Total Usuarios'}
              </p>
              <p className="text-3xl md:text-4xl lg:text-[44px] font-bold mt-2 text-ios-gray-900 tracking-tight leading-none">{totalUsuarios}</p>
              <p className="text-ios-blue text-sm md:text-[15px] mt-3 md:mt-4 font-medium">Ver usuarios →</p>
            </div>
            <Users className="w-12 h-12 md:w-14 md:h-14 text-ios-blue/20 stroke-[1.5] flex-shrink-0 ml-2" />
          </div>
        </div>

        {!isGerente && (
          <div
            onClick={() => navigate('/oficinas')}
            className="bg-white rounded-xl md:rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-5 md:p-6 cursor-pointer hover:shadow-ios-lg active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-ios-gray-600 text-xs md:text-[13px] font-medium uppercase tracking-wide truncate">Total Oficinas</p>
                <p className="text-3xl md:text-4xl lg:text-[44px] font-bold mt-2 text-ios-gray-900 tracking-tight leading-none">{totalOficinas}</p>
                <p className="text-ios-green text-sm md:text-[15px] mt-3 md:mt-4 font-medium">Gestionar oficinas →</p>
              </div>
              <Building2 className="w-12 h-12 md:w-14 md:h-14 text-ios-green/20 stroke-[1.5] flex-shrink-0 ml-2" />
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl md:rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-ios-gray-600 text-xs md:text-[13px] font-medium uppercase tracking-wide truncate">Próximos Cumpleaños</p>
              <p className="text-3xl md:text-4xl lg:text-[44px] font-bold mt-2 text-ios-gray-900 tracking-tight leading-none">{proximosCumpleanos.length}</p>
              <p className="text-ios-gray-600 text-sm md:text-[15px] mt-3 md:mt-4 truncate">En el siguiente mes</p>
            </div>
            <Cake className="w-12 h-12 md:w-14 md:h-14 text-ios-purple/20 stroke-[1.5] flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-ios-gray-600 text-xs md:text-[13px] font-medium uppercase tracking-wide truncate">Aniversarios Laborales</p>
              <p className="text-3xl md:text-4xl lg:text-[44px] font-bold mt-2 text-ios-gray-900 tracking-tight leading-none">{proximosAniversarios.length}</p>
              <p className="text-ios-gray-600 text-sm md:text-[15px] mt-3 md:mt-4 truncate">En el siguiente mes</p>
            </div>
            <Award className="w-12 h-12 md:w-14 md:h-14 text-ios-orange/20 stroke-[1.5] flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden">
          <div className="bg-ios-gray-50 px-6 py-5 border-b border-ios-gray-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-ios bg-ios-purple/10 flex items-center justify-center">
                  <Cake className="w-5 h-5 text-ios-purple stroke-[1.5]" />
                </div>
                <h2 className="text-[20px] font-semibold text-ios-gray-900">Próximos Cumpleaños</h2>
              </div>
              <Calendar className="w-5 h-5 text-ios-gray-500 stroke-[1.5]" />
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={birthdayFilter}
                onChange={(e) => setBirthdayFilter(e.target.value as 'next_month' | 'custom')}
                className="bg-white text-ios-gray-900 font-medium rounded-ios-lg px-3 py-2 text-[15px] border border-ios-gray-300 focus:outline-none focus:border-ios-blue transition-colors"
              >
                <option value="next_month">Siguiente mes</option>
                <option value="custom">Fecha personalizada</option>
              </select>
              {birthdayFilter === 'custom' && (
                <input
                  type="month"
                  value={customBirthdayDate}
                  onChange={(e) => setCustomBirthdayDate(e.target.value)}
                  className="bg-white text-ios-gray-900 font-medium rounded-ios-lg px-3 py-2 text-[15px] border border-ios-gray-300 focus:outline-none focus:border-ios-blue transition-colors"
                />
              )}
            </div>
          </div>
          <div className="p-5">
            {proximosCumpleanos.length === 0 ? (
              <p className="text-ios-gray-500 text-center py-12 text-[15px]">No hay cumpleaños próximos</p>
            ) : (
              <div className="space-y-2">
                {proximosCumpleanos.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-ios-lg hover:bg-ios-gray-100 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/usuario/${usuario.id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-ios-purple flex items-center justify-center text-white font-semibold text-[15px]">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-ios-gray-900 text-[15px]">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-[13px] text-ios-gray-600">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-semibold text-ios-purple">
                        {formatDate(usuario.fecha_nacimiento!)}
                      </p>
                      <p className="text-[13px] text-ios-gray-600">
                        {calculateAge(usuario.fecha_nacimiento!)} años
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-ios-xl shadow-ios-md border border-ios-gray-200/50 overflow-hidden">
          <div className="bg-ios-gray-50 px-6 py-5 border-b border-ios-gray-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-ios bg-ios-orange/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-ios-orange stroke-[1.5]" />
                </div>
                <h2 className="text-[20px] font-semibold text-ios-gray-900">Aniversarios Laborales</h2>
              </div>
              <Calendar className="w-5 h-5 text-ios-gray-500 stroke-[1.5]" />
            </div>
            <p className="text-ios-gray-600 text-[13px] mt-2">Siguiente mes</p>
          </div>
          <div className="p-5">
            {proximosAniversarios.length === 0 ? (
              <p className="text-ios-gray-500 text-center py-12 text-[15px]">No hay aniversarios próximos</p>
            ) : (
              <div className="space-y-2">
                {proximosAniversarios.map((usuario: any) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-4 bg-ios-gray-50 rounded-ios-lg hover:bg-ios-gray-100 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/usuario/${usuario.id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-ios-orange flex items-center justify-center text-white font-semibold text-[15px]">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-ios-gray-900 text-[15px]">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-[13px] text-ios-gray-600">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-semibold text-ios-orange">
                        {formatDate(usuario.fecha_ingreso!)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {usuario.yearsOfService} {usuario.yearsOfService === 1 ? 'año' : 'años'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
