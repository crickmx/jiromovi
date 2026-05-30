import { useState } from 'react';
import { X, Wallet, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const email = contacto.email || '';

  const handleActivar = async () => {
    setError('');
    if (!email) {
      setError('Este contacto no tiene correo electronico. Agregalo antes de activar Seguwallet.');
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      // Generate a random secure password — the customer will use login codes, not passwords
      const randomPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';

      const res = await fetch(`${supabaseUrl}/functions/v1/create-seguwallet-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password: randomPassword,
          full_name: contacto.nombre_completo,
          phone: contacto.celular || null,
          agent_user_id: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario Seguwallet');

      const customerId = data.customer?.id;
      if (customerId) {
        await supabase.rpc('link_seguwallet_to_crm_contact', {
          p_customer_id: customerId,
          p_crm_contact_id: contacto.source === 'crm' ? contacto.id : null,
        });
      }

      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm border border-neutral-200 dark:border-neutral-700">
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
            <p className="text-base font-semibold text-neutral-900 dark:text-white">Seguwallet activado</p>
            <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
              {contacto.nombre_completo} ya puede acceder a su portal con codigos temporales.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Contact info */}
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide">Datos del contacto</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">{contacto.nombre_completo}</p>
              {contacto.celular && (
                <p className="text-xs text-neutral-500 dark:text-white/50">{contacto.celular}</p>
              )}
              {email ? (
                <div className="flex items-center gap-2 pt-1">
                  <Mail className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-neutral-700 dark:text-white/70 font-medium">{email}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Mail className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-500">Sin correo electronico</p>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-500 dark:text-white/50 leading-relaxed">
              El cliente podra ingresar a Seguwallet usando su correo y codigos temporales que se envian automaticamente. No se requiere contrasena.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleActivar}
                disabled={loading || !email}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                {loading ? 'Activando...' : 'Activar Seguwallet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
