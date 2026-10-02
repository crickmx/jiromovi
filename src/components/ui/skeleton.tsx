import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-surface-muted dark:bg-white/5 shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
