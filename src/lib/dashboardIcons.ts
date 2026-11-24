import type { LucideIcon } from 'lucide-react';
import {
  ShoppingBag,
  GraduationCap,
  TrendingUp,
  Megaphone,
  Bell,
  ClipboardList,
  Headphones,
  Clipboard,
  Target,
  MessageSquare,
  User,
  Camera,
  Sun,
  Moon,
  Sparkles,
  Trophy,
  BarChart3,
  Rocket,
  Gem,
  Star,
  Award,
  Building2,
  Landmark,
  Briefcase,
  FolderOpen,
  FileText,
} from 'lucide-react';

export const DASHBOARD_ICON_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'ShoppingBag', label: 'Tienda / MOVI Store', icon: ShoppingBag },
  { key: 'GraduationCap', label: 'Educación', icon: GraduationCap },
  { key: 'TrendingUp', label: 'Producción', icon: TrendingUp },
  { key: 'Megaphone', label: 'Mercadotecnia', icon: Megaphone },
  { key: 'Bell', label: 'Avisos', icon: Bell },
  { key: 'ClipboardList', label: 'Trámites', icon: ClipboardList },
  { key: 'Headphones', label: 'Centro de contacto', icon: Headphones },
  { key: 'Clipboard', label: 'Portapapeles', icon: Clipboard },
  { key: 'Target', label: 'Metas', icon: Target },
  { key: 'MessageSquare', label: 'Chat', icon: MessageSquare },
  { key: 'User', label: 'Perfil', icon: User },
  { key: 'Camera', label: 'Fotos', icon: Camera },
  { key: 'Sun', label: 'Día', icon: Sun },
  { key: 'Moon', label: 'Noche', icon: Moon },
  { key: 'Sparkles', label: 'Beta / destacado', icon: Sparkles },
  { key: 'Trophy', label: 'Convención / premio', icon: Trophy },
  { key: 'BarChart3', label: 'Gráfica', icon: BarChart3 },
  { key: 'Rocket', label: 'Lanzamiento', icon: Rocket },
  { key: 'Gem', label: 'Premium', icon: Gem },
  { key: 'Star', label: 'Favoritos', icon: Star },
  { key: 'Award', label: 'Reconocimiento', icon: Award },
  { key: 'Building2', label: 'Sucursal / corporativo', icon: Building2 },
  { key: 'Landmark', label: 'Dirección', icon: Landmark },
  { key: 'Briefcase', label: 'Trabajo', icon: Briefcase },
  { key: 'FolderOpen', label: 'Carpeta', icon: FolderOpen },
  { key: 'FileText', label: 'Documento', icon: FileText },
];

const ICON_BY_KEY = new Map(DASHBOARD_ICON_OPTIONS.map(opt => [opt.key, opt.icon] as const));

const LEGACY_EMOJI_TO_KEY: Record<string, string> = {
  '📦': 'ShoppingBag',
  '🛒': 'ShoppingBag',
  '🧺': 'ShoppingBag',
  '🎓': 'GraduationCap',
  '🧑‍🎓': 'GraduationCap',
  '📊': 'BarChart3',
  '📈': 'TrendingUp',
  '💼': 'Briefcase',
  '📣': 'Megaphone',
  '📢': 'Megaphone',
  '🔔': 'Bell',
  '📋': 'ClipboardList',
  '📝': 'FileText',
  '📄': 'FileText',
  '🗂️': 'FolderOpen',
  '📂': 'FolderOpen',
  '📞': 'Headphones',
  '💬': 'MessageSquare',
  '👤': 'User',
  '📸': 'Camera',
  '🎯': 'Target',
  '☀️': 'Sun',
  '🌤️': 'Sun',
  '🌙': 'Moon',
  '🚀': 'Rocket',
  '✨': 'Sparkles',
  '⭐': 'Star',
  '🏆': 'Trophy',
  '🥇': 'Trophy',
  '🥈': 'Trophy',
  '🥉': 'Trophy',
  '🏢': 'Building2',
  '🏛️': 'Landmark',
  '🏦': 'Landmark',
  '🌴': 'Sun',
  '✈️': 'Rocket',
  '🔴': 'Target',
};

export function resolveDashboardIcon(value?: string | null): LucideIcon {
  if (!value) return Sparkles;
  const direct = ICON_BY_KEY.get(value);
  if (direct) return direct;
  const mapped = LEGACY_EMOJI_TO_KEY[value];
  return (mapped && ICON_BY_KEY.get(mapped)) || Sparkles;
}

export function getDashboardIconKey(value?: string | null): string {
  if (!value) return 'Sparkles';
  if (ICON_BY_KEY.has(value)) return value;
  return LEGACY_EMOJI_TO_KEY[value] || 'Sparkles';
}
