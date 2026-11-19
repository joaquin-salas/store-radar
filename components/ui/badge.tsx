import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Badges label with a word or two. Status variants always carry an icon or the
// Live dot; neutral variants are for categories (a tier is not good or bad).
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-xs border border-transparent px-[7px] text-[11.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border-line-control text-foreground",
        ping: "bg-ping-soft text-ping-text",
        live: "bg-status-good-soft text-status-good rounded-full before:size-1.5 before:rounded-full before:bg-current motion-safe:before:animate-[pulse_2.4s_ease-in-out_infinite]",
        warning: "bg-status-warning-soft text-status-warning",
        destructive: "bg-status-critical-soft text-status-critical",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-ping-text underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
