import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, Building2, Car, CheckCircle2, ChevronRight, HeartPulse,
  Home, Mail, MapPin, Menu, Phone, ShieldCheck, Sparkles, X, Zap,
} from 'lucide-react';
import CotizadorForm from './CotizadorForm';
import './seguros-express.css';

const products = [
  { name: 'Auto', desc: 'Cobertura amplia y asistencia vial 24/7.', icon: Car, tone: 'yellow' },
  { name: 'Vida y salud', desc: 'Protección para ti y para quienes más quieres.', icon: HeartPulse, tone: 'lime' },
  { name: 'Hogar', desc: 'Tu casa y todo lo que construiste dentro.', icon: Home, tone: 'orange' },
  { name: 'Empresarial', desc: 'Continuidad y patrimonio para tu negocio.', icon: Building2, tone: 'mint' },
  { name: 'Fianzas', desc: 'Respaldo para contratos y obligaciones.', icon: ShieldCheck, tone: 'blue' },
  { name: 'Otros seguros', desc: 'Cuéntanos qué necesitas proteger.', icon: Sparkles, tone: 'purple' },
];

const carriers = [
  ['GNP', '/gnp-logo-png_seeklogo-61558.png'],
  ['Quálitas', '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png'],
  ['Chubb', '/chubb-logo-png_seeklogo-299281.png'],
  ['Zurich', '/zurich-logo-png_seeklogo-156664.png'],
  ['MAPFRE', '/mapfre-seguros-logo-png_seeklogo-225013.png'],
  ['ANA Seguros', '/ana-seguros-logo-png_seeklogo-187684.png'],
  ['Afirme', '/afirme-logo-png_seeklogo-4173.png'],
  ['BX+', '/logo-bx.png'],
  ['Seguros Atlas', '/seguros-atlas-logo-png_seeklogo-251455.png'],
  ['Allianz', '/allianz-seguros-logo-png_seeklogo-179147.png'],
  ['Inbursa', '/inbursa-logo-png_seeklogo-403106.png'],
  ['Bupa', '/logo-bupa.png'],
] as const;

const cities = [
  { name: 'Tijuana', agents: 16, x: 4.6, y: 4.1 },
  { name: 'Monterrey', agents: 37, x: 56.8, y: 39.9 },
  { name: 'Guadalajara', agents: 41, x: 47.3, y: 66.1 },
  { name: 'Querétaro', agents: 22, x: 56.6, y: 66.5 },
  { name: 'CDMX', agents: 78, x: 60.5, y: 72.6 },
  { name: 'Puebla', agents: 15, x: 63.4, y: 74.7 },
  { name: 'Veracruz', agents: 14, x: 69.9, y: 74 },
  { name: 'Mérida', agents: 18, x: 90.3, y: 64.6 },
];

