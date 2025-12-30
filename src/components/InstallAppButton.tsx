import { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
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

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED);

    if (isInstalled) {
      setIsVisible(false);
      return;
    }

    if (shouldShowAndroidAppLink()) {
      setIsVisible(!dismissed);
    } else if (shouldShowPWAInstall() && isInstallable) {
      setIsVisible(!dismissed);
    }
  }, [isInstallable, isInstalled]);

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

  if (shouldShowPWAInstall() && isInstallable) {
    return (
      <div className={`relative ${className}`}>
        <Button
          onClick={handlePWAInstallClick}
          variant={variant}
          size={size}
          className="gap-2"
          disabled={isInstalling}
        >
          <Download className="w-4 h-4" />
          {showText && <span>{isInstalling ? 'Instalando...' : 'Instalar App'}</span>}
        </Button>
      </div>
    );
  }

  return null;
}
