import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Clock, ArrowRight, Loader2,
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor,
  ChevronDown, Users, UserCheck, TreePine, Wheat, Tractor, ShieldCheck, Lock,
  Banknote, Eye, Smile, CalendarDays, PawPrint, KeyRound, Building, Frame,
  Cpu, DollarSign, Scale, AlertTriangle, Share2, Copy, Check, X,
  ExternalLink, ToggleLeft, MessageCircle, Link2, List,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchQuoteFormTemplates } from '../lib/quoteFormUtils';
import type { QuoteFormTemplate, FormCategory } from '../lib/quoteFormTypes';
import { CATEGORY_CONFIG } from '../lib/quoteFormTypes';
import {
  createSharedLink, fetchAgentSharedLinks, fetchSharedLinkByFormType,
  deactivateSharedLink,
} from '../lib/sharedQuoteFormUtils';
import type { SharedQuoteFormLink } from '../lib/sharedQuoteFormUtils';
import { PageHeader } from '@/components/ui/page-header';

const ICON_MAP: Record<string, React.ElementType> = {
  Home, Building2, Factory, Shield, Truck, Wrench, Heart,
  GraduationCap, Car, Store, Flame, Fuel, Briefcase, BadgeCheck,
  Baby, Leaf, Bus, Plane, Ship, HardHat, Cog, Settings, Thermometer, Monitor, FileText,
  Users, UserCheck, TreePine, Wheat, Tractor, ShieldCheck, Lock, Banknote,
  Eye, Smile, CalendarDays, PawPrint, KeyRound, Building, Frame, Cpu,
  DollarSign, Scale, AlertTriangle,
};

const CATEGORY_ORDER: FormCategory[] = [
  'Personas', 'Autos', 'Hogar', 'Empresarial', 'Responsabilidad Civil',
  'Fianzas y Credito', 'Agro', 'RC y Financiero', 'Transportes', 'Ingenieria', 'Especializados',
];

type ActiveTab = 'catalogo' | 'compartidos';

