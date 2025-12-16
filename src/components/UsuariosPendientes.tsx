import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserCheck, UserX, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../lib/database.types';
import { enviarCuentaActivada } from '../lib/transactionalNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';

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
      const { data: usuario, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', usuarioId)
        .single();

      if (fetchError || !usuario) {
        throw new Error('No se pudo obtener información del usuario');
      }

      const { error } = await supabase
        .from('usuarios')
        .update({ estado: 'activo', updated_at: new Date().toISOString() })
        .eq('id', usuarioId);

      if (error) throw error;

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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('No hay sesión activa');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: usuarioId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

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
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (usuarios.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-amber-900">
              Usuarios Pendientes de Aprobación
            </CardTitle>
            <CardDescription className="text-amber-700">
              {usuarios.length} {usuarios.length === 1 ? 'usuario necesita' : 'usuarios necesitan'} tu revisión y aprobación
            </CardDescription>
          </div>
          <Badge variant="warning" className="text-base px-3 py-1">
            {usuarios.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="bg-white border border-amber-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={usuario.imagen_perfil_url || undefined} />
                  <AvatarFallback className="bg-amber-500 text-white">
                    {usuario.nombre[0]}{usuario.apellidos[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-semibold text-neutral-900 text-sm">
                    {usuario.nombre} {usuario.apellidos}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span>{usuario.rol}</span>
                    <span>•</span>
                    <span>{usuario.oficinas?.nombre || 'Sin oficina'}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {usuario.email_laboral || usuario.email_personal}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/usuario/${usuario.id}`)}
                  title="Ver Perfil"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleActivar(usuario.id)}
                  disabled={processingId === usuario.id}
                  className="bg-green-600 hover:bg-green-700"
                  title="Activar Usuario"
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  Activar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRechazar(usuario.id)}
                  disabled={processingId === usuario.id}
                  title="Rechazar Usuario"
                >
                  <UserX className="w-4 h-4 mr-1" />
                  Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
