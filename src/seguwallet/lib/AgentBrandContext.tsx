import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useSeguwallet } from './SeguwalletContext';

const SEGUWALLET_LOGO = '/seguwallet-logo.png';
const DEFAULT_PRIMARY = '#1C37E0';
const DEFAULT_SECONDARY = '#1228B8';

export interface AgentBrand {
  logoUrl: string | null;
  profileImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  agentName: string;
  officeName: string | null;
  phone: string | null;
  email: string | null;
  webSlug: string | null;
  /** Full public page URL */
  webUrl: string | null;
  /** WhatsApp link */
  whatsappUrl: string | null;
  /** tel: link */
  telUrl: string | null;
  /** mailto: link */
  mailtoUrl: string | null;
  /** Logo to actually display (logoUrl or SEGUWALLET_LOGO fallback) */
  displayLogo: string;
}

interface AgentBrandContextType {
  brand: AgentBrand;
  loading: boolean;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Mexico: if 10 digits, prepend 52; if already has 52 prefix keep it
  if (digits.length === 10) return '52' + digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits;
  if (digits.length === 13 && digits.startsWith('521')) return digits;
  return digits;
}

const DEFAULT_BRAND: AgentBrand = {
  logoUrl: null,
  profileImageUrl: null,
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  agentName: 'Tu Agente',
  officeName: null,
  phone: null,
  email: null,
  webSlug: null,
  webUrl: null,
  whatsappUrl: null,
  telUrl: null,
  mailtoUrl: null,
  displayLogo: SEGUWALLET_LOGO,
};

function buildBrand(raw: any): AgentBrand {
  const phone = raw.phone || null;
  const normalized = normalizePhone(phone);
  const webSlug = raw.web_slug || null;
  return {
    logoUrl: raw.logo_url || null,
    profileImageUrl: raw.profile_image_url || null,
    primaryColor: raw.primary_color || DEFAULT_PRIMARY,
    secondaryColor: raw.secondary_color || DEFAULT_SECONDARY,
    agentName: raw.agent_name || 'Tu Agente',
    officeName: raw.office_name || null,
    phone,
    email: raw.email || null,
    webSlug,
    webUrl: webSlug ? `https://agentedeseguros.website/${webSlug}` : null,
    whatsappUrl: normalized ? `https://wa.me/${normalized}` : null,
    telUrl: phone ? `tel:${phone.replace(/\s/g, '')}` : null,
    mailtoUrl: raw.email ? `mailto:${raw.email}` : null,
    displayLogo: raw.logo_url || SEGUWALLET_LOGO,
  };
}

const AgentBrandContext = createContext<AgentBrandContextType>({
  brand: DEFAULT_BRAND,
  loading: true,
});

export function AgentBrandProvider({ children }: { children: ReactNode }) {
  const { customer } = useSeguwallet();
  const [brand, setBrand] = useState<AgentBrand>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer?.agent_user_id) {
      setBrand(DEFAULT_BRAND);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_agent_brand_for_seguwallet', {
          p_agent_id: customer.agent_user_id,
        });
        if (!cancelled) {
          if (error || !data) {
            setBrand(DEFAULT_BRAND);
          } else {
            setBrand(buildBrand(data));
          }
        }
      } catch {
        if (!cancelled) setBrand(DEFAULT_BRAND);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customer?.agent_user_id]);

  return (
    <AgentBrandContext.Provider value={{ brand, loading }}>
      {children}
    </AgentBrandContext.Provider>
  );
}

export function useAgentBrand() {
  return useContext(AgentBrandContext);
}

export { SEGUWALLET_LOGO };
