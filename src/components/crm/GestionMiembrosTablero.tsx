import { useState, useEffect } from 'react';
import { Users, Crown, Shield, Edit, Eye, Trash2, AlertCircle } from 'lucide-react';
import {
  obtenerMiembrosTablero,
  actualizarRolMiembro,
  removerMiembro,
} from '../../lib/crmUtils';
import type { CRMBoardMemberDetail, MemberRole } from '../../lib/crmTypes';
import { useAuth } from '../../contexts/AuthContext';

interface GestionMiembrosTableroProps {
  boardId: string;
  myRole: MemberRole;
  onMembersChanged: () => void;
}

export default function GestionMiembrosTablero({
  boardId,
  myRole,
  onMembersChanged,
}: GestionMiembrosTableroProps) {
  const [miembros, setMiembros] = useState<CRMBoardMemberDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const { user } = useAuth();

  const canManageMembers = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    cargarMiembros();
  }, [boardId]);

  const cargarMiembros = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await obtenerMiembrosTablero(boardId);
      setMiembros(data);
    } catch (err: any) {
      console.error('Error cargando miembros:', err);
      setError('Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarRol = async (userId: string, newRole: MemberRole) => {
    try {
      setProcessingUserId(userId);
      setError('');
      await actualizarRolMiembro(boardId, userId, newRole);
      await cargarMiembros();
      onMembersChanged();
    } catch (err: any) {
      console.error('Error cambiando rol:', err);
      setError(err.message || 'Error al cambiar rol');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRemover = async (userId: string) => {
    if (!confirm('¿Estás seguro de remover a este miembro del tablero?')) return;

    try {
      setProcessingUserId(userId);
      setError('');
      await removerMiembro(boardId, userId);
      await cargarMiembros();
      onMembersChanged();
    } catch (err: any) {
      console.error('Error removiendo miembro:', err);
      setError(err.message || 'Error al remover miembro');
    } finally {
      setProcessingUserId(null);
    }
  };

  const getRoleIcon = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'editor':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'editor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Administrador';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Visualizador';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Users className="h-5 w-5 mr-2 text-accent" />
          Miembros ({miembros.length})
        </h3>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {miembros.map((miembro) => {
          const isMe = miembro.user_id === user?.id;
          const isOwner = miembro.member_role === 'owner';
          const canEdit = canManageMembers && !isOwner && !isMe;

          return (
            <div
              key={miembro.member_id}
              className={`p-4 rounded-lg border ${
                isMe ? 'bg-accent/5 border-accent/20' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-accent text-white flex items-center justify-center font-semibold">
                    {miembro.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900">
                        {miembro.user_name}
                        {isMe && <span className="text-accent ml-1">(Tú)</span>}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded border flex items-center ${getRoleBadgeColor(
                          miembro.member_role
                        )}`}
                      >
                        {getRoleIcon(miembro.member_role)}
                        <span className="ml-1">{getRoleLabel(miembro.member_role)}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-gray-600">{miembro.user_office}</p>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-xs text-gray-600">{miembro.user_role_global}</p>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center space-x-2 ml-4">
                    <select
                      value={miembro.member_role}
                      onChange={(e) =>
                        handleCambiarRol(miembro.user_id, e.target.value as MemberRole)
                      }
                      disabled={processingUserId === miembro.user_id}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemover(miembro.user_id)}
                      disabled={processingUserId === miembro.user_id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remover miembro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {!canEdit && !isMe && (
                  <div className="ml-4">
                    <span className="text-xs text-gray-500">No editable</span>
                  </div>
                )}
              </div>

              {miembro.added_by_name && (
                <p className="text-xs text-gray-500 mt-2 ml-13">
                  Agregado por {miembro.added_by_name} •{' '}
                  {new Date(miembro.created_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!canManageMembers && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Solo los propietarios y administradores pueden gestionar miembros del tablero.
          </p>
        </div>
      )}
    </div>
  );
}
