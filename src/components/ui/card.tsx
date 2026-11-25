import * as React from "react"
import { cn } from "@/lib/utils"

// ── Card ──────────────────────────────────────────────────────────────────────
// Lenguaje «Tarjeta con zócalo»: esquinas rectas, borde sólido de 1px, sin
// sombra y sin degradados. El hover lleva el borde al color del texto principal.

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }
>(({ className, hover = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-none border border-soft bg-surface-card",
      "transition-[border-color,background-color] duration-base ease-smooth",
      hover && [
        "cursor-pointer",
        "hover:border-neutral-900 dark:hover:border-white",
      ],
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

// ── Card sub-sections ─────────────────────────────────────────────────────────

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-6 sm:p-[30px] pb-0 sm:pb-0", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display text-title-sm font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-neutral-500 dark:text-white/60 leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 sm:p-[30px] pt-4 sm:pt-4", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-6 sm:p-[30px] pt-4 sm:pt-4 border-t border-soft mt-0",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
