import type { Json } from '../types/database';

export type BlockType =
  | 'hero'
  | 'text_section'
  | 'feature_grid'
  | 'cta'
  | 'contact_form'
  | 'faq'
  | 'image_text'
  | 'testimonials'
  | 'visual_clone_section';

export interface HeroFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  placeholder?: string;
  required?: boolean;
}

export interface HeroForm {
  fields: HeroFormField[];
  submitLabel?: string;
}

export interface HeroData {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  primaryButtonText?: string;
  primaryButtonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  backgroundImage?: string;
  align?: 'left' | 'center';
  heroForm?: HeroForm;
}

export interface TextSectionData {
  eyebrow?: string;
  title?: string;
  body: string;
  align?: 'left' | 'center';
}

export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
  badge?: string;
}

export interface FeatureGridData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  columns?: 2 | 3 | 4;
  background?: 'white' | 'gray';
  items: FeatureItem[];
}

export interface CTAData {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  buttonText: string;
  buttonUrl: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  background?: 'brand' | 'dark' | 'light';
}

export interface ContactFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface ContactFormData {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  submitButtonText?: string;
  successMessage?: string;
  whatsappDirect?: string;
  fields: ContactFormField[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  items: FAQItem[];
}

export interface ImageTextData {
  eyebrow?: string;
  title: string;
  body: string;
  imageUrl: string;
  imageAlt?: string;
  imagePosition?: 'left' | 'right';
  buttonText?: string;
  buttonUrl?: string;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  avatarUrl?: string;
  rating?: number;
  company?: string;
}

export interface TestimonialsData {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  background?: 'white' | 'gray';
  items: TestimonialItem[];
}

export interface VisualCloneSectionData {
  label: string;
  html: string;
  css?: string;
  estimatedHeight?: number;
  hasImportedNav?: boolean;
  hasImportedFooter?: boolean;
  editableFields?: Record<string, string>;
  assets?: Record<string, string>;
  styleTokens?: Record<string, string>;
}

export interface Block {
  id: string;
  type: BlockType;
  data:
    | HeroData
    | TextSectionData
    | FeatureGridData
    | CTAData
    | ContactFormData
    | FAQData
    | ImageTextData
    | TestimonialsData
    | VisualCloneSectionData;
}

export interface PageSeoData {
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_url: string;
}

export interface PageGeoData {
  semantic_keywords: string[];
  topical_entities: string[];
  ai_summary: string;
  ai_context: string;
  content_topics: string[];
}

export interface UnifiedLanding {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: 'published' | 'draft' | 'modified';
  version: string;
  lastUpdated: string;
  creationMode: 'crick_ia' | 'block_builder' | 'ai_wizard' | 'template';
  views: number;
  conversion: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  blocks: Block[];
  seo: PageSeoData;
  geo?: PageGeoData;
  customComponent?: 'mutuus' | 'seguros-express' | 'seguros-education' | 'chava-agente';
  designOverrides?: Record<string, any>;
}

export interface HermesChatMessage {
  id: string;
  project_id: string;
  sender: 'hermes' | 'user';
  text: string;
  timestamp: string;
  actions?: string[];
  diffPreview?: {
    section: string;
    details: string;
  };
  designPatch?: Record<string, any>;
}
