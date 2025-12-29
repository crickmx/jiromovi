import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { CheckCircle, AlertCircle, Lock } from 'lucide-react';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    // Verificar si hay un token de recovery en la URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    console.log('Hash params:', { accessToken: accessToken?.substring(0, 20), type });

    if (!accessToken || type !== 'recovery') {
      setError('Link de recuperación inválido o expirado. Por favor, solicita uno nuevo.');
      setValidatingToken(false);
      setTokenValid(false);
      return;
    }

    // Validar el token
    validateRecoveryToken(accessToken);
  }, []);

  const validateRecoveryToken = async (token: string) => {
    try {
      console.log('Validando token de recovery...');

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token, // En recovery, a veces el token sirve como ambos
      });

      if (sessionError) {
        console.error('Error al validar token:', sessionError);
        setError('Link de recuperación inválido o expirado. Por favor, solicita uno nuevo.');
        setTokenValid(false);
      } else if (data.session) {
        console.log('Token válido, usuario puede cambiar contraseña');
        setTokenValid(true);
      } else {
        setError('No se pudo validar el link de recuperación.');
        setTokenValid(false);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
      setError('Error al validar el link. Por favor, intenta de nuevo.');
      setTokenValid(false);
    } finally {
      setValidatingToken(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una letra mayúscula';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una letra minúscula';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'La contraseña debe contener al menos un número';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar contraseñas
      if (!password || !confirmPassword) {
        setError('Por favor, completa todos los campos');
        setLoading(false);
        return;
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }

      console.log('Actualizando contraseña...');

      // Actualizar contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('Error al actualizar contraseña:', updateError);
        throw updateError;
      }

      console.log('Contraseña actualizada exitosamente');
      setSuccess(true);

      // Cerrar sesión después de cambiar contraseña
      await supabase.auth.signOut();

      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      console.error('Error al restablecer contraseña:', err);

      if (err.message?.includes('same as the old password')) {
        setError('La nueva contraseña no puede ser igual a la anterior');
      } else if (err.message?.includes('session')) {
        setError('Tu sesión ha expirado. Por favor, solicita un nuevo link de recuperación.');
      } else {
        setError('Error al actualizar la contraseña. Por favor, intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Vista de validación de token
  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-strong">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral-600">Validando link de recuperación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista de éxito
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-strong">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Contraseña Actualizada</h3>
              <p className="text-neutral-600 mb-4">
                Tu contraseña ha sido actualizada exitosamente.
              </p>
              <p className="text-sm text-neutral-500">
                Serás redirigido al inicio de sesión en unos segundos...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista de token inválido
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-strong">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription className="text-destructive mt-2">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Volver al Inicio de Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista de formulario de cambio de contraseña
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-strong">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary-600" />
              </div>
            </div>
            <CardTitle className="text-3xl mb-2">
              Nueva Contraseña
            </CardTitle>
            <CardDescription>
              Establece una contraseña segura para tu cuenta
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nueva Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                />
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Requisitos de contraseña:</p>
                <ul className="text-sm text-neutral-600 space-y-1">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>
                    • Al menos 8 caracteres
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                    • Al menos una letra mayúscula
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                    • Al menos una letra minúscula
                  </li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                    • Al menos un número
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Cancelar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-neutral-500 mt-6">
          MOVI Digital
        </p>
      </div>
    </div>
  );
}
