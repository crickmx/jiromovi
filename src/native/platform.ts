import { Capacitor } from '@capacitor/core';

/**
 * Qué app nativa es esta build. Lo fija `VITE_APP_TARGET` al compilar
 * (scripts `native:*`). En la web queda vacío y manda el dominio, como siempre.
 */
export type AppTarget = 'movi' | 'seguwallet';

const raw = (import.meta.env.VITE_APP_TARGET || '').trim().toLowerCase();
export const APP_TARGET: AppTarget | null =
  raw === 'movi' || raw === 'seguwallet' ? raw : null;

/** true solo dentro de la app de iOS/Android, nunca en el navegador. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export const nativePlatform = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';
