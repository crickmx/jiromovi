import { useState } from 'react';
import { User, Lock, Phone, Mail, CheckCircle } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand } from '../lib/AgentBrandContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function SeguwalletPerfil() {
  const { customer } = useSeguwallet();
  const { brand } = useAgentBrand();
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const primary = brand.primaryColor;

  const toTitleCase = (s: string) => s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

  const getInitials = () => {
    if (!customer?.full_name) return 'SW';
    const parts = customer.full_name.split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  };

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
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm overflow-hidden">
        {/* Color strip */}
        <div className="h-1.5" style={{ backgroundColor: primary }} />

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-sm"
              style={{ backgroundColor: primary }}
            >
              {getInitials()}
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-lg">{toTitleCase(customer?.full_name || '')}</p>
              <p className="text-sm text-neutral-500">Cliente Seguwallet</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
              <div className="p-2 rounded-xl bg-white border border-neutral-100 flex-shrink-0">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-400 font-medium">Correo electronico</p>
                <p className="text-sm font-semibold text-neutral-900">{customer?.email || '-'}</p>
              </div>
            </div>

            {customer?.phone && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
                <div className="p-2 rounded-xl bg-white border border-neutral-100 flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                </div>
                <div>
                  <p className="text-[11px] text-neutral-400 font-medium">Telefono</p>
                  <p className="text-sm font-semibold text-neutral-900">{customer.phone}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100">
              <div className="p-2 rounded-xl bg-white border border-neutral-100 flex-shrink-0">
                <User className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-neutral-400 font-medium">Estatus de cuenta</p>
                <span className={cn(
                  "inline-block text-xs font-bold px-2.5 py-0.5 rounded-lg border mt-0.5",
                  customer?.status === 'active'
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-neutral-100 text-neutral-600 border-neutral-200"
                )}>
                  {customer?.status === 'active' ? 'Activa' : customer?.status || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="bg-white rounded-3xl border border-neutral-200/50 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl" style={{ backgroundColor: primary + '12' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: primary }} />
          </div>
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
          {(['current', 'next', 'confirm'] as const).map((field, i) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                {i === 0 ? 'Contrasena actual' : i === 1 ? 'Nueva contrasena' : 'Confirmar nueva contrasena'}
              </label>
              <input
                type="password"
                value={passwordForm[field]}
                onChange={e => setPasswordForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={i === 0 ? 'Tu contrasena actual' : i === 1 ? 'Minimo 8 caracteres' : 'Repite tu nueva contrasena'}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:border-current transition-all"
                style={{ '--tw-ring-color': primary } as any}
                autoComplete={i === 0 ? 'current-password' : 'new-password'}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-105"
            style={{ backgroundColor: primary }}
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
