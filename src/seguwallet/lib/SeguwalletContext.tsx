import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { getSeguwalletCustomer, type SeguwalletCustomer, type SeguwalletTerms } from './seguwalletAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface PlatformTermsDoc {
  id: string;
  version: number;
  titulo: string;
  contenido_html: string;
  tipo: 'terminos' | 'privacidad';
}

interface SeguwalletContextType {
  customer: SeguwalletCustomer | null;
  activeTerms: SeguwalletTerms | null;
  platformTerms: PlatformTermsDoc[];
  loading: boolean;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  needsTermsAcceptance: boolean;
  refresh: () => Promise<void>;
}

const SeguwalletContext = createContext<SeguwalletContextType>({
  customer: null,
  activeTerms: null,
  platformTerms: [],
  loading: true,
  isAuthenticated: false,
  needsProfileCompletion: false,
  needsTermsAcceptance: false,
  refresh: async () => {},
});

function computeNeeds(
  customer: SeguwalletCustomer | null,
  platformTerms: PlatformTermsDoc[],
  acceptedTermsIds: Set<string>,
) {
  if (!customer) return { needsProfileCompletion: false, needsTermsAcceptance: false };

  const needsProfileCompletion = !customer.profile_completed;

  let needsTermsAcceptance = false;
  if (platformTerms.length > 0) {
    needsTermsAcceptance = platformTerms.some(t => !acceptedTermsIds.has(t.id));
  }

  return { needsProfileCompletion, needsTermsAcceptance };
}

export function SeguwalletProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<SeguwalletCustomer | null>(null);
  const [activeTerms, setActiveTerms] = useState<SeguwalletTerms | null>(null);
  const [platformTerms, setPlatformTerms] = useState<PlatformTermsDoc[]>([]);
  const [acceptedTermsIds, setAcceptedTermsIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { isImpersonating, session, impersonatedCustomer } = useImpersonation();

  const loadCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCustomer(null);
        return;
      }

      const cust = await getSeguwalletCustomer(user.id);
      setCustomer(cust && cust.status === 'active' ? cust : null);

      // Load unified platform terms
      const { data: pTerms } = await supabase
        .from('platform_terms')
        .select('*')
        .eq('activo', true);
      setPlatformTerms(pTerms || []);

      // Check acceptances
      if (pTerms && pTerms.length > 0) {
        const { data: acceptances } = await supabase
          .from('platform_terms_acceptance')
          .select('terms_id')
          .eq('usuario_id', user.id);
        setAcceptedTermsIds(new Set((acceptances || []).map(a => a.terms_id)));
      }

      // Keep legacy terms for backward compat in the UI
      setActiveTerms(null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  // When impersonating a Seguwallet customer, load their full record
  useEffect(() => {
    if (isImpersonating && session?.platform === 'seguwallet' && impersonatedCustomer) {
      (async () => {
        const { data } = await supabase
          .from('seguwallet_customers')
          .select('*')
          .eq('id', impersonatedCustomer.id)
          .maybeSingle();
        if (data) {
          setCustomer(data as SeguwalletCustomer);
        }
        setLoading(false);
      })();
      return;
    }

    loadCustomer();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        (async () => { await loadCustomer(); })();
      } else if (event === 'SIGNED_OUT') {
        setCustomer(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isImpersonating, session?.platform, impersonatedCustomer?.id]);

  const isImpersonatingSeguwallet = isImpersonating && session?.platform === 'seguwallet';

  const { needsProfileCompletion, needsTermsAcceptance } = computeNeeds(
    customer,
    platformTerms,
    acceptedTermsIds
  );

  return (
    <SeguwalletContext.Provider value={{
      customer,
      activeTerms,
      platformTerms,
      loading,
      isAuthenticated: isImpersonatingSeguwallet ? true : !!customer,
      needsProfileCompletion: isImpersonatingSeguwallet ? false : needsProfileCompletion,
      needsTermsAcceptance: isImpersonatingSeguwallet ? false : needsTermsAcceptance,
      refresh: loadCustomer,
    }}>
      {children}
    </SeguwalletContext.Provider>
  );
}

export function useSeguwallet() {
  return useContext(SeguwalletContext);
}
