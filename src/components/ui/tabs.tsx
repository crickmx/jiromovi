import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

// Two tab treatments, chosen by intent:
//  • "pill"      → segmented control, for toggling views inside a page (default, unchanged)
//  • "underline" → page-level section navigation
type TabsVariant = "pill" | "underline"
const TabsVariantContext = React.createContext<TabsVariant>("pill")

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "text-neutral-500 dark:text-white/50",
        variant === "underline"
          ? "inline-flex h-10 items-center justify-start gap-0 border-b border-neutral-200 dark:border-white/10"
          : cn(
              "inline-flex h-10 items-center justify-start rounded-xl",
              "bg-neutral-100/80 dark:bg-white/8",
              "p-1 gap-0.5"
            ),
        className
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        "text-sm font-medium",
        "ring-offset-background transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "underline"
          ? cn(
              "relative rounded-none border-b-2 border-transparent -mb-px",
              "mx-3 first:ml-0 px-1 py-2",
              "hover:text-neutral-800 dark:hover:text-white/80",
              "data-[state=active]:border-accent data-[state=active]:text-accent",
              "dark:data-[state=active]:text-white dark:data-[state=active]:border-accent"
            )
          : cn(
              "rounded-lg px-3.5 py-1.5",
              "data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm",
              "dark:data-[state=active]:bg-white/12 dark:data-[state=active]:text-white"
            ),
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-2",
      "animate-fade-in",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