function scrollToForm() {
  document.getElementById('cotizar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export default function SegurosExpressLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCity, setActiveCity] = useState(cities[4]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const appRoot = document.getElementById('root');
    appRoot?.classList.add('public-page');
    const root = rootRef.current;
    if (!root) return () => appRoot?.classList.remove('public-page');
    const elements = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      appRoot?.classList.remove('public-page');
    };
  }, []);

  const closeAndScroll = () => {
    setMenuOpen(false);
    scrollToForm();
  };

  return (
    <div className="sx-site" ref={rootRef}>
      <Helmet>
        <title>seguros.express | Tu asesor de seguros cerca de ti</title>
        <meta name="description" content="Cotiza seguros con un asesor real cerca de ti. Comparamos las principales aseguradoras de México." />
        <meta name="theme-color" content="#164281" />
      </Helmet>

      <header className="sx-header">
        <a className="sx-logo" href="#inicio" aria-label="Seguros Express, inicio">
          <i><Zap /></i><span>seguros<b>.express</b></span>
        </a>
        <button className="sx-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Abrir navegación">
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? 'is-open' : ''}>
          <a href="#como" onClick={() => setMenuOpen(false)}>Cómo funciona</a>
          <a href="#cobertura" onClick={() => setMenuOpen(false)}>Cobertura</a>
          <a href="#seguros" onClick={() => setMenuOpen(false)}>Seguros</a>
          <button onClick={closeAndScroll}>Cotizar ahora <ArrowRight /></button>
        </nav>
      </header>

      <main>
        <section className="sx-hero" id="inicio">
          <div className="sx-orb one" /><div className="sx-orb two" />
          <div className="sx-container sx-hero-grid">
            <div className="sx-hero-copy">
              <span className="sx-eyebrow"><i /> Asesores cerca de ti, en todo México</span>
              <h1>Tu seguro, con un asesor <em>cercano y real.</em></h1>
              <p>Deja tus datos y te conectamos con un agente de tu zona que te atiende de forma personal. Sin call centers, sin vueltas.</p>
              <button className="sx-white-cta" onClick={scrollToForm}>Cotiza gratis <ArrowRight /></button>
              <small>Cotización gratis y sin compromiso.</small>
              <div className="sx-stats">
                <div><strong>+320</strong><span>asesores activos</span></div>
                <div><strong>32</strong><span>estados con cobertura</span></div>
                <div><strong>24/7</strong><span>asistencia real</span></div>
              </div>
            </div>
            <div className="sx-form-wrap" id="cotizar"><CotizadorForm /></div>
          </div>
          <a className="sx-scroll" href="#cobertura"><span>DESCUBRE MÁS</span><i /></a>
        </section>

        <section className="sx-section sx-map-section" id="cobertura">
          <div className="sx-container sx-map-grid">
            <div data-reveal>
              <span className="sx-kicker">COBERTURA NACIONAL</span>
              <h2>Una red de asesores en todo el país</h2>
              <p>Estamos donde tú estás. Nuestros asesores viven en tu ciudad, conocen tu zona y te atienden personalmente.</p>
              <div className="sx-legend"><span><i /> Asesor activo</span><span><i className="mint" /> Nueva asignación</span></div>
              <button className="sx-link" onClick={scrollToForm}>Encontrar mi asesor <ChevronRight /></button>
            </div>
            <div className="sx-map-card" data-reveal>
              <span className="sx-online"><i /> 320 asesores en línea</span>
              <div className="sx-map">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/4/45/Mexico_geoloc_blank.svg"
                  alt="Mapa geográfico de México con cobertura de asesores"
                  referrerPolicy="no-referrer"
                />
                {cities.map((city, index) => (
                  <button
                    key={city.name}
                    className={`sx-pin ${activeCity.name === city.name ? 'active' : ''}`}
                    style={{ left: `${city.x}%`, top: `${city.y}%`, animationDelay: `${index * 120}ms` }}
                    onMouseEnter={() => setActiveCity(city)}
                    onFocus={() => setActiveCity(city)}
                    onClick={() => setActiveCity(city)}
                    aria-label={`${city.name}: ${city.agents} asesores`}
                  ><i /></button>
                ))}
                <div className="sx-tooltip" style={{ left: `${Math.min(activeCity.x, 70)}%`, top: `${Math.max(activeCity.y - 13, 6)}%` }}>
                  <strong>{activeCity.name}</strong><span>{activeCity.agents} asesores disponibles</span>
                </div>
              </div>
              <div className="sx-city-tabs">
                {cities.slice(1, 5).map((city) => (
                  <button className={activeCity.name === city.name ? 'active' : ''} onClick={() => setActiveCity(city)} key={city.name}>
                    {city.name} <b>· {city.agents}</b>
                  </button>
                ))}
                <span>+28 ciudades</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sx-section sx-how" id="como">
          <div className="sx-container">
            <div className="sx-heading" data-reveal><span className="sx-kicker">CÓMO FUNCIONA</span><h2>Tres pasos y listo</h2><p>Tú nos cuentas qué necesitas; nosotros acercamos a la persona correcta.</p></div>
            <div className="sx-steps">
              {[
                ['01', 'Cuéntanos qué proteger', 'Deja tus datos y elige el tipo de seguro. Toma menos de un minuto.'],
                ['02', 'Conoce a tu asesor', 'Te conectamos con un agente real de tu zona, listo para escucharte.'],
                ['03', 'Compara y elige', 'Revisa opciones y decide con acompañamiento experto.'],
              ].map(([number, title, text], index) => (
                <article data-reveal style={{ transitionDelay: `${index * 90}ms` }} key={number}>
                  <i>{number}</i><h3>{title}</h3><p>{text}</p>{index < 2 && <ArrowRight />}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sx-section sx-products" id="seguros">
          <div className="sx-container">
            <div className="sx-heading left" data-reveal><span className="sx-kicker">LO QUE PROTEGEMOS</span><h2>Seguros para cada parte de tu vida</h2></div>
            <div className="sx-products-grid">
              {products.map(({ name, desc, icon: Icon, tone }, index) => (
                <button data-reveal style={{ transitionDelay: `${(index % 3) * 80}ms` }} onClick={scrollToForm} key={name}>
                  <i className={tone}><Icon /></i><span><b>{name}</b><small>{desc}</small></span><ChevronRight />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="sx-section sx-carriers">
          <div className="sx-container">
            <div className="sx-heading" data-reveal><span className="sx-kicker">RESPALDO</span><h2>Comparamos las principales aseguradoras de México</h2><p>Trabajamos para ti, no para una sola compañía.</p></div>
            <div className="sx-marquee" data-reveal><div>
              {[...carriers, ...carriers].map(([name, logo], index) => <span key={`${name}-${index}`}><img src={logo} alt={`Logotipo de ${name}`} loading="lazy" /></span>)}
            </div></div>
          </div>
        </section>

        <section className="sx-final">
          <div className="sx-container" data-reveal>
            <span className="sx-kicker">TU TRANQUILIDAD EMPIEZA AQUÍ</span><h2>¿Listo para hablar con un asesor real?</h2>
            <p>Cuéntanos qué quieres proteger. Te conectamos hoy mismo.</p>
            <button onClick={scrollToForm}>Cotiza gratis <ArrowRight /></button><small>Sin costo. Sin compromiso. Sin spam.</small>
          </div>
        </section>
      </main>

      <footer className="sx-footer">
        <div className="sx-container">
          <div><a className="sx-logo" href="#inicio"><i><Zap /></i><span>seguros<b>.express</b></span></a><p>Un portal de la red de asesores MOVI.</p></div>
          <div><a href="mailto:hola@seguros.express"><Mail /> hola@seguros.express</a><a href="tel:+525512345678"><Phone /> +52 55 1234 5678</a></div>
          <p>© {new Date().getFullYear()} Seguros Express. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
