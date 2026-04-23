import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Building2, Cake, Award, ExternalLink,
  Settings, ClipboardList, UserPlus,
  MessageSquare, Package, Megaphone
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
    console.log(`🔄 Dashboard useEffect disparado (render #${renderCountRef.current})`, {
      userId: currentUser?.id,
      birthdayFilter,
      customBirthdayDate,
      isLoading: isLoadingRef.current,
      lastUserId: lastUserIdRef.current
    });

    // Evitar re-ejecuciones innecesarias
    if (!currentUser?.id) {
      console.log('⏸️ No hay usuario, saltando inicialización');
      return;
    }

    if (isLoadingRef.current) {
      console.log('🔒 Dashboard ya está cargando, omitiendo ejecución duplicada');
      return;
    }

    // Si es el mismo usuario y no cambiaron los filtros, no recargar
    const userChanged = lastUserIdRef.current !== currentUser.id;
    if (!userChanged && lastUserIdRef.current) {
      // Solo recargar si cambiaron los filtros de cumpleaños
      console.log('👤 Mismo usuario, solo recargando datos de cumpleaños');
      if (isAdminOrGerente) {
        loadDashboardData();
      }
      return;
    }

    const initializeDashboard = async () => {
      initCountRef.current++;
      console.log(`🚀 Inicializando Dashboard (init #${initCountRef.current}) para usuario:`, currentUser.id);
      isLoadingRef.current = true;
      lastUserIdRef.current = currentUser.id;
      setLoading(true);
      const startTime = Date.now();

      try {
        await loadOfficeLogo();
        loadSmartAnalysis(currentUser.id);

        // Cargar datos solo si es admin o gerente
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
        console.log('✅ Dashboard inicializado');
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

    // Cargar logo y nombre de oficina
    const logo = await getOfficeLogo(currentUser.id);
    setOfficeLogo(logo);

    // Obtener nombre de oficina
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
        <div className="w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdminOrGerente) {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-accent">
                  Hola, {currentUser?.nombre}
                </h1>
                <p className="text-sm text-gray-600 mt-0.5 font-semibold">
                  {officeName}
                </p>
              </div>
            </div>
            <img
              src={officeLogo}
              alt="Logo oficina"
              className="h-12 w-auto object-contain"
            />
          </div>

          <div className="mb-4">
            <SmartAnalysisCard
              result={analysisResult}
              loading={loadingAnalysis}
              onRefresh={() => currentUser?.id && loadSmartAnalysis(currentUser.id, true)}
              userName={currentUser?.nombre_completo?.split(' ')[0]}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUser?.web_slug ? (
              <a
                href={getMiPaginaWebFull(currentUser.web_slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
              >
                Mi Página Web
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
                Mi Página Web
                <ExternalLink className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => navigate('/tramites')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Tramites</p>
            <p className="text-xs text-gray-600 mt-1">Ver todos</p>
          </div>

          <div
            onClick={() => navigate('/mi-crm')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Mi CRM</p>
            <p className="text-xs text-gray-600 mt-1">Gestionar contactos</p>
          </div>

          <div
            onClick={() => navigate('/mercadotecnia')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Megaphone className="w-8 h-8 text-teal-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Mercadotecnia</p>
            <p className="text-xs text-gray-600 mt-1">Mi marca y web</p>
          </div>

          <div
            onClick={() => navigate('/seguros-education')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <img
                src="/movirecurso_11.png"
                alt="Seguros Education"
                className="w-8 h-8 object-contain group-hover:scale-110 transition-transform"
              />
            </div>
            <p className="text-sm font-semibold text-gray-900">Seguros Education</p>
            <p className="text-xs text-gray-600 mt-1">Capacitacion</p>
          </div>
        </div>

        <UltimoComunicado />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CalendarioEventos />
          <ProximasCapacitaciones />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <TramitesWidget />
          <ResumenVacaciones />
          <ProximasReservas />
        </div>
      </div>
    );
  }

  return (
    <>
      <MoviPreloader
        isOpen={loading}
        userName={currentUser?.nombre || 'Usuario'}
        subtitle="Preparando tu Dashboard…"
        logoIconUrl="/logojiro.png"
        minDurationMs={800}
      />
      <div className="space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-accent">
                Hola, {currentUser?.nombre}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5 font-semibold">
                {officeName}
              </p>
            </div>
            <img
              src={officeLogo}
              alt="Logo oficina"
              className="h-12 w-auto object-contain"
            />
          </div>

          <div className="mt-4">
            <SmartAnalysisCard
              result={analysisResult}
              loading={loadingAnalysis}
              onRefresh={() => currentUser?.id && loadSmartAnalysis(currentUser.id, true)}
              userName={currentUser?.nombre_completo?.split(' ')[0]}
            />
          </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {currentUser?.web_slug ? (
            <a
              href={getMiPaginaWebFull(currentUser.web_slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              Mi Página Web
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
              Mi Página Web
              <ExternalLink className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => navigate('/directorio')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUsuarios}</p>
          <p className="text-xs text-gray-600 mt-1">
            {isGerente ? 'Usuarios' : 'Total usuarios'}
          </p>
        </div>

        {!isGerente && (
          <div
            onClick={() => navigate('/oficinas')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Building2 className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalOficinas}</p>
            <p className="text-xs text-gray-600 mt-1">Oficinas</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <Cake className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{proximosCumpleanos.length}</p>
          <p className="text-xs text-gray-600 mt-1">Cumpleaños próximos</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{proximosAniversarios.length}</p>
          <p className="text-xs text-gray-600 mt-1">Aniversarios</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => navigate('/tramites')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <ClipboardList className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Tramites</p>
          <p className="text-xs text-gray-600 mt-1">Ver todos</p>
        </div>

        <div
          onClick={() => navigate('/mi-crm')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <UserPlus className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Mi CRM</p>
          <p className="text-xs text-gray-600 mt-1">Gestionar contactos</p>
        </div>

        <div
          onClick={() => navigate('/mercadotecnia')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Megaphone className="w-8 h-8 text-teal-600 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Mercadotecnia</p>
          <p className="text-xs text-gray-600 mt-1">Mi marca y web</p>
        </div>

        <div
          onClick={() => navigate('/seguros-education')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <img
              src="/movirecurso_11.png"
              alt="Seguros Education"
              className="w-8 h-8 object-contain group-hover:scale-110 transition-transform"
            />
          </div>
          <p className="text-sm font-semibold text-gray-900">Seguros Education</p>
          <p className="text-xs text-gray-600 mt-1">Capacitacion</p>
        </div>
      </div>

      {currentUser?.rol === 'Administrador' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div
            onClick={() => navigate('/produccion/configuracion')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Settings className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Config Producción</p>
            <p className="text-xs text-gray-600 mt-1">Google Sheets</p>
          </div>

          <div
            onClick={() => navigate('/mapeo-vendedores')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Mapeo Vendedores</p>
            <p className="text-xs text-gray-600 mt-1">Vincular usuarios</p>
          </div>

          <div
            onClick={() => navigate('/notificaciones-transaccionales')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-8 h-8 text-pink-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
            <p className="text-xs text-gray-600 mt-1">Configurar plantillas</p>
          </div>
        </div>
      )}

      <UltimoComunicado />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CalendarioEventos />
        <ProximasCapacitaciones />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TramitesWidget />
        <ResumenVacaciones />
        <ProximasReservas />
      </div>

      {currentUser?.rol === 'Administrador' && <UsuariosPendientes />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-4 border-b border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Próximos Cumpleaños</h2>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={birthdayFilter}
                onChange={(e) => setBirthdayFilter(e.target.value as 'next_month' | 'custom')}
                className="bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:border-purple-500"
              >
                <option value="next_month">Siguiente mes</option>
                <option value="custom">Personalizado</option>
              </select>
              {birthdayFilter === 'custom' && (
                <input
                  type="month"
                  value={customBirthdayDate}
                  onChange={(e) => setCustomBirthdayDate(e.target.value)}
                  className="bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:border-purple-500"
                />
              )}
            </div>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {proximosCumpleanos.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">No hay cumpleaños próximos</p>
            ) : (
              <div className="space-y-2">
                {proximosCumpleanos.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/usuario/${usuario.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-xs text-gray-600">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-purple-600">
                        {formatDate(usuario.fecha_nacimiento!)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {calculateAge(usuario.fecha_nacimiento!)} años
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 px-5 py-4 border-b border-orange-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Aniversarios Laborales</h2>
            </div>
            <p className="text-xs text-gray-600 mt-1">Siguiente mes</p>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {proximosAniversarios.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">No hay aniversarios próximos</p>
            ) : (
              <div className="space-y-2">
                {proximosAniversarios.map((usuario: any) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/usuario/${usuario.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-xs text-gray-600">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-600">
                        {formatDate(usuario.fecha_ingreso!)}
                      </p>
                      <p className="text-xs text-gray-600">
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
    </>
  );
}
