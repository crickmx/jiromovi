import { useState, useMemo } from 'react';
import { Search, Phone, Globe, Smartphone, Shield } from 'lucide-react';
import { useAgentBrand } from '../lib/AgentBrandContext';

interface Aseguradora {
  id: string;
  nombre: string;
  logo: string;
  telefono: string;
  pagoOnline?: string;
  condicionesGenerales?: string;
  appIos?: string;
  appAndroid?: string;
}

const ASEGURADORAS: Aseguradora[] = [
  {
    id: 'qualitas',
    nombre: 'Qualitas',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/IogotipoQualitas-1-q7vo2ha7ft5k0jsjygalb57c17efv2nb97ef8mk6le.png',
    telefono: '800 800 2021',
    pagoOnline: 'https://bit.ly/30tjZNS',
    condicionesGenerales: 'https://www.qualitas.com.mx/web/qmx/condiciones-generales',
    appIos: 'https://apps.apple.com/mx/app/qm%C3%B3vil/id781266280',
    appAndroid: 'https://play.google.com/store/apps/details?id=mx.com.qualitas.QMovil&hl=es_MX',
  },
  {
    id: 'elpotosi',
    nombre: 'Seguros El Potosi',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/logo-100-q7vo0gwmtkeh6kpop30bh5guajb6ednzb961abjhq4.png',
    telefono: '800 480 3100',
    pagoOnline: 'https://pagos.elpotosi.com.mx/paginas/asegurado/busqueda.aspx',
    condicionesGenerales: 'https://elpotosi.com.mx/CondicionesGenerales.aspx',
    appIos: 'https://apps.apple.com/mx/app/seguros-el-potosi/id1278336231',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.elpotosi.android',
  },
  {
    id: 'zurich',
    nombre: 'Zurich',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/Zurich-01-q7vodjtrxkb4r7pnb8keocmrwku2iqli400apy59lq.png',
    telefono: '800 288 6911',
    pagoOnline: 'https://portaldecobro-zurich.banwire.com',
    condicionesGenerales: 'https://www.zurich.com.mx/es-mx/regulaciones',
    appIos: 'https://apps.apple.com/mx/app/zurich-connect/id1271722548',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.mx.zurich.connect&hl=es_MX',
  },
  {
    id: 'ana',
    nombre: 'ANA Seguros',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/Ana-01-q7vocapitild9xj6mp2bco0ne30g99mdxsozoo05we.png',
    telefono: '800 835 3262',
    pagoOnline: 'https://anaseguros.com.mx/anaweb/paga_tu_poliza.html',
    condicionesGenerales: 'https://www.anaseguros.com.mx/anaweb/condiciones_generales.html',
    appIos: 'https://apps.apple.com/mx/app/ana-go/id1208880726',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.seguros.anago&hl=es_MX',
  },
  {
    id: 'chubb',
    nombre: 'Chubb / ABA Seguros',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/Chubb-01-q7voc9romok2ybkjs6nos696sp531kinlo1i7e1k2m.png',
    telefono: '800 712 2828',
    pagoOnline: 'https://aba.chubb.com/pago-poliza',
    condicionesGenerales: 'https://www.chubb.com/mx-es/condiciones-generales.html',
    appIos: 'https://apps.apple.com/mx/app/aba-clientes/id1514647073',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.abachubb.appsiniestros&hl=es_MX',
  },
  {
    id: 'gnp',
    nombre: 'GNP',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/logo-GNP-scaled-q7vo0pd6j2q232debonyllbzn05hbnlkcf1elt6ynm.jpeg',
    telefono: '55 5227 9000',
    pagoOnline: 'https://www.gnp.com.mx/',
    condicionesGenerales: 'https://www.gnp.com.mx/condiciones-generales-soy-cliente-gnp',
    appIos: 'https://apps.apple.com/mx/app/soy-cliente-gnp/id540222216',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.gnp&hl=es_MX',
  },
  {
    id: 'hdi',
    nombre: 'HDI Seguros',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/HDI-01-q7vodf4kze4p55wh2oj9tvtgxnh8g92ufcqvbkc8gu.png',
    telefono: '800 667 3144',
    pagoOnline: 'https://www.hdi.com.mx/atencion-a-clientes/pago-de-polizas/',
    condicionesGenerales: 'https://www.hdi.com.mx/condiciones-generales/',
    appIos: 'https://apps.apple.com/mx/app/hdi-idriving/id1548021808',
    appAndroid: 'https://play.google.com/store/apps/details?id=com.hdi.idriving.drivingapp&hl=es_MX&gl=US',
  },
  {
    id: 'hir',
    nombre: 'HIR Seguros',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/hir_seguros-q7vo5owcsfjtol4m7c9pbu113lkl5ueap3n59nsseo.jpg',
    telefono: '800 734 8477',
    condicionesGenerales: 'https://hirseguros.mx/condiciones-generales/',
  },
  {
    id: 'bxplus',
    nombre: 'Ve por Mas BX+',
    logo: 'https://jiro.mx/wp-content/uploads/elementor/thumbs/bx-01-q7vophe0oun650domw8wtu8fdo0t8eyu32571egde8.png',
    telefono: '800 830 3676',
    condicionesGenerales: 'https://www.vepormas.com/fwpf/portal/documents/buscador',
  },
];

