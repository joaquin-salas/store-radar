import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // A slow left-to-right sweep, like the radar; still under reduced motion.
        "relative overflow-hidden rounded-md bg-muted after:absolute after:inset-0 after:-translate-x-full after:bg-linear-to-r after:from-transparent after:via-card/70 after:to-transparent motion-safe:after:animate-[sr-sweep_1.6s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
