import React, { useState } from 'react';
import { X, Settings, Globe, Palette, Share2, Save, Check } from 'lucide-react';
import type { UnifiedLanding } from '../types';

interface LandingSettingsModalProps {
  landing: UnifiedLanding;
  onClose: () => void;
  onSave: (updated: UnifiedLanding) => void;
}

export function LandingSettingsModal({ landing, onClose, onSave }: LandingSettingsModalProps) {
  const [name, setName] = useState(landing.name);
  const [slug, setSlug] = useState(landing.slug);
  const [description, setDescription] = useState(landing.description);
  const [category, setCategory] = useState(landing.category);
  const [primaryColor, setPrimaryColor] = useState(landing.primary_color || '#F97316');
  const [secondaryColor, setSecondaryColor] = useState(landing.secondary_color || '#7E3AF2');
  const [metaTitle, setMetaTitle] = useState(landing.seo?.meta_title || '');
  const [metaDesc, setMetaDesc] = useState(landing.seo?.meta_description || '');
  const [phone, setPhone] = useState(landing.phone || '');
  const [whatsapp, setWhatsapp] = useState(landing.whatsapp || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanSlug = slug.trim();
    if (!cleanSlug.startsWith('/')) cleanSlug = '/' + cleanSlug;

    const updated: UnifiedLanding = {
      ...landing,
      name,
      slug: cleanSlug,
      description,
      category,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      phone,
      whatsapp,
      seo: {
        ...landing.seo,
        meta_title: metaTitle,
        meta_description: metaDesc,
        canonical_url: `https://landings.movi.digital${cleanSlug}`
      }
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-200 space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#F97316]" />
            <h3 className="font-black text-base text-gray-900">Configuración de Landing</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la Landing</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Slug / Ruta</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Meta Título (SEO)</label>
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Título que aparecerá en Google"
              className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Meta Descripción (SEO)</label>
            <textarea
              rows={2}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Descripción corta para buscadores y redes sociales"
              className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Color Primario</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl px-2 py-1.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp de Contacto</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="525540001234"
                className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
