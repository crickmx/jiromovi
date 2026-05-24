import { useState } from 'react';
import { User, Mail, Phone, Shield, Lock, Check } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function SeguwalletPerfil() {
  const { customer } = useSeguwallet();
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contrasenas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (customer) {
        await supabase
          .from('seguwallet_customers')
          .update({ password_updated_at: new Date().toISOString() })
          .eq('id', customer.id);
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Error al cambiar contrasena.');
    } finally {
      setSaving(false);
    }
  };

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-neutral-500 mt-1">Informacion de tu cuenta</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white text-lg font-bold">
            {customer?.full_name?.[0]?.toUpperCase() || 'S'}
          </div>
          <div>
            <p className="text-lg font-bold text-neutral-900">{toTitleCase(customer?.full_name || '')}</p>
            <p className="text-xs text-neutral-500">Cliente Seguwallet</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50/80">
            <Mail className="w-4 h-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Correo electronico</p>
              <p className="text-sm font-medium text-neutral-900">{customer?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50/80">
            <Phone className="w-4 h-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Telefono</p>
              <p className="text-sm font-medium text-neutral-900">{customer?.phone || 'No registrado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50/80">
            <Shield className="w-4 h-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Estado de cuenta</p>
              <p className="text-sm font-medium text-emerald-600 capitalize">{customer?.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-bold text-neutral-900">Seguridad</h2>
          </div>
          {!changingPassword && (
            <button
              onClick={() => setChangingPassword(true)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              Cambiar contrasena
            </button>
          )}
        </div>

        {passwordSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-700 font-medium">Contrasena actualizada correctamente.</p>
          </div>
        )}

        {changingPassword && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Nueva contrasena</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300"
                placeholder="Minimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Confirmar contrasena</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300"
                placeholder="Repite tu nueva contrasena"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => { setChangingPassword(false); setPasswordError(''); }}
                className="px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-medium hover:bg-neutral-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!changingPassword && !passwordSuccess && (
          <p className="text-xs text-neutral-400">Tu contrasena esta protegida. Puedes cambiarla en cualquier momento.</p>
        )}
      </div>
    </div>
  );
}
