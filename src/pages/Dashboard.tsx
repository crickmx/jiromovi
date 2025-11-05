import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Building2, Calendar, Cake, Award, ExternalLink, Sparkles } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { UsuariosPendientes } from '../components/UsuariosPendientes';
import { ResumenVacaciones } from '../components/ResumenVacaciones';
import { ProximasReservas } from '../components/ProximasReservas';
import { TicketsWidget } from '../components/TicketsWidget';
import { ProximasCapacitaciones } from '../components/ProximasCapacitaciones';

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
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdminOrGerente) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-3xl shadow-strong p-8 md:p-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-6 h-6" />
              <h1 className="text-3xl md:text-4xl font-display font-bold">
                Bienvenido, {currentUser?.nombre}
              </h1>
            </div>
            <p className="text-primary-100 text-lg mb-6">
              Aquí puedes ver un resumen de tus actividades
            </p>
            <div className="flex flex-wrap gap-3">
              {currentUser?.url_web_multicotizador && (
                <a
                  href={currentUser.url_web_multicotizador}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-white/95 backdrop-blur text-primary-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-white hover:shadow-medium transition-all duration-200 hover:scale-105"
                >
                  <span>Multicotizador Digital</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {currentUser?.url_web_jiro && (
                <a
                  href={currentUser.url_web_jiro}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-white/95 backdrop-blur text-primary-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-white hover:shadow-medium transition-all duration-200 hover:scale-105"
                >
                  <span>Página web de contacto</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProximasReservas />
          <ProximasCapacitaciones />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-3xl shadow-strong p-8 md:p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              Bienvenido, {currentUser?.nombre}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            {currentUser?.url_web_multicotizador && (
              <a
                href={currentUser.url_web_multicotizador}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-white/95 backdrop-blur text-primary-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-white hover:shadow-medium transition-all duration-200 hover:scale-105"
              >
                <span>Multicotizador Digital</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {currentUser?.url_web_jiro && (
              <a
                href={currentUser.url_web_jiro}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-white/95 backdrop-blur text-primary-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-white hover:shadow-medium transition-all duration-200 hover:scale-105"
              >
                <span>Página web de contacto</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketsWidget />
        <ProximasCapacitaciones />
      </div>

      <ResumenVacaciones />

      {currentUser?.rol === 'Administrador' && <UsuariosPendientes />}

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isGerente ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
        <div
          onClick={() => navigate('/directorio')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">
                {isGerente ? 'Usuarios en mi Oficina' : 'Total Usuarios'}
              </p>
              <p className="text-4xl font-bold mt-2">{totalUsuarios}</p>
              <p className="text-blue-100 text-sm mt-4">Ver directorio completo →</p>
            </div>
            <Users className="w-16 h-16 text-blue-200 opacity-50" />
          </div>
        </div>

        {!isGerente && (
          <div
            onClick={() => navigate('/oficinas')}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Oficinas</p>
                <p className="text-4xl font-bold mt-2">{totalOficinas}</p>
                <p className="text-emerald-100 text-sm mt-4">Gestionar oficinas →</p>
              </div>
              <Building2 className="w-16 h-16 text-emerald-200 opacity-50" />
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Próximos Cumpleaños</p>
              <p className="text-4xl font-bold mt-2">{proximosCumpleanos.length}</p>
              <p className="text-purple-100 text-sm mt-4">En el siguiente mes</p>
            </div>
            <Cake className="w-16 h-16 text-purple-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Aniversarios Laborales</p>
              <p className="text-4xl font-bold mt-2">{proximosAniversarios.length}</p>
              <p className="text-amber-100 text-sm mt-4">En el siguiente mes</p>
            </div>
            <Award className="w-16 h-16 text-amber-200 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Cake className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Próximos Cumpleaños</h2>
              </div>
              <Calendar className="w-5 h-5 text-purple-200" />
            </div>
            <div className="mt-3 flex items-center space-x-3">
              <select
                value={birthdayFilter}
                onChange={(e) => setBirthdayFilter(e.target.value as 'next_month' | 'custom')}
                className="bg-white/90 backdrop-blur text-purple-900 font-medium rounded-lg px-3 py-1.5 text-sm border-2 border-white/50 focus:outline-none focus:ring-2 focus:ring-white focus:border-white shadow-sm"
              >
                <option value="next_month" className="text-slate-900">Siguiente mes</option>
                <option value="custom" className="text-slate-900">Fecha personalizada</option>
              </select>
              {birthdayFilter === 'custom' && (
                <input
                  type="month"
                  value={customBirthdayDate}
                  onChange={(e) => setCustomBirthdayDate(e.target.value)}
                  className="bg-white/90 backdrop-blur text-purple-900 font-medium rounded-lg px-3 py-1.5 text-sm border-2 border-white/50 focus:outline-none focus:ring-2 focus:ring-white focus:border-white shadow-sm"
                />
              )}
            </div>
          </div>
          <div className="p-6">
            {proximosCumpleanos.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay cumpleaños próximos</p>
            ) : (
              <div className="space-y-3">
                {proximosCumpleanos.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    onClick={() => navigate(`/perfil/${usuario.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-sm text-slate-500">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-purple-600">
                        {formatDate(usuario.fecha_nacimiento!)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {calculateAge(usuario.fecha_nacimiento!)} años
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Award className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Aniversarios Laborales</h2>
              </div>
              <Calendar className="w-5 h-5 text-amber-200" />
            </div>
            <p className="text-amber-100 text-sm mt-1">Siguiente mes</p>
          </div>
          <div className="p-6">
            {proximosAniversarios.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay aniversarios próximos</p>
            ) : (
              <div className="space-y-3">
                {proximosAniversarios.map((usuario: any) => (
                  <div
                    key={usuario.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    onClick={() => navigate(`/perfil/${usuario.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                        {usuario.nombre[0]}{usuario.apellidos[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {usuario.nombre} {usuario.apellidos}
                        </p>
                        <p className="text-sm text-slate-500">{usuario.puesto}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-amber-600">
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