export default function FormulariosCotizacion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<QuoteFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalogo');

  // Share modal state
  const [shareTemplate, setShareTemplate] = useState<QuoteFormTemplate | null>(null);
  const [shareLink, setShareLink] = useState<SharedQuoteFormLink | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Shared links panel state
  const [sharedLinks, setSharedLinks] = useState<SharedQuoteFormLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    fetchQuoteFormTemplates()
      .then(t => { setTemplates(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'compartidos' && user) {
      setLinksLoading(true);
      fetchAgentSharedLinks(user.id)
        .then(links => setSharedLinks(links))
        .catch(() => {})
        .finally(() => setLinksLoading(false));
    }
  }, [activeTab, user]);

  const filteredTemplates = templates.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const groupedTemplates = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = filteredTemplates.filter(t => t.category === cat);
    if (items.length > 0) acc.push({ category: cat, items });
    return acc;
  }, [] as { category: FormCategory; items: QuoteFormTemplate[] }[]);

  const startForm = (template: QuoteFormTemplate) => {
    navigate(`/cotizar/formularios/nuevo/${template.form_type}`);
  };

  const openShare = async (template: QuoteFormTemplate) => {
    if (!user) return;
    setShareTemplate(template);
    setShareLink(null);
    setShareLoading(true);
    try {
      const existing = await fetchSharedLinkByFormType(user.id, template.form_type);
      setShareLink(existing);
    } catch { /* ignore */ }
    finally { setShareLoading(false); }
  };

  const closeShare = () => { setShareTemplate(null); setShareLink(null); setCopied(false); };

  const handleGenerateLink = async () => {
    if (!user || !shareTemplate) return;
    setShareLoading(true);
    try {
      const link = await createSharedLink(
        user.id,
        (user as any).oficina_id || null,
        shareTemplate.form_type,
        shareTemplate.title,
        shareTemplate.id,
      );
      setShareLink(link);
      if (activeTab === 'compartidos') {
        fetchAgentSharedLinks(user.id).then(setSharedLinks).catch(() => {});
      }
    } catch (err: any) {
      console.error('Error generating link:', err);
    } finally { setShareLoading(false); }
  };

  const handleDeactivate = async () => {
    if (!user || !shareLink) return;
    setShareLoading(true);
    try {
      await deactivateSharedLink(shareLink.id);
      setShareLink({ ...shareLink, status: 'inactive' });
      fetchAgentSharedLinks(user.id).then(setSharedLinks).catch(() => {});
    } catch { /* ignore */ }
    finally { setShareLoading(false); }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappShare = (url: string, title: string) => {
    const text = encodeURIComponent(`Hola, te comparto el formulario de cotizacion de ${title}: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formularios de Cotizacion"
        description="Selecciona un tipo de seguro para iniciar tu solicitud de cotizacion"
        icon={ClipboardList}
        backTo="/tramites"
        backLabel="Volver a Tramites"
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-white/10 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'catalogo'
              ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
          }`}
        >
          <FileText className="w-4 h-4" /> Catalogo
        </button>
        <button
          onClick={() => setActiveTab('compartidos')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'compartidos'
              ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
          }`}
        >
          <List className="w-4 h-4" /> Formularios compartidos
        </button>
      </div>

      {/* ── Tab: Catalogo ── */}
      {activeTab === 'catalogo' && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar tipo de seguro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las categorias</option>
                {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {groupedTemplates.map(({ category, items }) => {
                const catConfig = CATEGORY_CONFIG[category];
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-sm font-semibold ${catConfig.color}`}>{category}</span>
                      <span className="text-xs text-neutral-400">({items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(template => {
                        const Icon = ICON_MAP[template.icon] || FileText;
                        return (
                          <div
                            key={template.form_type}
                            className="group bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 rounded-xl ${catConfig.bg} ${catConfig.border} border`}>
                                <Icon className={`w-5 h-5 ${catConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                                  {template.title}
                                </h3>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{template.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-white/10">
                              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span>~{template.estimated_minutes} min</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => openShare(template)}
                                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Compartir formulario"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Compartir</span>
                                </button>
                                <button
                                  onClick={() => startForm(template)}
                                  className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                  Iniciar <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {groupedTemplates.length === 0 && (
                <div className="text-center py-16 text-neutral-500 dark:text-neutral-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No se encontraron formularios con los filtros aplicados.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Formularios Compartidos ── */}
      {activeTab === 'compartidos' && (
        <SharedLinksPanel
          links={sharedLinks}
          loading={linksLoading}
          onShare={(link) => {
            const tpl = templates.find(t => t.form_type === link.form_type);
            if (tpl) { setShareTemplate(tpl); setShareLink(link); }
          }}
          onCopy={copyLink}
          onWhatsapp={whatsappShare}
          onDeactivate={async (linkId) => {
            await deactivateSharedLink(linkId);
            if (user) fetchAgentSharedLinks(user.id).then(setSharedLinks).catch(() => {});
          }}
          copied={copied}
        />
      )}

      {/* ── Share Modal ── */}
      {shareTemplate && (
        <ShareModal
          template={shareTemplate}
          link={shareLink}
          loading={shareLoading}
          copied={copied}
          onClose={closeShare}
          onGenerate={handleGenerateLink}
          onDeactivate={handleDeactivate}
          onCopy={copyLink}
          onWhatsapp={whatsappShare}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Share Modal

function ShareModal({
  template, link, loading, copied, onClose, onGenerate, onDeactivate, onCopy, onWhatsapp,
}: {
  template: QuoteFormTemplate;
  link: SharedQuoteFormLink | null;
  loading: boolean;
  copied: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onDeactivate: () => void;
  onCopy: (url: string) => void;
  onWhatsapp: (url: string, title: string) => void;
}) {
  const isActive = link?.status === 'active';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Compartir formulario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Form name */}
          <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-white/5 rounded-xl">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-neutral-800 dark:text-white/80">{template.title}</span>
          </div>

          {loading && !link ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !link ? (
            <div className="text-center py-4">
              <Link2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500 mb-4">No existe un link activo para este formulario.</p>
              <button
                onClick={onGenerate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 mx-auto"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                Generar link
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
                <span className="text-xs text-neutral-400">
                  {link.submissions_count} {link.submissions_count === 1 ? 'respuesta' : 'respuestas'}
                </span>
              </div>

              {/* URL display */}
              <div className="bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-3">
                <p className="text-xs text-neutral-500 mb-1">Link publico</p>
                <p className="text-sm font-mono text-blue-700 dark:text-blue-400 break-all leading-snug">{link.public_url}</p>
              </div>

              {/* Action buttons */}
              {isActive && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onCopy(link.public_url)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-white/80 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado' : 'Copiar link'}
                  </button>
                  <button
                    onClick={() => onWhatsapp(link.public_url, template.title)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button
                    onClick={() => window.open(link.public_url, '_blank')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver formulario
                  </button>
                  <button
                    onClick={onDeactivate}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60"
                  >
                    <ToggleLeft className="w-4 h-4" /> Desactivar
                  </button>
                </div>
              )}

              {link.last_submission_at && (
                <p className="text-xs text-neutral-400 text-center">
                  Ultima respuesta: {new Date(link.last_submission_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared Links Panel

function SharedLinksPanel({
  links, loading, onShare, onCopy, onWhatsapp, onDeactivate, copied,
}: {
  links: SharedQuoteFormLink[];
  loading: boolean;
  onShare: (link: SharedQuoteFormLink) => void;
  onCopy: (url: string) => void;
  onWhatsapp: (url: string, title: string) => void;
  onDeactivate: (linkId: string) => Promise<void>;
  copied: boolean;
}) {
  const activeLinks = links.filter(l => l.status === 'active');
  const inactiveLinks = links.filter(l => l.status !== 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 dark:text-neutral-400">
        <Share2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium mb-1">Sin formularios compartidos</p>
        <p className="text-xs">Ve al catalogo y haz clic en "Compartir" para generar tu primer link.</p>
      </div>
    );
  }

  const lastSubmission = [...links]
    .filter(l => l.last_submission_at)
    .sort((a, b) => new Date(b.last_submission_at!).getTime() - new Date(a.last_submission_at!).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
          <p className="text-lg font-bold text-emerald-700">{activeLinks.length}</p>
          <p className="text-xs text-neutral-500">Links activos</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-lg font-bold text-blue-700">{links.length}</p>
          <p className="text-xs text-neutral-500">Links totales</p>
        </div>
        <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
          <p className="text-lg font-bold text-neutral-700 dark:text-white/70">{links.reduce((s, l) => s + l.submissions_count, 0)}</p>
          <p className="text-xs text-neutral-500">Respuestas totales</p>
        </div>
        <div className="bg-neutral-50 dark:bg-white/5 rounded-xl p-3">
          <p className="text-sm font-bold text-neutral-700 dark:text-white/70">
            {lastSubmission ? new Date(lastSubmission.last_submission_at!).toLocaleDateString('es-MX') : '—'}
          </p>
          <p className="text-xs text-neutral-500">Ultimo envio</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Formulario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider hidden md:table-cell">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Resp.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Creado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {[...activeLinks, ...inactiveLinks].map(link => (
                <tr key={link.id} className="hover:bg-neutral-50 dark:hover:bg-white/5/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900 dark:text-white text-sm">{link.form_title}</p>
                    <p className="text-xs text-neutral-400">{link.form_type}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate max-w-[200px]">
                      {link.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      link.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      link.status === 'inactive' ? 'bg-neutral-100 text-neutral-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        link.status === 'active' ? 'bg-emerald-500' :
                        link.status === 'inactive' ? 'bg-neutral-400' : 'bg-red-400'
                      }`} />
                      {link.status === 'active' ? 'Activo' : link.status === 'inactive' ? 'Inactivo' : 'Vencido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-neutral-700 dark:text-white/70 font-medium">{link.submissions_count}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-neutral-400">
                      {new Date(link.created_at).toLocaleDateString('es-MX')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {link.status === 'active' && (
                        <>
                          <button
                            onClick={() => onCopy(link.public_url)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                            title="Copiar link"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
                          </button>
                          <button
                            onClick={() => onWhatsapp(link.public_url, link.form_title)}
                            className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            title="Compartir por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          </button>
                          <button
                            onClick={() => window.open(link.public_url, '_blank')}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Abrir formulario"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onShare(link)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                        title="Ver opciones"
                      >
                        <Settings className="w-3.5 h-3.5 text-neutral-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
