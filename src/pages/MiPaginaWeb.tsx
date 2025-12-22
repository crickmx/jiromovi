import { useState, useEffect } from 'react';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { ExternalLink, Save, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
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
    custom_text: [...DEFAULT_TEXT],
    is_published: false,
    selected_insurer_ids: [],
    selected_category_ids: []
  });

  const [showPreview, setShowPreview] = useState(false);

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

  function updateParagraph(index: number, value: string) {
    setConfig(prev => {
      const newText = [...prev.custom_text];
      newText[index] = value;
      return { ...prev, custom_text: newText };
    });
  }

  function addParagraph() {
    if (config.custom_text.length >= 5) return;
    setConfig(prev => ({
      ...prev,
      custom_text: [...prev.custom_text, '']
    }));
  }

  function removeParagraph(index: number) {
    setConfig(prev => ({
      ...prev,
      custom_text: prev.custom_text.filter((_, i) => i !== index)
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
    <Container>
      <PageHeader
        title="Mi Página Web"
        description="Crea y personaliza tu página web pública profesional"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Estado de Publicación</h2>

            {!usuario?.web_slug ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Slug no configurado</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Contacta a tu gerente para que te asigne un slug personalizado.
                      Con el slug podrás publicar tu página en agentedeseguros.online/tu-slug
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={config.is_published}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_published: checked }))}
                      disabled={!usuario?.web_slug}
                    />
                    <div>
                      <Label className="text-base">
                        {config.is_published ? 'Página Publicada' : 'Página No Publicada'}
                      </Label>
                      <p className="text-sm text-gray-500">
                        {config.is_published
                          ? 'Tu página está visible públicamente'
                          : 'Tu página no es accesible públicamente'}
                      </p>
                    </div>
                  </div>
                </div>

                {config.is_published && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-800 mb-2">Tu página está en línea</p>
                        <a
                          href={`https://agentedeseguros.online/${usuario?.web_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          agentedeseguros.online/{usuario?.web_slug}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Colores</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary-color">Color Primario</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={config.primary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondary-color">Color Secundario</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={config.secondary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={config.secondary_color}
                    onChange={(e) => setConfig(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="flex-1"
                    placeholder="#7c3aed"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Aseguradoras</h2>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona las aseguradoras con las que trabajas
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {insurers.map(insurer => (
                <label
                  key={insurer.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.selected_insurer_ids.includes(insurer.id)}
                    onChange={() => toggleInsurer(insurer.id)}
                    className="w-4 h-4"
                  />
                  <div className="w-16 h-8 flex items-center">
                    <img
                      src={insurer.logo_url}
                      alt={insurer.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <span className="font-medium">{insurer.name}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Ramos que Ofreces</h2>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona los tipos de seguro que ofreces
            </p>
            <div className="space-y-2">
              {categories.map(category => (
                <label
                  key={category.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.selected_category_ids.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">{category.card_title}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Texto Personalizado</h2>
            <p className="text-sm text-gray-600 mb-4">
              Escribe hasta 5 párrafos sobre ti y tus servicios (opcional)
            </p>
            <div className="space-y-4">
              {config.custom_text.map((paragraph, index) => (
                <div key={index} className="relative">
                  <Label>Párrafo {index + 1}</Label>
                  <div className="flex gap-2">
                    <textarea
                      value={paragraph}
                      onChange={(e) => updateParagraph(index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md min-h-[80px]"
                      placeholder="Escribe un párrafo..."
                    />
                    {config.custom_text.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeParagraph(index)}
                        className="self-start"
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {config.custom_text.length < 5 && (
                <Button variant="outline" onClick={addParagraph} className="w-full">
                  Agregar Párrafo
                </Button>
              )}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-4 h-4 mr-2" />
              {showPreview ? 'Ocultar' : 'Ver'} Vista Previa
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Vista Previa</h2>
              <span className="text-sm text-gray-500">En vivo</span>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="bg-gray-100 px-3 py-2 text-xs text-gray-600 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                </div>
                <span className="flex-1 text-center">
                  agentedeseguros.online/{usuario?.web_slug || 'tu-slug'}
                </span>
              </div>

              <div className="h-[600px] overflow-y-auto">
                <PublicWebPagePreview
                  config={config}
                  insurers={insurers.filter(i => config.selected_insurer_ids.includes(i.id))}
                  categories={categories.filter(c => config.selected_category_ids.includes(c.id))}
                  userData={{
                    name: usuario?.nombre_completo || '',
                    email: usuario?.email_laboral || '',
                    phone: usuario?.celular_laboral || '',
                    photo_url: usuario?.foto_url || null,
                    office_name: usuario?.oficina?.name || ''
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