function LogoFallback({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 rounded-xl">
      <span className="text-lg font-bold text-neutral-400">{initials}</span>
    </div>
  );
}

function AseguradoraCard({ a, primary }: { a: Aseguradora; primary: string }) {
  const [logoError, setLogoError] = useState(false);
  const [phoneHover, setPhoneHover] = useState(false);
  const [condHover, setCondHover] = useState(false);

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
      style={{ ['--hover-border-color' as any]: primary + '30' }}
    >
      {/* Logo area */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-100 bg-white flex-shrink-0 shadow-sm">
          {logoError ? (
            <LogoFallback nombre={a.nombre} />
          ) : (
            <img
              src={a.logo}
              alt={a.nombre}
              className="w-full h-full object-contain p-1"
              onError={() => setLogoError(true)}
            />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-neutral-900 text-base leading-tight">{a.nombre}</h3>
          <a
            href={`tel:${a.telefono.replace(/\s/g, '')}`}
            className="flex items-center gap-1.5 mt-1.5"
            onClick={e => e.stopPropagation()}
            onMouseEnter={() => setPhoneHover(true)}
            onMouseLeave={() => setPhoneHover(false)}
          >
            <Phone
              className="w-3.5 h-3.5 transition-colors"
              style={{ color: phoneHover ? primary : '#a3a3a3' }}
            />
            <span
              className="text-sm font-medium transition-colors"
              style={{ color: phoneHover ? primary : '#525252' }}
            >
              {a.telefono}
            </span>
          </a>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-neutral-100" />

      {/* Actions */}
      <div className="px-5 py-4 space-y-2">
        {a.pagoOnline && (
          <button
            onClick={() => openLink(a.pagoOnline!)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-sm hover:opacity-90 hover:shadow-md"
            style={{ backgroundColor: primary }}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 opacity-80" />
              Pagar en linea
            </div>
            <span className="text-white/60 text-xs">→</span>
          </button>
        )}

        {a.condicionesGenerales && (
          <button
            onClick={() => openLink(a.condicionesGenerales!)}
            onMouseEnter={() => setCondHover(true)}
            onMouseLeave={() => setCondHover(false)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
            style={{
              backgroundColor: condHover ? primary + '08' : '#fafafa',
              borderColor: condHover ? primary + '40' : '#e5e5e5',
              color: condHover ? primary : '#404040',
            }}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 opacity-60" />
              Condiciones Generales
            </div>
            <span className="text-neutral-400 text-xs">→</span>
          </button>
        )}

        {(a.appIos || a.appAndroid) && (
          <div className="flex gap-2">
            {a.appIos && (
              <button
                onClick={() => openLink(a.appIos!)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" />
                App iOS
              </button>
            )}
            {a.appAndroid && (
              <button
                onClick={() => openLink(a.appAndroid!)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-all"
              >
                <Smartphone className="w-3.5 h-3.5" />
                App Android
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SeguwalletAseguradoras() {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const { brand } = useAgentBrand();
  const primary = brand.primaryColor;

  const filtered = useMemo(() => {
    if (!search.trim()) return ASEGURADORAS;
    const q = search.toLowerCase();
    return ASEGURADORAS.filter(a => a.nombre.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Aseguradoras</h1>
        <p className="text-sm text-neutral-500 mt-1">Acceso rapido a pagos, apps y condiciones generales</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
          style={{ color: searchFocused ? primary : '#a3a3a3' }}
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar aseguradora..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none transition-all shadow-sm"
          style={{
            borderColor: searchFocused ? primary + '80' : '#e5e5e5',
            boxShadow: searchFocused ? `0 0 0 3px ${primary}15` : undefined,
          }}
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <Search className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">Sin resultados para "{search}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <AseguradoraCard key={a.id} a={a} primary={primary} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-neutral-400 text-center pb-2">
        Informacion de referencia. Para reportar un siniestro, contacta directamente a tu aseguradora o a tu agente.
      </p>
    </div>
  );
}
