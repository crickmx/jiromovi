import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useRef } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { cargarPermisosAdicionales } from '../lib/permisosUtils';
import { applyTheme } from '../lib/themeUtils';
import { setActivityUserId, trackLogin, trackLogout } from '../lib/activityLogger';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  permisosAdicionales?: string[]; // Códigos de módulos con permisos admin
};

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchUsuario = async (userId: string, forceRefresh: boolean = false) => {
    // Evitar fetches duplicados
    if (!forceRefresh && isFetchingRef.current) {
      console.log('[AuthContext] ⏸️ Ya hay un fetch en progreso, omitiendo');
      return;
    }

    if (!forceRefresh && lastFetchedUserIdRef.current === userId) {
      console.log('[AuthContext] ✅ Usuario ya cargado, omitiendo fetch duplicado');
      return;
    }

    isFetchingRef.current = true;
    try {
      console.log('[AuthContext] Fetching usuario for ID:', userId);

      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          *,
          oficina:oficinas(id, nombre, accent_color, logo_url),
          regimen_fiscal:commission_fiscal_regimes(id, name)
        `)
        .eq('id', userId)
        .eq('estado', 'activo')
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error fetching usuario:', error);
        console.error('[AuthContext] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        // No cerramos la sesión aquí, solo logueamos el error
        setUsuario(null);
        throw error; // Propagamos el error para que signIn lo maneje
      }

      if (!data) {
        console.warn('[AuthContext] Usuario not found or not active:', userId);
        console.warn('[AuthContext] This usually means:');
        console.warn('  1. User does not exist in usuarios table');
        console.warn('  2. User activo field is false');
        console.warn('  3. User was deleted');

        // Solo cerramos sesión si el usuario realmente no existe o no está activo
        await supabase.auth.signOut();
        setUsuario(null);
        throw new Error('Usuario no encontrado o inactivo');
      }

      console.log('[AuthContext] Usuario loaded successfully:', {
        id: data.id,
        nombre: data.nombre,
        apellidos: data.apellidos,
        rol: data.rol,
        email_laboral: data.email_laboral
      });

      // Aplicar tema de la oficina
      if (data.oficina && typeof data.oficina === 'object' && 'accent_color' in data.oficina) {
        const accentColor = data.oficina.accent_color || '#0E23E2';
        console.log('[AuthContext] Aplicando tema de oficina:', accentColor);
        applyTheme(accentColor);
      } else {
        console.log('[AuthContext] Aplicando tema default');
        applyTheme('#0E23E2');
      }

      // Si el usuario es Gerente, cargar sus permisos adicionales
      if (data.rol === 'Gerente') {
        const permisos = await cargarPermisosAdicionales(data.id);
        console.log('[AuthContext] Permisos adicionales cargados para Gerente:', permisos);
        setUsuario({ ...data, permisosAdicionales: permisos });
      } else if (data.rol === 'Administrador') {
        console.log('[AuthContext] Usuario es Administrador - No necesita permisos adicionales');
        setUsuario(data);
      } else {
        console.log('[AuthContext] Usuario sin permisos adicionales (rol:', data.rol, ')');
        setUsuario(data);
      }

      // Marcar como exitoso
      lastFetchedUserIdRef.current = userId;
    } catch (err) {
      console.error('[AuthContext] Unexpected error fetching usuario:', err);
      setUsuario(null);
      lastFetchedUserIdRef.current = null;
      throw err; // Propagamos el error
    } finally {
      isFetchingRef.current = false;
    }
  };

  const refreshUsuario = async () => {
    if (user) {
      console.log('[AuthContext] 🔄 Forzando refresh del usuario');

      // Forzar refresh del token JWT de Supabase
      // Esto es necesario cuando el rol/permisos cambian en la BD
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[AuthContext] Error refreshing session:', error);
      } else {
        console.log('[AuthContext] ✅ Session JWT refreshed successfully');
      }

      lastFetchedUserIdRef.current = null; // Resetear para forzar el fetch
      await fetchUsuario(user.id, true);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    let isInitialLoad = true;
    let loadingSetToFalse = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event, session?.user?.email || 'No session');

      // Si ya se completó la carga inicial, solo actualizar estado
      if (!isInitialLoad) {
        (async () => {
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchUsuario(session.user.id);
            setActivityUserId(session.user.id);
          } else {
            setActivityUserId(null);
            setUsuario(null);
          }
        })();
        return;
      }

      // Durante la carga inicial, solo procesar si no hay fetch en progreso
      if (isFetchingRef.current) {
        console.log('[AuthContext] Fetch en progreso, ignorando evento', event);
        return;
      }

      // Procesar el primer evento que llegue
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUsuario(session.user.id);
          setActivityUserId(session.user.id);
        } else {
          setActivityUserId(null);
          setUsuario(null);
        }

        // Solo ponemos loading en false después de completar el fetch
        if (isInitialLoad && !loadingSetToFalse) {
          console.log('[AuthContext] Initial load complete via onAuthStateChange');
          setLoading(false);
          isInitialLoad = false;
          loadingSetToFalse = true;
        }
      })();
    });

    // Fallback por si onAuthStateChange no se dispara en 2 segundos
    const fallbackTimeout = setTimeout(() => {
      if (isInitialLoad && !loadingSetToFalse) {
        console.log('[AuthContext] Fallback: completando carga manualmente');
        setLoading(false);
        isInitialLoad = false;
        loadingSetToFalse = true;
      }
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] Attempting sign in for:', email);
    console.log('[AuthContext] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('[AuthContext] Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

    try {
      // Intento 1: Login directo con el email proporcionado
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Sign in failed:', error);
        console.error('[AuthContext] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: error.code
        });

        // Si falla por credenciales inválidas, intentar con email alternativo
        if (error.message.includes('Invalid login credentials')) {
          console.log('[AuthContext] Checking if email exists in usuarios.email_laboral...');

          try {
            // Buscar usuario por email_laboral
            const { data: usuarioData, error: queryError } = await supabase
              .from('usuarios')
              .select('id')
              .eq('email_laboral', email)
              .eq('activo', true)
              .eq('is_deleted', false)
              .maybeSingle();

            if (queryError) {
              console.error('[AuthContext] Error querying usuarios:', queryError);
              return { error };
            }

            if (usuarioData) {
              console.log('[AuthContext] Found user in usuarios table, getting auth email...');

              // Obtener el email de auth.users
              const { data: authUserData } = await supabase
                .rpc('get_auth_email_for_user', { user_id: usuarioData.id })
                .maybeSingle();

              if (authUserData?.email && authUserData.email !== email) {
                console.log('[AuthContext] Found different auth email, retrying login with:', authUserData.email);

                // Intento 2: Login con el email de auth.users
                const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                  email: authUserData.email,
                  password,
                });

                if (retryError) {
                  console.error('[AuthContext] Retry login also failed:', retryError);
                  return { error: retryError };
                }

                // Si el retry funciona, continuar con el flujo normal
                console.log('[AuthContext] Retry login successful:', {
                  userId: retryData.user?.id,
                  email: retryData.user?.email,
                  originalEmail: email
                });

                if (retryData.user) {
                  console.log('[AuthContext] Waiting for usuario to load...');
                  setUser(retryData.user);
                  try {
                    await fetchUsuario(retryData.user.id);
                    console.log('[AuthContext] Usuario loaded, ready to navigate');
                    setActivityUserId(retryData.user.id);
                    trackLogin();
                  } catch (fetchError) {
                    console.error('[AuthContext] Error loading usuario profile:', fetchError);
                    await supabase.auth.signOut();
                    return {
                      error: {
                        name: 'ProfileError',
                        message: 'No se pudo cargar tu perfil. Verifica que tu usuario esté activo.',
                        status: 403
                      } as AuthError
                    };
                  }
                }

                return { error: null };
              }
            }
          } catch (lookupError) {
            console.error('[AuthContext] Error during email lookup:', lookupError);
          }
        }

        return { error };
      }

      console.log('[AuthContext] Sign in successful:', {
        userId: data.user?.id,
        email: data.user?.email
      });

      // CRITICAL: Esperar a que el usuario se cargue antes de retornar
      // Esto previene la race condition donde navegamos antes de que fetchUsuario termine
      if (data.user) {
        console.log('[AuthContext] Waiting for usuario to load...');
        setUser(data.user);
        try {
          await fetchUsuario(data.user.id);
          console.log('[AuthContext] Usuario loaded, ready to navigate');
          setActivityUserId(data.user.id);
          trackLogin();
        } catch (fetchError) {
          console.error('[AuthContext] Error loading usuario profile:', fetchError);
          // Si falla cargar el perfil, cerramos la sesión
          await supabase.auth.signOut();
          return {
            error: {
              name: 'ProfileError',
              message: 'No se pudo cargar tu perfil. Verifica que tu usuario esté activo.',
              status: 403
            } as AuthError
          };
        }
      }

      return { error: null };
    } catch (err: any) {
      console.error('[AuthContext] Network or unexpected error:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });

      const networkError: AuthError = {
        name: 'NetworkError',
        message: err.message || 'Error de conexión. Verifica tu conexión a internet y que la URL de Supabase sea correcta.',
        status: 0,
      } as AuthError;

      return { error: networkError };
    }
  };

  const signOut = async () => {
    trackLogout();
    setActivityUserId(null);
    await supabase.auth.signOut();
    setUsuario(null);
  };

  const value = useMemo(
    () => ({
      user,
      usuario,
      loading,
      signIn,
      signOut,
      refreshUsuario,
    }),
    [user, usuario, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
