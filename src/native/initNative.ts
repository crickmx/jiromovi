import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp, nativePlatform } from './platform';

/**
 * Ajustes que solo aplican dentro de la app nativa. En la web no hace nada.
 *
 * - Marca el <html> con `native-app` y la plataforma, para el CSS de áreas seguras.
 * - Barra de estado con texto oscuro sobre fondo blanco.
 * - Botón "atrás" de Android: navega hacia atrás y solo cierra la app en la raíz.
 * - Ligas externas (otro dominio, target=_blank, window.open) se abren en el
 *   navegador del sistema en lugar de sacar al usuario de la app sin regreso.
 * - Oculta el splash cuando React ya pintó.
 */
export function initNative(): void {
  if (!isNativeApp()) return;

  const root = document.documentElement;
  root.classList.add('native-app', `native-${nativePlatform()}`);

  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  if (nativePlatform() === 'android') {
    StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
  }

  CapApp.addListener('backButton', ({ canGoBack }) => {
    const enRaiz = ['/', '/dashboard', '/login'].includes(window.location.pathname);
    if (canGoBack && !enRaiz) window.history.back();
    else CapApp.exitApp();
  });

  const esExterna = (href: string): boolean => {
    try {
      const url = new URL(href, window.location.href);
      if (!/^https?:$/.test(url.protocol)) return false;
      return url.host !== window.location.host;
    } catch {
      return false;
    }
  };

  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/^(mailto|tel|sms|whatsapp):/i.test(href)) return; // el sistema los resuelve
      if (!esExterna(href)) return; // liga interna: navega dentro de la app
      e.preventDefault();
      Browser.open({ url: new URL(href, window.location.href).toString() }).catch(() => {});
    },
    true,
  );

  const openOriginal = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url ? String(url) : '';
    if (href && esExterna(href)) {
      Browser.open({ url: new URL(href, window.location.href).toString() }).catch(() => {});
      return null;
    }
    return openOriginal(url as string, target, features);
  }) as typeof window.open;

  // React ya montó cuando corre esto (se llama después del render).
  window.setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}), 300);
}
