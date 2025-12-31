import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Info } from 'lucide-react';
import { Button } from './ui/button';
import { usePlatformDetection } from '../hooks/usePlatformDetection';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { APP_LINKS, STORAGE_KEYS, ANALYTICS_EVENTS } from '../constants/appLinks';
import { shouldShowAndroidAppLink, shouldShowPWAInstall, getInstallInstructions } from '../lib/platformUtils';

interface InstallAppButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function InstallAppButton({
  variant = 'default',
  size = 'default',
  showText = true,
  className = ''
}: InstallAppButtonProps) {
  const platform = usePlatformDetection();
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED);

    if (isInstalled) {
      setIsVisible(false);
      return;
    }

    // Para iOS Safari, siempre mostrar el botón (no depende de beforeinstallprompt)
    const shouldShowIOS = platform.isIOS && platform.isSafari && !isInstalled;

    // Para Android y otros navegadores
    const shouldShowAndroid = shouldShowAndroidAppLink();
    const shouldShowOtherPWA = shouldShowPWAInstall() && (isInstallable || platform.isAndroid);

    if (shouldShowIOS || shouldShowAndroid || shouldShowOtherPWA) {
      setIsVisible(!dismissed);
    } else {
      setIsVisible(false);
    }
  }, [isInstallable, isInstalled, platform]);

  const handleAndroidAppClick = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', ANALYTICS_EVENTS.ANDROID_APP_LINK_CLICKED);
      }
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }

    window.open(APP_LINKS.ANDROID_PLAY_STORE, '_blank', 'noopener,noreferrer');
  };

  const handlePWAInstallClick = async () => {
    // Si es iOS Safari, mostrar instrucciones manuales
    if (platform.isIOS && platform.isSafari) {
      setShowIOSInstructions(true);
      try {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', ANALYTICS_EVENTS.INSTALL_BUTTON_CLICKED, {
            platform: 'iOS'
          });
        }
      } catch (error) {
        console.error('Error tracking analytics:', error);
      }
      return;
    }

    setIsInstalling(true);

    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', ANALYTICS_EVENTS.INSTALL_BUTTON_CLICKED);
      }
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }

    const accepted = await promptInstall();

    if (accepted) {
      try {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', ANALYTICS_EVENTS.PWA_INSTALLED);
        }
      } catch (error) {
        console.error('Error tracking analytics:', error);
      }
      setIsVisible(false);
    }

    setIsInstalling(false);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, 'true');

    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', ANALYTICS_EVENTS.PWA_INSTALL_DISMISSED);
      }
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }

    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  if (shouldShowAndroidAppLink()) {
    return (
      <div className={`relative ${className}`}>
        <Button
          onClick={handleAndroidAppClick}
          variant={variant}
          size={size}
          className="gap-2"
        >
          <Smartphone className="w-4 h-4" />
          {showText && <span>Descargar App</span>}
        </Button>
      </div>
    );
  }

  // Mostrar botón para iOS Safari o para otros navegadores con soporte PWA
  if ((platform.isIOS && platform.isSafari) || (shouldShowPWAInstall() && (isInstallable || platform.isAndroid))) {
    return (
      <>
        {/* Modal de instrucciones para iOS */}
        {showIOSInstructions && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Instalar en iPhone
                </h3>
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  Sigue estos pasos para instalar la app:
                </p>

                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      1
                    </span>
                    <span>
                      Toca el botón de <strong>Compartir</strong> en la barra inferior de Safari
                      <svg className="inline-block w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 6.5v3.75h-9V6.5h9zm0 6.75v3.75h-9v-3.75h9zm0-9h-9v1.5h9v-1.5z"/>
                        <path d="M12 2L6.5 7.5l1.06 1.06L11 5.12v9.38h2V5.12l3.44 3.44L17.5 7.5 12 2z"/>
                      </svg>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      2
                    </span>
                    <span>
                      Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                      3
                    </span>
                    <span>
                      Toca <strong>"Añadir"</strong> para confirmar
                    </span>
                  </li>
                </ol>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900">
                      La app aparecerá como un ícono en tu pantalla de inicio y podrás usarla sin conexión.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    setShowIOSInstructions(false);
                    handleDismiss({} as React.MouseEvent);
                  }}
                  size="sm"
                  className="flex-1"
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={`relative ${className}`}>
          <Button
            onClick={handlePWAInstallClick}
            variant={variant}
            size={size}
            className="gap-2"
            disabled={isInstalling}
          >
            <Download className="w-4 h-4" />
            {showText && (
              <span>
                {isInstalling
                  ? 'Instalando...'
                  : (platform.isIOS && platform.isSafari)
                    ? 'Instalar App'
                    : 'Instalar App'}
              </span>
            )}
          </Button>
        </div>
      </>
    );
  }

  return null;
}
