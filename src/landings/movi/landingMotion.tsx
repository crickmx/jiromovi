// Piezas de motion y decoración de la landing de movi.digital.
// Todo es presentación: ninguna pieza agrega texto. Solo anima transform/opacity
// y respeta prefers-reduced-motion (sin animación, todo aparece en su lugar).
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  animate,
  type Variants,
} from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

// Sombra suave multicapa y borde fino que comparten todas las superficies.
export const SURFACE =
  'bg-white border border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.05),0_16px_40px_-12px_rgba(15,23,42,0.08)]';

export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Fade + translateY(24px) al entrar al viewport. Con `stagger`, anima a sus hijos <RevealItem> con 60ms de desfase. */
export function Reveal({
  children,
  className,
  stagger = false,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  as?: 'div' | 'section' | 'ul';
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={
        stagger
          ? { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
          : revealVariants
      }
    >
      {children}
    </Comp>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={revealVariants}>
      {children}
    </motion.div>
  );
}

/** Flotación idle (y ±6px) para elementos decorativos. */
export function Float({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -6, 0, 6, 0] }}
      transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card con hover premium: se eleva 4px, el borde se ilumina con el primario
 * y un spotlight sigue al cursor.
 */
export function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`group relative overflow-hidden rounded-2xl ${SURFACE} transition-[border-color,box-shadow] duration-300 hover:border-blue-500/40 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-4px_rgba(37,99,235,0.10),0_24px_48px_-16px_rgba(37,99,235,0.18)] ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(360px circle at var(--sx, 50%) var(--sy, 50%), rgba(37,99,235,0.08), transparent 60%)' }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

/**
 * Cuenta desde 0 hasta el valor que YA muestra la página y termina exactamente en él.
 * `value` es el texto final tal cual (p. ej. "100%" o "48,920.00"); solo se anima la parte numérica.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const m = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!m || reduce || !inView) return;
    const [, pre, num, post] = m;
    const target = parseFloat(num.replace(/,/g, ''));
    const decimals = num.includes('.') ? num.split('.')[1].length : 0;
    const fmt = (n: number) =>
      pre + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: num.includes(',') }) + post;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: EASE,
      onUpdate: v => setShown(fmt(v)),
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`}>
      {shown}
    </span>
  );
}

/** Marco de mockup con perspectiva 3D sutil que se endereza al hacer scroll (solo en escritorio). */
export function TiltFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const upd = () => setDesktop(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 35%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const active = desktop && !reduce;
  return (
    <div ref={ref} className={className} style={{ perspective: active ? 1600 : undefined }}>
      <motion.div style={active ? { rotateX, scale, y, transformOrigin: 'center top' } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}

/** Parallax ligero: desplaza su contenido más lento que el scroll. */
export function Parallax({ children, className, offset = 60 }: { children: ReactNode; className?: string; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, offset]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

// ─── Gráficos decorativos (sin cifras ni texto) ─────────────────────────────

const draw = (reduce: boolean | null, delay = 0) =>
  reduce
    ? {}
    : {
        initial: { pathLength: 0, opacity: 0 },
        whileInView: { pathLength: 1, opacity: 1 },
        viewport: { once: true },
        transition: { duration: 1.4, ease: EASE, delay },
      };

/** Área con gradiente + línea que se dibuja al entrar. */
export function DecoArea({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const line = 'M0 70 C 30 64, 50 40, 80 46 S 130 70, 160 50 S 210 18, 240 26 S 290 44, 320 14';
  return (
    <svg viewBox="0 0 320 90" className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="decoAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(37,99,235)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(37,99,235)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L320 90 L0 90 Z`}
        fill="url(#decoAreaFill)"
        {...(reduce ? {} : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.9, ease: EASE, delay: 0.4 } })}
      />
      <motion.path d={line} fill="none" stroke="rgb(37,99,235)" strokeWidth="2" strokeLinecap="round" {...draw(reduce)} />
    </svg>
  );
}

/** Barras que crecen al entrar (el SVG dispara la animación; cada barra entra con 60ms de desfase). */
export function DecoBars({ className = '', bars = [38, 56, 44, 70, 62, 84, 76, 92] }: { className?: string; bars?: number[] }) {
  const reduce = useReducedMotion();
  const w = 100 / bars.length;
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true }}
    >
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={i * w + w * 0.18}
          width={w * 0.64}
          y={100 - h}
          height={h}
          rx={1.6}
          fill={i === bars.length - 1 ? 'rgb(37,99,235)' : 'rgba(37,99,235,0.18)'}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          variants={{
            hidden: { scaleY: 0 },
            show: { scaleY: 1, transition: { duration: 0.6, ease: EASE, delay: 0.1 + i * 0.06 } },
          }}
        />
      ))}
    </motion.svg>
  );
}

/** Sparkline simple. */
export function DecoSpark({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 32" className={className} aria-hidden="true" fill="none">
      <motion.path
        d="M1 26 L14 22 L26 24 L38 15 L50 18 L62 10 L74 13 L86 6 L98 9 L119 3"
        stroke="rgb(37,99,235)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw(reduce, 0.15)}
      />
    </svg>
  );
}

/** Ondas concéntricas abstractas (eco del isotipo) para el fondo del hero. */
export function DecoWaves({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true" fill="none">
      {[180, 140, 100, 60].map((r, i) => (
        <motion.circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          stroke="rgb(37,99,235)"
          strokeOpacity={0.1 + i * 0.04}
          strokeWidth="1"
          strokeDasharray="2 6"
          {...draw(reduce, i * 0.12)}
        />
      ))}
    </svg>
  );
}
