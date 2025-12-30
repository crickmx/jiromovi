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
      if (shouldShowAndroidAppLink() || (shouldShowPWAInstall() && isInstallable)) {
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
              {getInstallInstructions()}
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
                  {isInstalling ? 'Instalando...' : 'Instalar'}
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
  );
}
