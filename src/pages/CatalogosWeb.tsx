import { useState, useEffect } from 'react';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, Edit2, Save, X, GripVertical, Image as ImageIcon } from 'lucide-react';
import {
  getAllInsurers,
  getAllCategories,
  createInsurer,
  updateInsurer,
  createCategory,
  updateCategory
} from '../lib/webPagesUtils';
import type { WebPageInsurer, WebPageCategory } from '../lib/webPagesTypes';
import { supabase } from '../lib/supabase';

export default function CatalogosWeb() {
  const [insurers, setInsurers] = useState<WebPageInsurer[]>([]);
  const [categories, setCategories] = useState<WebPageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInsurerModal, setShowInsurerModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<WebPageInsurer | null>(null);
  const [editingCategory, setEditingCategory] = useState<WebPageCategory | null>(null);

  const [insurerForm, setInsurerForm] = useState({
    name: '',
    logo_url: '',
    website_url: '',
    display_order: 0,
    is_active: true
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    icon_url: '',
    card_title: '',
    card_description: '',
    display_order: 0,
    is_active: true
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [insurersData, categoriesData] = await Promise.all([
        getAllInsurers(),
        getAllCategories()
      ]);
      setInsurers(insurersData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading catalogs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(file: File, bucket: string, path: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async function handleSaveInsurer() {
    try {
      setUploading(true);

      let logo_url = insurerForm.logo_url;
      if (logoFile) {
        logo_url = await uploadImage(logoFile, 'web-page-assets', 'insurers/logo');
      }

      const insurerData = {
        ...insurerForm,
        logo_url,
        website_url: insurerForm.website_url || null
      };

      if (editingInsurer) {
        const updated = await updateInsurer(editingInsurer.id, insurerData);
        setInsurers(prev => prev.map(i => i.id === updated.id ? updated : i));
      } else {
        const created = await createInsurer(insurerData);
        setInsurers(prev => [...prev, created]);
      }

      closeInsurerModal();
    } catch (error) {
      console.error('Error saving insurer:', error);
      alert('Error al guardar la aseguradora');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveCategory() {
    try {
      setUploading(true);

      let icon_url = categoryForm.icon_url;
      if (iconFile) {
        icon_url = await uploadImage(iconFile, 'web-page-assets', 'categories/icon');
      }

      const categoryData = {
        ...categoryForm,
        icon_url: icon_url || null
      };

      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, categoryData);
        setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        const created = await createCategory(categoryData);
        setCategories(prev => [...prev, created]);
      }

      closeCategoryModal();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error al guardar el ramo');
    } finally {
      setUploading(false);
    }
  }

  async function toggleInsurerActive(insurer: WebPageInsurer) {
    try {
      const updated = await updateInsurer(insurer.id, { is_active: !insurer.is_active });
      setInsurers(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (error) {
      console.error('Error toggling insurer:', error);
    }
  }

  async function toggleCategoryActive(category: WebPageCategory) {
    try {
      const updated = await updateCategory(category.id, { is_active: !category.is_active });
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (error) {
      console.error('Error toggling category:', error);
    }
  }

  function openInsurerModal(insurer?: WebPageInsurer) {
    if (insurer) {
      setEditingInsurer(insurer);
      setInsurerForm({
        name: insurer.name,
        logo_url: insurer.logo_url,
        website_url: insurer.website_url || '',
        display_order: insurer.display_order,
        is_active: insurer.is_active
      });
    } else {
      setEditingInsurer(null);
      setInsurerForm({
        name: '',
        logo_url: '',
        website_url: '',
        display_order: insurers.length,
        is_active: true
      });
    }
    setLogoFile(null);
    setShowInsurerModal(true);
  }

  function closeInsurerModal() {
    setShowInsurerModal(false);
    setEditingInsurer(null);
    setLogoFile(null);
  }

  function openCategoryModal(category?: WebPageCategory) {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        slug: category.slug,
        icon_url: category.icon_url || '',
        card_title: category.card_title,
        card_description: category.card_description,
        display_order: category.display_order,
        is_active: category.is_active
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        slug: '',
        icon_url: '',
        card_title: '',
        card_description: '',
        display_order: categories.length,
        is_active: true
      });
    }
    setIconFile(null);
    setShowCategoryModal(true);
  }

  function closeCategoryModal() {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setIconFile(null);
  }

  function handleNameChange(value: string) {
    setCategoryForm(prev => ({
      ...prev,
      name: value,
      slug: prev.slug || value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }));
  }

  if (loading) {
    return (
      <Container>
        <PageHeader
          title="Catálogos Web"
          description="Gestiona aseguradoras y ramos para páginas web públicas"
        />
        <div className="text-center py-12">Cargando catálogos...</div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="Catálogos Web"
        description="Gestiona el contenido base para páginas web de asesores"
      />

      <Tabs defaultValue="insurers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="insurers">Aseguradoras ({insurers.length})</TabsTrigger>
          <TabsTrigger value="categories">Ramos ({categories.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="insurers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Aseguradoras Disponibles</h2>
            <Button onClick={() => openInsurerModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Aseguradora
            </Button>
          </div>

          <div className="grid gap-4">
            {insurers.map(insurer => (
              <Card key={insurer.id} className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />

                  <div className="w-20 h-12 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                    {insurer.logo_url ? (
                      <img
                        src={insurer.logo_url}
                        alt={insurer.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold">{insurer.name}</h3>
                    <p className="text-sm text-gray-500">Orden: {insurer.display_order}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 mr-2">
                      {insurer.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <Switch
                      checked={insurer.is_active}
                      onCheckedChange={() => toggleInsurerActive(insurer)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openInsurerModal(insurer)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {insurers.length === 0 && (
              <Card className="p-12 text-center text-gray-500">
                No hay aseguradoras configuradas. Agrega la primera.
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Ramos Disponibles</h2>
            <Button onClick={() => openCategoryModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Ramo
            </Button>
          </div>

          <div className="grid gap-4">
            {categories.map(category => (
              <Card key={category.id} className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />

                  <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center">
                    {category.icon_url ? (
                      <img
                        src={category.icon_url}
                        alt={category.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold">{category.card_title}</h3>
                    <p className="text-sm text-gray-600">{category.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{category.card_description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 mr-2">
                      {category.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => toggleCategoryActive(category)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCategoryModal(category)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}

            {categories.length === 0 && (
              <Card className="p-12 text-center text-gray-500">
                No hay ramos configurados. Agrega el primero.
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showInsurerModal} onOpenChange={setShowInsurerModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingInsurer ? 'Editar Aseguradora' : 'Nueva Aseguradora'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="insurer-name">Nombre *</Label>
              <Input
                id="insurer-name"
                value={insurerForm.name}
                onChange={(e) => setInsurerForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: AXA Seguros"
              />
            </div>

            <div>
              <Label htmlFor="insurer-logo">Logo *</Label>
              <Input
                id="insurer-logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
              {insurerForm.logo_url && !logoFile && (
                <div className="mt-2 p-2 border rounded bg-gray-50">
                  <img
                    src={insurerForm.logo_url}
                    alt="Preview"
                    className="h-16 object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="insurer-website">Sitio Web (opcional)</Label>
              <Input
                id="insurer-website"
                type="url"
                value={insurerForm.website_url}
                onChange={(e) => setInsurerForm(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://ejemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="insurer-order">Orden de Visualización</Label>
              <Input
                id="insurer-order"
                type="number"
                value={insurerForm.display_order}
                onChange={(e) => setInsurerForm(prev => ({ ...prev, display_order: parseInt(e.target.value) }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={insurerForm.is_active}
                onCheckedChange={(checked) => setInsurerForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Activa</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeInsurerModal}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveInsurer}
                disabled={!insurerForm.name || (!insurerForm.logo_url && !logoFile) || uploading}
              >
                <Save className="w-4 h-4 mr-2" />
                {uploading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Ramo' : 'Nuevo Ramo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nombre *</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Auto"
              />
            </div>

            <div>
              <Label htmlFor="category-slug">Slug (URL) *</Label>
              <Input
                id="category-slug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="auto"
              />
            </div>

            <div>
              <Label htmlFor="category-icon">Icono (opcional)</Label>
              <Input
                id="category-icon"
                type="file"
                accept="image/*"
                onChange={(e) => setIconFile(e.target.files?.[0] || null)}
              />
              {categoryForm.icon_url && !iconFile && (
                <div className="mt-2 p-2 border rounded bg-gray-50">
                  <img
                    src={categoryForm.icon_url}
                    alt="Preview"
                    className="h-12 object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="category-title">Título de la Card *</Label>
              <Input
                id="category-title"
                value={categoryForm.card_title}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, card_title: e.target.value }))}
                placeholder="Ej: Seguro de Auto"
              />
            </div>

            <div>
              <Label htmlFor="category-description">Descripción de la Card *</Label>
              <textarea
                id="category-description"
                value={categoryForm.card_description}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, card_description: e.target.value }))}
                placeholder="Descripción corta que aparecerá en la card"
                className="w-full px-3 py-2 border rounded-md min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="category-order">Orden de Visualización</Label>
              <Input
                id="category-order"
                type="number"
                value={categoryForm.display_order}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, display_order: parseInt(e.target.value) }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Activo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeCategoryModal}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveCategory}
                disabled={!categoryForm.name || !categoryForm.slug || !categoryForm.card_title || !categoryForm.card_description || uploading}
              >
                <Save className="w-4 h-4 mr-2" />
                {uploading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
