export interface WebPageInsurer {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebPageCategory {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  lucide_icon: string | null;
  card_title: string;
  card_description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWebPage {
  id: string;
  user_id: string;
  primary_color: string;
  secondary_color: string;
  custom_text: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWebPageInsurer {
  user_web_page_id: string;
  insurer_id: string;
  created_at: string;
}

export interface UserWebPageCategory {
  user_web_page_id: string;
  category_id: string;
  created_at: string;
}

export interface PublicWebPageData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    photo_url: string | null;
    office: {
      name: string;
      logo_url: string | null;
    } | null;
  };
  config: {
    primary_color: string;
    secondary_color: string;
    custom_text: string;
    is_published: boolean;
  };
  insurers: Array<{
    id: string;
    name: string;
    logo_url: string;
    website_url: string | null;
  }> | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    icon_url: string | null;
    lucide_icon: string | null;
    card_title: string;
    card_description: string;
  }> | null;
}

export interface UserWebPageConfig {
  id?: string;
  primary_color: string;
  secondary_color: string;
  custom_text: string;
  is_published: boolean;
  selected_insurer_ids: string[];
  selected_category_ids: string[];
}

export const DEFAULT_COLORS = {
  primary: '#2563eb',
  secondary: '#7c3aed'
};

export const DEFAULT_TEXT = 'Como tu asesor personal de seguros, mi compromiso es brindarte atención especializada y soluciones a la medida de tus necesidades.\n\nTrabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas y coberturas completas.\n\nMi objetivo es que tomes decisiones informadas y encuentres el seguro perfecto para proteger lo que más valoras.\n\nCuento con años de experiencia en el sector asegurador y estoy certificado por las principales instituciones.\n\nContáctame por WhatsApp para una cotización personalizada sin compromiso.';
