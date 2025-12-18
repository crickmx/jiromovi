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
      <div className="space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Hola, {currentUser?.nombre}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Resumen de tus actividades
              </p>
            </div>
            <Sparkles className="w-8 h-8 text-blue-500" />
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUser?.url_web_multicotizador ? (
              <a
                href={currentUser.url_web_multicotizador}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                Multicotizador Digital
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
                Multicotizador Digital
                <ExternalLink className="w-4 h-4" />
              </div>
            )}

            {currentUser?.url_web_jiro ? (
              <a
                href={currentUser.url_web_jiro}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Página web de contacto
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
                Página web de contacto
                <ExternalLink className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="/seguros-education"
            className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-gray-50 flex items-center justify-center p-6">
              <img
                src="https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png"
                alt="Seguros Education"
                className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="p-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 text-base">Seguros Education</h3>
              <p className="text-sm text-gray-600 mt-0.5">Plataforma de capacitación</p>
            </div>
          </a>

          <a
            href="/multicotizador-digital"
            className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-gray-50 flex items-center justify-center p-6">
              <img
                src="https://movi.digital/wp-content/uploads/2025/02/Logo_MCD_v1-1.png"
                alt="Multicotizador Digital"
                className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="p-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 text-base">Multicotizador Digital</h3>
              <p className="text-sm text-gray-600 mt-0.5">Herramienta de cotización</p>
            </div>
          </a>
        </div>

        <UltimoComunicado />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CalendarioEventos />
          <ProximasCapacitaciones />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ResumenVacaciones />
          <TramitesWidget />
        </div>

        <ProximasReservas />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hola, {currentUser?.nombre}
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Panel de {isGerente ? 'gerencia' : 'administración'}
            </p>
          </div>
          <Settings className="w-8 h-8 text-blue-500" />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {currentUser?.url_web_multicotizador ? (
            <a
              href={currentUser.url_web_multicotizador}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              Multicotizador Digital
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
              Multicotizador Digital
              <ExternalLink className="w-4 h-4" />
            </div>
          )}

          {currentUser?.url_web_jiro ? (
            <a
              href={currentUser.url_web_jiro}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Página web de contacto
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2 rounded-lg font-medium text-sm cursor-not-allowed">
              Página web de contacto
              <ExternalLink className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => navigate('/directorio')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUsuarios}</p>
          <p className="text-xs text-gray-600 mt-1">
            {isGerente ? 'Usuarios' : 'Total usuarios'}
          </p>
        </div>

        {!isGerente && (
          <div
            onClick={() => navigate('/oficinas')}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <Building2 className="w-8 h-8 text-green-500" />
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
          <p className="text-xs text-gray-600 mt-1">Cumpleaños</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{proximosAniversarios.length}</p>
          <p className="text-xs text-gray-600 mt-1">Aniversarios</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a
          href="/seguros-education"
          className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="aspect-video bg-gray-50 flex items-center justify-center p-6">
            <img
              src="https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png"
              alt="Seguros Education"
              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="p-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 text-base">Seguros Education</h3>
            <p className="text-sm text-gray-600 mt-0.5">Plataforma de capacitación</p>
          </div>
        </a>

        <a
          href="/multicotizador-digital"
          className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="aspect-video bg-gray-50 flex items-center justify-center p-6">
            <img
              src="https://movi.digital/wp-content/uploads/2025/02/Logo_MCD_v1-1.png"
              alt="Multicotizador Digital"
              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="p-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-900 text-base">Multicotizador Digital</h3>
            <p className="text-sm text-gray-600 mt-0.5">Herramienta de cotización</p>
          </div>
        </a>
      </div>

      {currentUser?.rol === 'Administrador' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            onClick={() => navigate('/produccion/configuracion')}
            className="group bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-5 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Configurar Producción</h3>
            </div>
            <p className="text-sm text-gray-700">
              Conecta Google Sheets con datos de producción
            </p>
          </div>

          <div
            onClick={() => navigate('/produccion/total')}
            className="group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-5 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Producción Total</h3>
            </div>
            <p className="text-sm text-gray-700">
              Consulta métricas y reportes de producción
            </p>
          </div>
        </div>
      )}

      <UltimoComunicado />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CalendarioEventos />
        <ProximasCapacitaciones />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TramitesWidget />
        <ResumenVacaciones />
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
  );
}
