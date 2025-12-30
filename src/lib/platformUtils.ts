export interface PlatformInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isWindows: boolean;
  isMac: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isFirefox: boolean;
  isStandalone: boolean;
  canInstallPWA: boolean;
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isWindows = /win/.test(ua);
  const isMac = /mac/.test(ua) && !isIOS;
  const isMobile = isAndroid || isIOS;
  const isDesktop = !isMobile;

  const isChrome = /chrome/.test(ua) && !/edge|edg/.test(ua);
  const isSafari = /safari/.test(ua) && !isChrome && !/edge|edg/.test(ua);
  const isEdge = /edge|edg/.test(ua);
  const isFirefox = /firefox/.test(ua);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  const canInstallPWA =
    !isStandalone &&
    (
      (isChrome && (isDesktop || isAndroid)) ||
      isEdge ||
      (isSafari && isIOS)
    );

  return {
    isAndroid,
    isIOS,
    isWindows,
    isMac,
    isDesktop,
    isMobile,
    isChrome,
    isSafari,
    isEdge,
    isFirefox,
    isStandalone,
    canInstallPWA
  };
}

export function isRunningAsPWA(): boolean {
  return detectPlatform().isStandalone;
}

export function getBrowserName(): string {
  const platform = detectPlatform();
  if (platform.isChrome) return 'Chrome';
  if (platform.isSafari) return 'Safari';
  if (platform.isEdge) return 'Edge';
  if (platform.isFirefox) return 'Firefox';
  return 'Desconocido';
}

export function getPlatformName(): string {
  const platform = detectPlatform();
  if (platform.isAndroid) return 'Android';
  if (platform.isIOS) return 'iOS';
  if (platform.isWindows) return 'Windows';
  if (platform.isMac) return 'macOS';
  return 'Desconocido';
}

export function shouldShowAndroidAppLink(): boolean {
  const platform = detectPlatform();
  return platform.isAndroid;
}

export function shouldShowPWAInstall(): boolean {
  const platform = detectPlatform();
  return !platform.isAndroid && platform.canInstallPWA && !platform.isStandalone;
}

export function getInstallInstructions(): string {
  const platform = detectPlatform();

  if (platform.isAndroid) {
    return 'Descarga nuestra app desde Google Play Store';
  }

  if (platform.isIOS && platform.isSafari) {
    return 'Toca el botón Compartir y selecciona "Añadir a pantalla de inicio"';
  }

  if (platform.isChrome || platform.isEdge) {
    return 'Haz clic en el botón de instalación para agregar la app a tu dispositivo';
  }

  return 'Instala la app para una mejor experiencia';
}
