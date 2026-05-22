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
import { fetchAgentSharedLinks, type SharedQuoteFormLink } from '../lib/sharedQuoteFormUtils';
import { supabase } from '../lib/supabase';

interface FormLinkMeta {
  icon: string;
  description: string;
  category: string;
}

const FORM_TYPE_META: Record<string, FormLinkMeta> = {
  auto: { icon: 'Car', description: 'Seguro para Autos', category: 'vehiculos' },
  vida: { icon: 'Heart', description: 'Seguro de Vida', category: 'personales' },
  gmm: { icon: 'Stethoscope', description: 'Gastos Medicos Mayores', category: 'personales' },
  gastos_medicos: { icon: 'Stethoscope', description: 'Gastos Medicos', category: 'personales' },
  salud: { icon: 'HeartPulse', description: 'Seguro de Salud', category: 'personales' },
  hogar: { icon: 'Home', description: 'Seguro de Hogar', category: 'hogar' },
  casa: { icon: 'Home', description: 'Seguro de Casa', category: 'hogar' },
  motocicleta: { icon: 'Bike', description: 'Seguro de Motocicleta', category: 'vehiculos' },
  moto: { icon: 'Bike', description: 'Seguro de Motocicleta', category: 'vehiculos' },
  accidentes_personales: { icon: 'ShieldAlert', description: 'Accidentes Personales', category: 'personales' },
  empresa: { icon: 'Building2', description: 'Seguro Empresarial', category: 'empresariales' },
  negocio: { icon: 'Building2', description: 'Seguro para Negocio', category: 'empresariales' },
  pyme: { icon: 'Store', description: 'Seguro para PyME', category: 'empresariales' },
  responsabilidad_civil: { icon: 'Shield', description: 'Responsabilidad Civil', category: 'empresariales' },
  rc: { icon: 'Shield', description: 'Responsabilidad Civil', category: 'empresariales' },
  transporte: { icon: 'Truck', description: 'Seguro de Transporte', category: 'vehiculos' },
  flotilla: { icon: 'Bus', description: 'Seguro de Flotilla', category: 'vehiculos' },
  viaje: { icon: 'Plane', description: 'Seguro de Viaje', category: 'especializados' },
  mascota: { icon: 'PawPrint', description: 'Seguro de Mascota', category: 'hogar' },
  dental: { icon: 'Smile', description: 'Seguro Dental', category: 'personales' },
  condominio: { icon: 'Building', description: 'Seguro Condominal', category: 'hogar' },
  incendio: { icon: 'Flame', description: 'Seguro contra Incendio', category: 'hogar' },
  construccion: { icon: 'HardHat', description: 'Seguro de Construccion', category: 'empresariales' },
  agricola: { icon: 'Leaf', description: 'Seguro Agricola', category: 'especializados' },
  educacion: { icon: 'GraduationCap', description: 'Seguro Educativo', category: 'personales' },
  ahorro: { icon: 'PiggyBank', description: 'Plan de Ahorro', category: 'personales' },
  retiro: { icon: 'Landmark', description: 'Plan de Retiro', category: 'personales' },
  taxi: { icon: 'CarTaxiFront', description: 'Seguro de Taxi', category: 'vehiculos' },
  eventos: { icon: 'Calendar', description: 'Seguro de Eventos', category: 'especializados' },
};

function getFormMeta(link: SharedQuoteFormLink): FormLinkMeta {
  const typeKey = link.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
  if (FORM_TYPE_META[typeKey]) return FORM_TYPE_META[typeKey];

  const title = link.form_title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, meta] of Object.entries(FORM_TYPE_META)) {
    if (title.includes(key.replace(/_/g, ' '))) return meta;
  }
  if (title.includes('auto') || title.includes('vehiculo')) return FORM_TYPE_META.auto;
  if (title.includes('vida')) return FORM_TYPE_META.vida;
  if (title.includes('gmm') || title.includes('medic')) return FORM_TYPE_META.gmm;
  if (title.includes('hogar') || title.includes('casa')) return FORM_TYPE_META.hogar;
  if (title.includes('empresa') || title.includes('pyme')) return FORM_TYPE_META.empresa;
  if (title.includes('moto')) return FORM_TYPE_META.moto;

  return { icon: 'FileText', description: 'Seguro especializado', category: 'otros' };
}

interface FormLinkDisplay {
  id: string;
  form_title: string;
  form_type: string;
  slug: string;
  featured_on_website: boolean;
  featured_order: number | null;
  meta: FormLinkMeta;
  status: string;
}

