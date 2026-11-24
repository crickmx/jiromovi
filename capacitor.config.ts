import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Dos apps nativas salen del MISMO código web:
 *
 *   CAP_APP=movi        → "MOVI Digital"                  (agentes / colaboradores)
 *   CAP_APP=seguwallet  → "Seguwallet by MOVI Digital"     (asegurados)
 *
 * Cada una tiene su propio proyecto nativo en native/<app>/{ios,android},
 * su identificador de tienda y sus colores. La parte web es la misma build
 * de Vite, compilada con VITE_APP_TARGET=<app> para que App.tsx no dependa
 * del dominio (dentro de la app el host es "localhost").
 *
 * No usar los comandos `npx cap ...` a secas: usar los scripts
 * `npm run native:<app>:sync`, que fijan CAP_APP y compilan antes.
 */
const APP = (process.env.CAP_APP || 'movi') as 'movi' | 'seguwallet';

const APPS = {
  movi: {
    appId: 'digital.movi.app',
    appName: 'MOVI Digital',
    background: '#FFFFFF',
    splashSpinner: '#1C37E0',
  },
  seguwallet: {
    appId: 'mx.seguwallet.app',
    appName: 'Seguwallet',
    background: '#FFFFFF',
    splashSpinner: '#1C37E0',
  },
} as const;

const app = APPS[APP];

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: 'dist',
  backgroundColor: app.background,
  ios: {
    path: `native/${APP}/ios`,
    contentInset: 'never',
    scheme: app.appName.replace(/\s+/g, ''),
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    path: `native/${APP}/android`,
    allowMixedContent: false,
    captureInput: true,
  },
  server: {
    // La app carga la build empaquetada (no un sitio remoto): requisito de
    // App Store 4.2 / 2.5.2 — una app que solo envuelve una URL se rechaza.
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: app.background,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: app.background,
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
