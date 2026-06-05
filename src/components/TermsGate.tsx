import { useAuth } from '@/contexts/AuthContext';
import { usePlatformTerms } from '@/hooks/usePlatformTerms';
import { TermsAcceptanceModal } from '@/components/TermsAcceptanceModal';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  platform?: 'movi' | 'seguwallet' | 'chava';
  platformName?: string;
}

export function TermsGate({ children, platform = 'movi', platformName = 'MOVI Digital' }: Props) {
  const { usuario, loading: authLoading } = useAuth();
  const { status, loading, needsAcceptance, accepting, acceptTerms } = usePlatformTerms(
    usuario?.id,
    platform
  );

  if (authLoading || loading) return null;
  if (!usuario) return <>{children}</>;

  if (needsAcceptance) {
    return (
      <>
        {children}
        <TermsAcceptanceModal
          status={status}
          accepting={accepting}
          onAccept={acceptTerms}
          platformName={platformName}
        />
      </>
    );
  }

  return <>{children}</>;
}
