export interface SeguwalletInsurer {
  id: string;
  name: string;
  logo_url: string | null;
  logo_local_path: string | null;
  logo_original_source_url: string | null;
  primary_color: string | null;
  website_url: string | null;
  customer_service_phone: string | null;
  payment_phone: string | null;
  claims_phone: string | null;
  customer_service_whatsapp: string | null;
  claims_whatsapp: string | null;
  payment_url: string | null;
  ios_app_url: string | null;
  android_app_url: string | null;
  general_conditions_url: string | null;
  claims_instructions: string | null;
  is_active: boolean;
  show_in_directory: boolean;
  show_in_claims: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InsurerFormData = Omit<SeguwalletInsurer, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'logo_local_path' | 'logo_original_source_url'>;

export function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits;
}

export function whatsappLink(phone: string): string {
  const digits = sanitizePhone(phone);
  const normalized = digits.startsWith('52') ? digits : `52${digits}`;
  return `https://wa.me/${normalized}`;
}

export function callLink(phone: string): string {
  const digits = sanitizePhone(phone);
  return `tel:${digits}`;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const BLOCKED_LOGO_DOMAINS = ['logo.clearbit.com', 'clearbit.com'];

export function isBlockedLogoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_LOGO_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/** Returns the best available logo URL: local storage > external logo_url (non-blocked) > null */
export function getInsurerLogoUrl(ins: Pick<SeguwalletInsurer, 'logo_local_path' | 'logo_url'>): string | null {
  if (ins.logo_local_path) {
    return `${SUPABASE_URL}/storage/v1/object/public/insurance-carriers-logos/${ins.logo_local_path}`;
  }
  if (ins.logo_url && !isBlockedLogoUrl(ins.logo_url)) {
    return ins.logo_url;
  }
  return null;
}

export const emptyInsurerForm: InsurerFormData = {
  name: '',
  logo_url: '',
  primary_color: '',
  website_url: '',
  customer_service_phone: '',
  payment_phone: '',
  claims_phone: '',
  customer_service_whatsapp: '',
  claims_whatsapp: '',
  payment_url: '',
  ios_app_url: '',
  android_app_url: '',
  general_conditions_url: '',
  claims_instructions: '',
  is_active: true,
  show_in_directory: true,
  show_in_claims: true,
  display_order: 0,
};
