import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-neutral-100 dark:bg-white/5 shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