export default function MiPaginaWeb() {
  const { user, usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insurers, setInsurers] = useState<WebPageInsurer[]>([]);
  const [formLinks, setFormLinks] = useState<FormLinkDisplay[]>([]);

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
      const [insurersData, existingConfig, links] = await Promise.all([
        getActiveInsurers(),
        getUserWebPageConfig(user.id),
        fetchAgentSharedLinks(user.id)
      ]);

      setInsurers(insurersData);

      if (existingConfig) {
        setConfig(existingConfig);
      }

      const activeLinks = links
        .filter(l => l.status === 'active')
        .map(l => ({
          id: l.id,
          form_title: l.form_title,
          form_type: l.form_type,
          slug: l.slug,
          featured_on_website: (l as any).featured_on_website ?? false,
          featured_order: (l as any).featured_order ?? null,
          meta: getFormMeta(l),
          status: l.status
        }));

      setFormLinks(activeLinks);
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

      for (const link of formLinks) {
        await supabase
          .from('shared_quote_form_links')
          .update({
            featured_on_website: link.featured_on_website,
            featured_order: link.featured_order
          })
          .eq('id', link.id);
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

  function toggleFeatured(linkId: string) {
    setFormLinks(prev => prev.map(link => {
      if (link.id !== linkId) return link;
      const newFeatured = !link.featured_on_website;
      return {
        ...link,
        featured_on_website: newFeatured,
        featured_order: newFeatured ? (getFeaturedCount() + 1) : null
      };
    }));
  }

  function getFeaturedCount(): number {
    return formLinks.filter(l => l.featured_on_website).length;
  }

  function moveFeaturedUp(linkId: string) {
    setFormLinks(prev => {
      const featured = prev.filter(l => l.featured_on_website).sort((a, b) => (a.featured_order || 99) - (b.featured_order || 99));
      const idx = featured.findIndex(l => l.id === linkId);
      if (idx <= 0) return prev;

      const prevLink = featured[idx - 1];
      return prev.map(l => {
        if (l.id === linkId) return { ...l, featured_order: prevLink.featured_order };
        if (l.id === prevLink.id) return { ...l, featured_order: featured[idx].featured_order };
        return l;
      });
    });
  }

  function moveFeaturedDown(linkId: string) {
    setFormLinks(prev => {
      const featured = prev.filter(l => l.featured_on_website).sort((a, b) => (a.featured_order || 99) - (b.featured_order || 99));
      const idx = featured.findIndex(l => l.id === linkId);
      if (idx >= featured.length - 1) return prev;

      const nextLink = featured[idx + 1];
      return prev.map(l => {
        if (l.id === linkId) return { ...l, featured_order: nextLink.featured_order };
        if (l.id === nextLink.id) return { ...l, featured_order: featured[idx].featured_order };
        return l;
      });
    });
  }

  const featuredLinks = formLinks
    .filter(l => l.featured_on_website)
    .sort((a, b) => (a.featured_order || 99) - (b.featured_order || 99));

  const previewFormLinks = formLinks.map(l => ({
    slug: l.slug,
    form_title: l.form_title,
    form_type: l.form_type,
    form_slug: l.slug,
    quote_form_template_id: null,
    featured_on_website: l.featured_on_website,
    featured_order: l.featured_order
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
              Marca con estrella los tipos de seguro destacados en tu pagina (max. 6 recomendado).
              Se muestran segun tus formularios de cotizacion activos.
            </p>

            {formLinks.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-sm text-gray-500">
                  No tienes formularios de cotizacion activos.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Crea formularios compartidos desde la seccion de Formularios de Cotizacion.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {formLinks.map(link => {
                  const IconComponent = (LucideIcons as any)[link.meta.icon];
                  return (
                    <div
                      key={link.id}
                      className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                        link.featured_on_website
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFeatured(link.id)}
                        className={`flex-shrink-0 p-1 rounded transition-colors ${
                          link.featured_on_website
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-gray-300 hover:text-amber-400'
                        }`}
                        title={link.featured_on_website ? 'Quitar de destacados' : 'Marcar como destacado'}
                      >
                        <Star className={`w-4 h-4 ${link.featured_on_website ? 'fill-current' : ''}`} />
                      </button>

                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${config.primary_color}15` }}
                      >
                        {IconComponent && <IconComponent className="w-4 h-4" style={{ color: config.primary_color }} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{link.form_title}</p>
                        <p className="text-xs text-gray-500 truncate">{link.meta.description}</p>
                      </div>

                      {link.featured_on_website && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 flex-shrink-0">
                          Destacado
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {featuredLinks.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Orden de destacados ({featuredLinks.length}):
                </p>
                <div className="space-y-1">
                  {featuredLinks.map((link, idx) => {
                    const IconComponent = (LucideIcons as any)[link.meta.icon];
                    return (
                      <div key={link.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
                        <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="w-4 text-center font-bold text-amber-700">{idx + 1}</span>
                        {IconComponent && <IconComponent className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
                        <span className="flex-1 truncate font-medium">{link.form_title}</span>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveFeaturedUp(link.id)}
                            disabled={idx === 0}
                            className="px-1 py-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            &#8593;
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFeaturedDown(link.id)}
                            disabled={idx === featuredLinks.length - 1}
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
