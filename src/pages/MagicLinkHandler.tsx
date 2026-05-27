import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function MagicLinkHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const platform = searchParams.get('platform') as 'movi' | 'seguwallet' | null;

    if (!token || !platform) {
      setError('Enlace inválido o incompleto.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ magic_token: token, platform }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.code === 'EXPIRED') {
            setError('Este enlace ha expirado. Por favor solicita un nuevo código.');
            return;
          }
          setError(data.error || 'Enlace inválido o ya utilizado.');
          return;
        }

        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (otpError) {
          setError('No se pudo crear la sesión. Intenta con el código manual.');
          return;
        }

        if (platform === 'seguwallet') {
          navigate('/seguwallet/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
      }
    })();
  }, []);

  const platform = searchParams.get('platform');
  const loginPath = platform === 'seguwallet' ? '/seguwallet/login' : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: platform === 'seguwallet'
        ? 'linear-gradient(135deg, #050e24 0%, #0a2260 50%, #030810 100%)'
        : 'linear-gradient(135deg, #0b1e4a 0%, #0b2d6b 50%, #050e24 100%)',
    }}>
      <div className="text-center max-w-sm px-6">
        {error ? (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enlace no válido</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(148,185,255,0.6)' }}>{error}</p>
            <a
              href={loginPath}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-[#0a1e5e] bg-white transition-all hover:opacity-90"
            >
              Ir al inicio de sesión
            </a>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{
              background: 'rgba(91,120,255,0.15)',
              border: '1px solid rgba(91,120,255,0.3)',
            }}>
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verificando acceso...</h2>
            <p className="text-sm" style={{ color: 'rgba(148,185,255,0.5)' }}>
              Estamos confirmando tu identidad
            </p>
          </>
        )}
      </div>
    </div>
  );
}
