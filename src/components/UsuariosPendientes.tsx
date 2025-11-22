import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserCheck, UserX, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../lib/database.types';
import { enviarCuentaActivada } from '../lib/transactionalNotifications';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};

export function UsuariosPendientes() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsuariosPendientes();
  }, []);

  const loadUsuariosPendientes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*, oficinas(nombre)')
      .eq('estado', 'registrado')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading pending users:', error);
    } else {
      setUsuarios(data || []);
    }
    setLoading(false);
  };

  const handleActivar = async (usuarioId: string) => {
    setProcessingId(usuarioId);
    try {
      // Obtener datos completos del usuario antes de activar
      const { data: usuario, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (fetchError || !usuario) {
        throw new Error('No se pudo obtener información del usuario');
      }

      // Actualizar estado a activo
      const { error } = await supabase
        .from('usuarios')
        .update({ estado: 'activo', updated_at: new Date().toISOString() })
        .eq('id', usuarioId);

      if (error) throw error;

      // Enviar notificación de cuenta activada
      await enviarCuentaActivada({
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        email: usuario.email_laboral || usuario.email_personal || '',
        telefono: usuario.telefono_movil || usuario.celular_personal || undefined,
      });

      await loadUsuariosPendientes();
    } catch (error) {
      console.error('Error activating user:', error);
      alert('Error al activar el usuario');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazar = async (usuarioId: string) => {
    if (!confirm('¿Estás seguro de rechazar este usuario? Esta acción eliminará el usuario permanentemente.')) {
      return;
    }

    setProcessingId(usuarioId);
    try {
      const { error } = await supabase.auth.admin.deleteUser(usuarioId);

      if (error) throw error;

      await loadUsuariosPendientes();
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Error al rechazar el usuario');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-amber-900">
            Usuarios Pendientes de Aprobación
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            {usuarios.length} {usuarios.length === 1 ? 'usuario necesita' : 'usuarios necesitan'} tu revisión y aprobación
          </p>
        </div>
        <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
          {usuarios.length}
        </span>
      </div>

      <div className="space-y-3">
        {usuarios.map((usuario) => (
          <div
            key={usuario.id}
            className="bg-white border border-amber-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              {usuario.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center">
                  <span className="text-white font-medium text-lg">
                    {usuario.nombre[0]}{usuario.apellidos[0]}
                  </span>
                </div>
              )}
              <div>
                <h4 className="font-semibold text-slate-900">
                  {usuario.nombre} {usuario.apellidos}
                </h4>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <span>{usuario.rol}</span>
                  <span>•</span>
                  <span>{usuario.oficinas?.nombre || 'Sin oficina'}</span>
                </div>
                <div className="text-sm text-slate-500">
                  {usuario.email_laboral || usuario.email_personal}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate(`/usuario/${usuario.id}`)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Ver Perfil"
              >
                <Eye className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleActivar(usuario.id)}
                disabled={processingId === usuario.id}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                title="Activar Usuario"
              >
                <UserCheck className="w-5 h-5" />
                <span>Activar</span>
              </button>
              <button
                onClick={() => handleRechazar(usuario.id)}
                disabled={processingId === usuario.id}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                title="Rechazar Usuario"
              >
                <UserX className="w-5 h-5" />
                <span>Rechazar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
