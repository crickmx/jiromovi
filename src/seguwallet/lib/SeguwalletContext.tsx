import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { getSeguwalletCustomer, getActiveSeguwalletTerms, type SeguwalletCustomer, type SeguwalletTerms } from './seguwalletAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface SeguwalletContextType {
  customer: SeguwalletCustomer | null;
  activeTerms: SeguwalletTerms | null;
  loading: boolean;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  needsTermsAcceptance: boolean;
  refresh: () => Promise<void>;
}

const SeguwalletContext = createContext<SeguwalletContextType>({
  customer: null,
  activeTerms: null,
  loading: true,
  isAuthenticated: false,
  needsProfileCompletion: false,
  needsTermsAcceptance: false,
  refresh: async () => {},
});

function computeNeeds(customer: SeguwalletCustomer | null, activeTerms: SeguwalletTerms | null) {
  if (!customer) return { needsProfileCompletion: false, needsTermsAcceptance: false };

  const needsProfileCompletion = !customer.profile_completed;

  let needsTermsAcceptance = false;
  if (activeTerms) {
    needsTermsAcceptance = !customer.terms_accepted || customer.terms_version_accepted !== activeTerms.version;
  }

  return { needsProfileCompletion, needsTermsAcceptance };
}

export function SeguwalletProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<SeguwalletCustomer | null>(null);
  const [activeTerms, setActiveTerms] = useState<SeguwalletTerms | null>(null);
  const [loading, setLoading] = useState(true);
  const { isImpersonating, session, impersonatedCustomer } = useImpersonation();

  const loadCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCustomer(null);
        return;
      }
      const [cust, terms] = await Promise.all([
        getSeguwalletCustomer(user.id),
        getActiveSeguwalletTerms(),
      ]);
      setCustomer(cust && cust.status === 'active' ? cust : null);
      setActiveTerms(terms);
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
    activeTerms
  );

  return (
    <SeguwalletContext.Provider value={{
      customer,
      activeTerms,
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
