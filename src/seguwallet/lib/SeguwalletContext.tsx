import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { getSeguwalletCustomer, type SeguwalletCustomer } from './seguwalletAuth';

interface SeguwalletContextType {
  customer: SeguwalletCustomer | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
}

const SeguwalletContext = createContext<SeguwalletContextType>({
  customer: null,
  loading: true,
  isAuthenticated: false,
  refresh: async () => {},
});

export function SeguwalletProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<SeguwalletCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCustomer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCustomer(null);
        return;
      }

      const cust = await getSeguwalletCustomer(user.id);
      if (cust && cust.status === 'active') {
        setCustomer(cust);
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadCustomer();
      } else if (event === 'SIGNED_OUT') {
        setCustomer(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SeguwalletContext.Provider value={{
      customer,
      loading,
      isAuthenticated: !!customer,
      refresh: loadCustomer,
    }}>
      {children}
    </SeguwalletContext.Provider>
  );
}

export function useSeguwallet() {
  return useContext(SeguwalletContext);
}
