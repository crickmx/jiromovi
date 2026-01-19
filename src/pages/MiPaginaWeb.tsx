import { useState, useEffect } from 'react';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { ExternalLink, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getActiveInsurers,
  getActiveCategories,
  getUserWebPageConfig,
  saveUserWebPageConfig
} from '../lib/webPagesUtils';
import {
  DEFAULT_COLORS,
  DEFAULT_TEXT,
  type WebPageInsurer,
  type WebPageCategory,
  type UserWebPageConfig
} from '../lib/webPagesTypes';
import PublicWebPagePreview from '../components/webPages/PublicWebPagePreview';

export default function MiPaginaWeb() {
  const { user, usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insurers, setInsurers] = useState<WebPageInsurer[]>([]);
  const [categories, setCategories] = useState<WebPageCategory[]>([]);

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
      const [insurersData, categoriesData, existingConfig] = await Promise.all([
        getActiveInsurers(),
        getActiveCategories(),
        getUserWebPageConfig(user.id)
      ]);

      setInsurers(insurersData);
      setCategories(categoriesData);

      if (existingConfig) {
        setConfig(existingConfig);
      } else {
        setConfig(prev => ({
          ...prev,
          selected_category_ids: categoriesData.slice(0, 5).map(c => c.id)
        }));
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
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración');
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

  function toggleCategory(categoryId: string) {
    setConfig(prev => ({
      ...prev,
      selected_category_ids: prev.selected_category_ids.includes(categoryId)
        ? prev.selected_category_ids.filter(id => id !== categoryId)
        : [...prev.selected_category_ids, categoryId]
    }));
  }

  if (loading) {
    return (
      <Container>
        <PageHeader
          title="Mi Página Web"
          description="Configura tu landing page pública"
        />
        <div className="text-center py-12">Cargando configuración...</div>
      </Container>
    );
  }

  return (
    <Container className="max-w-full">
      <PageHeader
        title="Mi Página Web"
        description="Crea y personaliza tu página web pública profesional"
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Estado de Publicación</h2>

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
                      {config.is_published ? 'Página Publicada' : 'Página No Publicada'}
                    </Label>
                  </div>
                </div>

                {config.is_published && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 mb-1">Tu página está en línea</p>
                        <a
                          href={`https://agentedeseguros.website/${usuario?.web_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver página pública
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
                    placeholder="#7c3aed"
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
            <h2 className="text-base font-semibold mb-3">Ramos que Ofreces</h2>
            <div className="space-y-2">
              {categories.map(category => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.selected_category_ids.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">{category.card_title}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-base font-semibold mb-3">Sobre Mí</h2>
            <p className="text-xs text-gray-600 mb-3">
              Escribe sobre ti, tu experiencia y lo que haces especial como asesor. Separa párrafos con líneas vacías.
            </p>
            <div className="relative">
              <textarea
                value={config.custom_text}
                onChange={(e) => setConfig(prev => ({ ...prev, custom_text: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl min-h-[240px] text-sm focus:border-primary-500 focus:outline-none transition-colors resize-none shadow-sm"
                placeholder="Como tu asesor personal de seguros, mi compromiso es brindarte atención especializada...&#10;&#10;Trabajo con las mejores aseguradoras del mercado...&#10;&#10;Mi objetivo es que tomes decisiones informadas..."
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                {config.custom_text.split('\n\n').filter(p => p.trim()).length} párrafo(s)
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <span className="font-medium">💡 Tip:</span> Usa doble salto de línea para separar párrafos
            </p>
          </Card>

          <div className="sticky bottom-0 bg-white pt-2 pb-4">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
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
                  categories={categories.filter(c => config.selected_category_ids.includes(c.id))}
                  userData={{
                    name: usuario?.nombre_completo || '',
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
