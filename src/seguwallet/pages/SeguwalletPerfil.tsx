import { useState } from 'react';
import { User, Lock, Phone, Mail, CheckCircle } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function SeguwalletPerfil() {
  const { customer } = useSeguwallet();
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const toTitleCase = (s: string) => s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPwError('Completa todos los campos.');
      return;
    }
    if (passwordForm.next.length < 8) {
      setPwError('La nueva contrasena debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPwError('Las contrasenas no coinciden.');
      return;
    }

    setPwLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer?.email || '',
        password: passwordForm.current,
      });
      if (signInError) {
        setPwError('La contrasena actual es incorrecta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (updateError) throw updateError;

      setPwSuccess(true);
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwError(err.message || 'Error al cambiar la contrasena.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-neutral-500 mt-1">Informacion de tu cuenta Seguwallet</p>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1C37E0] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {customer?.full_name ? ((customer.full_name.split(' ')[0]?.[0] || '') + (customer.full_name.split(' ')[1]?.[0] || '')).toUpperCase() : 'SW'}
          </div>
          <div>
            <p className="font-bold text-neutral-900 text-lg">{toTitleCase(customer?.full_name || '')}</p>
            <p className="text-sm text-neutral-500">Cliente Seguwallet</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50">
            <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">Correo electronico</p>
              <p className="text-sm font-medium text-neutral-900">{customer?.email || '-'}</p>
            </div>
          </div>

          {customer?.phone && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50">
              <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Telefono</p>
                <p className="text-sm font-medium text-neutral-900">{customer.phone}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50">
            <User className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">Estatus de cuenta</p>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg border",
                customer?.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-100 text-neutral-600 border-neutral-200"
              )}>
                {customer?.status === 'active' ? 'Activa' : customer?.status || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-neutral-700" />
          <h2 className="font-bold text-neutral-900">Cambiar Contrasena</h2>
        </div>

        {pwSuccess && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Contrasena actualizada correctamente.</p>
          </div>
        )}

        {pwError && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
            {pwError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Contrasena actual</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))}
              placeholder="Tu contrasena actual"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Nueva contrasena</label>
            <input
              type="password"
              value={passwordForm.next}
              onChange={e => setPasswordForm(f => ({ ...f, next: e.target.value }))}
              placeholder="Minimo 8 caracteres"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Confirmar nueva contrasena</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repite tu nueva contrasena"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200",
              "bg-[#1C37E0] hover:bg-[#1630C8]",
              "shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/25",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {pwLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Actualizar contrasena'}
          </button>
        </form>
      </div>
    </div>
  );
}
