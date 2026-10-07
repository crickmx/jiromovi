export type ProjectStatus = 'live' | 'draft' | 'updating';

export interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  badge?: string;
  popular?: boolean;
  description: string;
  features: string[];
  ctaLabel: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  company?: string;
  avatar: string;
  rating: number;
  quote: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
}

export interface ProjectTheme {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  borderRadius: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  headerStyle: 'solid' | 'glass' | 'floating';
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  logoUrl?: string;
  heroBadge: string;
  heroHeadline: string;
  heroHeadlineHighlight: string;
  heroSubheadline: string;
  heroCtaPrimary: string;
  heroCtaPrimaryLink: string;
  heroCtaSecondary: string;
  heroCtaSecondaryLink: string;
  heroImageUrl?: string;
  status: ProjectStatus;
  theme: ProjectTheme;
  stats: StatItem[];
  features: FeatureItem[];
  pricingPlans: PricingPlan[];
  testimonials: TestimonialItem[];
  faqs: FAQItem[];
  partnerLogos: string[];
  whatsappNumber?: string;
  contactEmail?: string;
  customCss?: string;
  version: number;
  lastPublishedAt?: string;
  updatedAt: string;
  publishedUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'hermes' | 'system';
  text: string;
  timestamp: string;
  appliedChanges?: {
    summary: string;
    fields: string[];
    diff?: Record<string, any>;
  };
  suggestions?: string[];
}

export interface VersionSnapshot {
  id: string;
  projectId: string;
  versionNumber: number;
  timestamp: string;
  note: string;
  snapshot: Project;
}
