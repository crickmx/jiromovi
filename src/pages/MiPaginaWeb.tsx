import { useState, useEffect } from 'react';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { ExternalLink, Save, CheckCircle2, AlertCircle, Star, GripVertical } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getActiveInsurers,
  getUserWebPageConfig,
  saveUserWebPageConfig
} from '../lib/webPagesUtils';
import {
  DEFAULT_COLORS,
  DEFAULT_TEXT,
  type WebPageInsurer,
  type UserWebPageConfig
} from '../lib/webPagesTypes';
import PublicWebPagePreview from '../components/webPages/PublicWebPagePreview';
import { getDisplayName } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface FormTemplate {
  id: string;
  form_type: string;
  title: string;
  category: string;
  icon: string;
  slug: string | null;
}

interface FeaturedEntry {
  form_template_id: string;
  featured_order: number;
}

const DEFAULT_FEATURED_TYPES = [
  'auto_individual',
  'vida_individual',
  'gmm_individual',
  'hogar_casa_habitacion',
  'accidentes_personales_individual',
  'empresa_paquete'
];

export default function MiPaginaWeb() {
  const { user, usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insurers, setInsurers] = useState<WebPageInsurer[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [featuredOrder, setFeaturedOrder] = useState<string[]>([]);

  const [config, setConfig] = useState<UserWebPageConfig>({
    primary_color: DEFAULT_COLORS.primary,
    secondary_color: DEFAULT_COLORS.secondary,
    custom_text: DEFAULT_TEXT,
    is_published: false,
    selected_insurer_ids: [],
    selected_category_ids: []
  });

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    if (!user?.id) return;

    try {
      const [insurersData, existingConfig, templatesData, featuredData] = await Promise.all([
        getActiveInsurers(),
        getUserWebPageConfig(user.id),
        supabase
          .from('quote_form_templates')
          .select('id, form_type, title, category, icon, slug')
          .eq('is_active', true)
          .order('category')
          .order('title'),
        supabase
          .from('user_web_featured_forms')
          .select('form_template_id, featured_order')
          .eq('user_id', user.id)
          .order('featured_order')
      ]);

      setInsurers(insurersData);

      if (existingConfig) {
        setConfig(existingConfig);
      }

      const allTemplates: FormTemplate[] = templatesData.data || [];
      setTemplates(allTemplates);

      const featured: FeaturedEntry[] = featuredData.data || [];

      if (featured.length > 0) {
        const ids = new Set(featured.map(f => f.form_template_id));
        setFeaturedIds(ids);
        setFeaturedOrder(featured.map(f => f.form_template_id));
      } else {
        const defaultIds = new Set(
          allTemplates
            .filter(t => DEFAULT_FEATURED_TYPES.includes(t.form_type))
            .map(t => t.id)
        );
        setFeaturedIds(defaultIds);
        setFeaturedOrder(
          allTemplates
            .filter(t => DEFAULT_FEATURED_TYPES.includes(t.form_type))
            .sort((a, b) => DEFAULT_FEATURED_TYPES.indexOf(a.form_type) - DEFAULT_FEATURED_TYPES.indexOf(b.form_type))
            .map(t => t.id)
        );
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user?.id) return;

    try {
      setSaving(true);
      await saveUserWebPageConfig(user.id, config);

      await supabase
        .from('user_web_featured_forms')
        .delete()
        .eq('user_id', user.id);

      if (featuredOrder.length > 0) {
        const rows = featuredOrder.map((templateId, idx) => ({
          user_id: user.id,
          form_template_id: templateId,
          featured_order: idx + 1
        }));

        await supabase
          .from('user_web_featured_forms')
          .insert(rows);
      }

      alert('Configuracion guardada exitosamente');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuracion');
    } finally {
      setSaving(false);
    }
  }

  function toggleInsurer(insurerId: string) {
    setConfig(prev => ({
      ...prev,
      selected_insurer_ids: prev.selected_insurer_ids.includes(insurerId)
        ? prev.selected_insurer_ids.filter(id => id !== insurerId)
        : [...prev.selected_insurer_ids, insurerId]
    }));
  }

  function toggleFeatured(templateId: string) {
    setFeaturedIds(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
        setFeaturedOrder(order => order.filter(id => id !== templateId));
      } else {
        next.add(templateId);
        setFeaturedOrder(order => [...order, templateId]);
      }
      return next;
    });
  }

  function moveFeaturedUp(templateId: string) {
    setFeaturedOrder(prev => {
      const idx = prev.indexOf(templateId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveFeaturedDown(templateId: string) {
    setFeaturedOrder(prev => {
      const idx = prev.indexOf(templateId);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  const groupedTemplates = templates.reduce<Record<string, FormTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const previewFormLinks = templates.map(t => ({
    slug: t.slug || t.form_type,
    form_title: t.title,
    form_type: t.form_type,
    form_slug: t.slug || t.form_type,
    quote_form_template_id: t.id,
    featured_on_website: featuredIds.has(t.id),
    featured_order: featuredOrder.indexOf(t.id) >= 0 ? featuredOrder.indexOf(t.id) + 1 : null
  }));

  if (loading) {
    return (
      <Container>
        <PageHeader
          title="Mi Pagina Web"
          description="Configura tu landing page publica"
        />
        <div className="text-center py-12">Cargando configuracion...</div>
      </Container>
    );
  }

  return (
    <Container className="max-w-full">
      <PageHeader
        title="Mi Pagina Web"
        description="Crea y personaliza tu pagina web publica profesional"
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Estado de Publicacion</h2>

            {!usuario?.web_slug ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Slug no configurado</p>
                    <p className="text-yellow-700 mt-1">
                      Contacta a tu gerente para que te asigne un slug personalizado.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Switch
                    checked={config.is_published}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_published: checked }))}
                    disabled={!usuario?.web_slug}
                  />
                  <div>
                    <Label className="text-sm">
                      {config.is_published ? 'Pagina Publicada' : 'Pagina No Publicada'}
                    </Label>
                  </div>
                </div>

                {config.is_published && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 mb-1">Tu pagina esta en linea</p>
                        <a
                          href={`https://agentedeseguros.website/${usuario?.web_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver pagina publica
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Colores</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="primary-color" className="text-sm">Color Primario</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="primary-color"
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    type="text"
                    value={config.primary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1 text-sm"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondary-color" className="text-sm">Color Secundario</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={config.secondary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    type="text"
                    value={config.secondary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="flex-1 text-sm"
                    placeholder="#059669"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Aseguradoras</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {insurers.map(insurer => (
                <label
                  key={insurer.id}
                  className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.selected_insurer_ids.includes(insurer.id)}
                    onChange={() => toggleInsurer(insurer.id)}
                    className="w-4 h-4"
                  />
                  <div className="w-12 h-6 flex items-center">
                    <img
                      src={insurer.logo_url}
                      alt={insurer.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <span className="text-sm font-medium">{insurer.name}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold mb-1">Ramos que Ofreces</h2>
            <p className="text-xs text-gray-500 mb-3">
              Todos los ramos se muestran en tu pagina. Marca con estrella los destacados (3-6 recomendado).
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {Object.entries(groupedTemplates).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 sticky top-0 bg-white py-1">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {items.map(template => {
                      const IconComponent = (LucideIcons as any)[template.icon];
                      const isFeatured = featuredIds.has(template.id);
                      return (
                        <div
                          key={template.id}
                          className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                            isFeatured
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleFeatured(template.id)}
                            className={`flex-shrink-0 p-1 rounded transition-colors ${
                              isFeatured
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-gray-300 hover:text-amber-400'
                            }`}
                            title={isFeatured ? 'Quitar de destacados' : 'Marcar como destacado'}
                          >
                            <Star className={`w-4 h-4 ${isFeatured ? 'fill-current' : ''}`} />
                          </button>

                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${config.primary_color}15` }}
                          >
                            {IconComponent && <IconComponent className="w-3.5 h-3.5" style={{ color: config.primary_color }} />}
                          </div>

                          <span className="text-sm font-medium flex-1 truncate">{template.title}</span>

                          {isFeatured && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 flex-shrink-0">
                              Destacado
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {featuredOrder.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Orden de destacados ({featuredOrder.length}):
                </p>
                <div className="space-y-1">
                  {featuredOrder.map((templateId, idx) => {
                    const template = templates.find(t => t.id === templateId);
                    if (!template) return null;
                    const IconComponent = (LucideIcons as any)[template.icon];
                    return (
                      <div key={templateId} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
                        <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="w-4 text-center font-bold text-amber-700">{idx + 1}</span>
                        {IconComponent && <IconComponent className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                        <span className="flex-1 truncate font-medium">{template.title}</span>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveFeaturedUp(templateId)}
                            disabled={idx === 0}
                            className="px-1 py-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            &#8593;
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFeaturedDown(templateId)}
                            disabled={idx === featuredOrder.length - 1}
                            className="px-1 py-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            &#8595;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Sobre Mi</h2>
            <p className="text-xs text-gray-600 mb-3">
              Escribe sobre ti, tu experiencia y lo que haces especial como asesor. Separa parrafos con lineas vacias.
            </p>
            <div className="relative">
              <textarea
                value={config.custom_text}
                onChange={(e) => setConfig(prev => ({ ...prev, custom_text: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl min-h-[240px] text-sm focus:border-accent focus:outline-none transition-colors resize-none shadow-sm"
                placeholder="Como tu asesor personal de seguros, mi compromiso es brindarte atencion especializada...&#10;&#10;Trabajo con las mejores aseguradoras del mercado...&#10;&#10;Mi objetivo es que tomes decisiones informadas..."
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                {config.custom_text.split('\n\n').filter(p => p.trim()).length} parrafo(s)
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 bg-white pt-2 pb-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Vista Previa</h2>
              <span className="text-xs text-gray-500">En vivo</span>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="bg-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
                <span className="flex-1 text-center">
                  agentedeseguros.website/{usuario?.web_slug || 'tu-slug'}
                </span>
              </div>

              <div className="h-[calc(100vh-14rem)] overflow-y-auto">
                <PublicWebPagePreview
                  config={config}
                  insurers={insurers.filter(i => config.selected_insurer_ids.includes(i.id))}
                  formLinks={previewFormLinks}
                  userData={{
                    name: getDisplayName(usuario),
                    email: usuario?.email_laboral || '',
                    phone: usuario?.celular_laboral || '',
                    photo_url: usuario?.imagen_perfil_url || null,
                    logo_url: usuario?.mi_logotipo_url || null,
                    office_name: usuario?.oficina?.nombre || '',
                    web_slug: usuario?.web_slug || null
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}
