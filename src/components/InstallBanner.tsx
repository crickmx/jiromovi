import { useState, useEffect } from 'react';
import { X, Smartphone, Download, Info } from 'lucide-react';
import { Button } from './ui/button';
import { usePlatformDetection } from '../hooks/usePlatformDetection';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { APP_LINKS, STORAGE_KEYS, ANALYTICS_EVENTS } from '../constants/appLinks';
import { shouldShowAndroidAppLink, shouldShowPWAInstall, getInstallInstructions } from '../lib/platformUtils';

export default function InstallBanner() {
  const platform = usePlatformDetection();
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED);
    const promptCount = parseInt(localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_COUNT) || '0');
    const lastPromptDate = localStorage.getItem(STORAGE_KEYS.LAST_PROMPT_DATE);

    if (isInstalled || dismissed === 'true') {
      setIsVisible(false);
      return;
    }

    const today = new Date().toDateString();
    if (lastPromptDate === today && promptCount >= 3) {
      setIsVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      // Para iOS Safari, siempre mostrar instrucciones manuales (no depende de beforeinstallprompt)
      const shouldShowIOS = platform.isIOS && platform.isSafari && !isInstalled;

      // Para Android y otros navegadores con soporte PWA
      const shouldShowOther = shouldShowAndroidAppLink() || (shouldShowPWAInstall() && (isInstallable || platform.isAndroid));

      if (shouldShowIOS || shouldShowOther) {
        setIsVisible(true);

        const newCount = lastPromptDate === today ? promptCount + 1 : 1;
        localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_COUNT, newCount.toString());
        localStorage.setItem(STORAGE_KEYS.LAST_PROMPT_DATE, today);

        try {
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', ANALYTICS_EVENTS.INSTALL_PROMPT_SHOWN, {
              platform: platform.isAndroid ? 'Android' : platform.isIOS ? 'iOS' : 'Desktop'
            });
          }
        } catch (error) {
          console.error('Error tracking analytics:', error);
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled, platform]);

  const handleAndroidAppClick = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', ANALYTICS_EVENTS.ANDROID_APP_LINK_CLICKED, {
          source: 'banner'
        });
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
            source: 'banner',
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
        (window as any).gtag('event', ANALYTICS_EVENTS.INSTALL_BUTTON_CLICKED, {
          source: 'banner'
        });
      }
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }

    const accepted = await promptInstall();

    if (accepted) {
      try {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', ANALYTICS_EVENTS.PWA_INSTALLED, {
            source: 'banner'
          });
        }
      } catch (error) {
        console.error('Error tracking analytics:', error);
      }
      setIsVisible(false);
    }

    setIsInstalling(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, 'true');

    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', ANALYTICS_EVENTS.PWA_INSTALL_DISMISSED, {
          source: 'banner'
        });
      }
    } catch (error) {
      console.error('Error tracking analytics:', error);
    }

    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

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
                  handleDismiss();
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

      {/* Banner de instalación */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {shouldShowAndroidAppLink() ? (
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {shouldShowAndroidAppLink()
                  ? 'Descarga nuestra app oficial'
                  : 'Instala nuestra app'}
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                {platform.isIOS && platform.isSafari
                  ? 'Accede más rápido y usa la app sin conexión'
                  : getInstallInstructions()}
              </p>

              <div className="flex gap-2">
                {shouldShowAndroidAppLink() ? (
                  <Button
                    onClick={handleAndroidAppClick}
                    size="sm"
                    className="flex-1"
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    Ir a Play Store
                  </Button>
                ) : (
                  <Button
                    onClick={handlePWAInstallClick}
                    size="sm"
                    className="flex-1"
                    disabled={isInstalling}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isInstalling ? 'Instalando...' : (platform.isIOS ? 'Ver instrucciones' : 'Instalar')}
                  </Button>
                )}

                <Button
                  onClick={handleDismiss}
                  size="sm"
                  variant="ghost"
                >
                  Ahora no
                </Button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
