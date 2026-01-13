import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-white/5",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent",
        "before:animate-[shimmer_2s_infinite]",
        className
      )}
      style={{
        backgroundSize: '200% 100%',
      }}
      {...props}
    />
  )
}

export { Skeleton }
