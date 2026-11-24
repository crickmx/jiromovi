import { App as CapApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';
import { APP_TARGET, nativePlatform } from './platform';

/**
 * Push nativo de las apps (iOS → APNs, Android → FCM).
 *
 * - Al iniciar sesión pide permiso y registra el token del teléfono en
 *   push_dispositivos (RPC registrar_push_dispositivo: reasigna el teléfono a
 *   quien entró, para que no le lleguen avisos de la cuenta anterior).
 * - Cada aviso de la campanita sale también como push (trigger en la base +
 *   edge function enviar-push-nativo).
 * - Al tocar la notificación abre la pantalla del aviso.
 * - Al cerrar sesión suelta el teléfono ANTES de perder la sesión.
 *
 * Android necesita google-services.json (Firebase). Sin él, registrar el token
 * cierra la app, así que en Android solo se activa si la build lleva
 * VITE_PUSH_ANDROID=1 (ver store/README.md).
 */

let tokenActual: string | null = null;
let listo = false;

const androidHabilitado = (import.meta.env.VITE_PUSH_ANDROID || '') === '1';

function abrirRuta(url: string | undefined) {
  if (!url) return;
  let ruta = url;
  try {
    const u = new URL(url, window.location.origin);
    // Avisos que guardan la liga completa del sitio web: dentro de la app solo importa la ruta.
    ruta = u.pathname + u.search + u.hash;
  } catch { /* ya era una ruta */ }
  if (!ruta.startsWith('/')) return;
  window.history.pushState({}, '', ruta);
  window.dispatchEvent(new PopStateEvent('popstate')); // React Router escucha popstate
}

async function guardarToken(token: string) {
  tokenActual = token;
  const info = await CapApp.getInfo().catch(() => null);
  const { error } = await supabase.rpc('registrar_push_dispositivo', {
    p_token: token,
    p_plataforma: nativePlatform(),
    p_app: APP_TARGET || 'movi',
    p_app_id: info?.id || null,
  });
  if (error) console.error('[push] no se registró el teléfono:', error.message);
}

async function registrar() {
  if (nativePlatform() === 'android' && !androidHabilitado) return;
  let permiso = await PushNotifications.checkPermissions();
  if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') {
    permiso = await PushNotifications.requestPermissions();
  }
  if (permiso.receive !== 'granted') return;
  await PushNotifications.register();
}

export function initPushNativo(): void {
  if (listo) return;
  listo = true;

  PushNotifications.addListener('registration', (t) => { guardarToken(t.value); });
  PushNotifications.addListener('registrationError', (e) => console.error('[push] registro:', e.error));
  PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const data = (a.notification?.data || {}) as Record<string, unknown>;
    abrirRuta(typeof data.url === 'string' ? data.url : undefined);
  });

  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (sesion && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) {
      registrar().catch((e) => console.error('[push]', e));
    }
  });

  // Soltar el teléfono antes de cerrar sesión: después ya no hay permiso para
  // borrar la fila, y el siguiente usuario de ese teléfono recibiría avisos ajenos.
  const signOutOriginal = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = (async (...args: Parameters<typeof signOutOriginal>) => {
    if (tokenActual) {
      await supabase.from('push_dispositivos').delete().eq('token', tokenActual).then(() => {}, () => {});
    }
    return signOutOriginal(...args);
  }) as typeof supabase.auth.signOut;
}
