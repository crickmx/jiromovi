import * as React from "react"
import { ArrowRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Tarjeta con zócalo — lenguaje «Tarjeta con zócalo» (Propuesta C).
 *
 * Cuerpo: fondo de superficie, borde sólido de 1px, esquinas rectas, sin sombra
 * ni degradados. Arriba, los logos sueltos sobre el fondo (sin recuadro) dentro
 * de un área de altura fija para que todas las tarjetas queden alineadas.
 * Abajo, un zócalo de acción a ancho completo, pegado al borde inferior, con el
 * color primario y una flecha de línea fina.
 *
 * Al pasar el cursor: el borde toma el color del texto principal y el zócalo el
 * acento del producto (`accent`), y la flecha se desplaza 6px. 200 ms.
 *
 * Los colores salen de los tokens existentes (`surface-card`, `soft`, `accent`,
 * `accent-foreground`); el acento por producto se recibe por clase para no
 * inventar tonos nuevos.
 */
export interface ZocaloCardProps {
  title: string
  description: string
  /** Un logo que va suelto sobre el fondo (sin recuadro ni fondo propio). */
  logo?: string | null
  /** Varios logos juntos (comparadores que traen más de una aseguradora). */
  logos?: string[]
  /** Icono de línea, cuando el módulo no tiene logo propio. */
  icon?: LucideIcon
  /** Clases del acento del producto (color del icono sin logo). */
  iconColor?: string
  /** Datos que se listan en dos columnas con viñeta cuadrada de 6px. */
  bullets?: string[]
  /** Clases del acento del producto para las viñetas (p. ej. «bg-teal-600»). */
  bulletColor?: string
  /** Texto del zócalo de acción. */
  cta?: string
  /** Clases del acento del producto para el zócalo al pasar el cursor. */
  accent?: string
  onClick?: () => void
  className?: string
}

export function ZocaloCard({
  title,
  description,
  logo,
  logos,
  icon: Icon,
  iconColor,
  bullets,
  bulletColor = "bg-accent",
  cta = "Abrir",
  accent,
  onClick,
  className,
}: ZocaloCardProps) {
  const logosToShow = logos?.length ? logos : logo ? [logo] : []

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-full w-full flex-col border border-soft bg-surface-card text-left",
        "transition-colors duration-200 ease-smooth",
        "hover:border-neutral-900 dark:hover:border-white",
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className
      )}
    >
      {/* ── Cuerpo ── */}
      <div className="flex flex-1 flex-col px-[30px] pt-[30px] pb-7">
        {/* Área de logos de altura fija: sin recuadro, sin fondo, alineados a la izquierda */}
        <div className="flex h-[50px] items-center gap-4">
          {logosToShow.length > 0 ? (
            logosToShow.map((src) => (
              <img
                key={src}
                src={src}
                alt={title}
                className="max-h-[42px] w-auto max-w-[150px] object-contain object-left"
              />
            ))
          ) : Icon ? (
            <Icon className={cn("h-8 w-8", iconColor)} strokeWidth={1.5} aria-hidden="true" />
          ) : null}
        </div>

        <h3 className="mt-4 font-display text-[25px] font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-3 text-[14px] leading-[1.6] text-neutral-500 dark:text-neutral-400">
          {description}
        </p>

        {bullets && bullets.length > 0 && (
          <ul className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2.5 border-t border-soft pt-4">
            {bullets.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-neutral-600 dark:text-neutral-300"
              >
                <span
                  className={cn("mt-[6px] h-1.5 w-1.5 shrink-0", bulletColor)}
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Zócalo de acción ── */}
      <div
        className={cn(
          "flex h-[60px] w-full shrink-0 items-center justify-between bg-accent px-[30px]",
          "text-accent-foreground transition-colors duration-200 ease-smooth",
          accent
        )}
      >
        <span className="font-display text-[14px] font-semibold tracking-[-0.005em]">
          {cta}
        </span>
        <ArrowRight
          className="h-5 w-5 transition-transform duration-200 ease-smooth group-hover:translate-x-1.5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
    </button>
  )
}
