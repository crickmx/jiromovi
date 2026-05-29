import { useState } from 'react';
import { X, Wallet, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { UnifiedContacto } from '../../lib/contactosTypes';

interface Props {
  contacto: UnifiedContacto;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ActivarSeguwalletModal({ contacto, onClose, onSuccess }: Props) {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({
    email: contacto.email || '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email) {
      setError('El correo electrónico es requerido.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-seguwallet-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: contacto.nombre_completo,
          phone: contacto.celular || null,
          agent_user_id: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario Seguwallet');

      const customerId = data.customer?.id;
      if (customerId) {
        // Link the new seguwallet customer to the CRM contact
        await supabase.rpc('link_seguwallet_to_crm_contact', {
          p_customer_id: customerId,
          p_crm_contact_id: contacto.source === 'crm' ? contacto.id : null,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md border border-neutral-200 dark:border-neutral-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Activar Seguwallet</h2>
              <p className="text-xs text-neutral-500 dark:text-white/50">{contacto.nombre_completo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-neutral-900 dark:text-white">Usuario Seguwallet creado</p>
            <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
              {contacto.nombre_completo} ya puede acceder a su portal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-medium text-neutral-500 dark:text-white/50 uppercase tracking-wide">Datos del contacto</p>
              <p className="text-sm font-medium text-neutral-800 dark:text-white">{contacto.nombre_completo}</p>
              {contacto.celular && <p className="text-xs text-neutral-500 dark:text-white/50">{contacto.celular}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-white/70 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-white/70 mb-1.5">
                Contraseña temporal
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-9 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-white/70 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                placeholder="Repite la contraseña"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Activar Seguwallet
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
