import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary-strong border-primary/25",
        secondary:
          "bg-muted text-soft-foreground border-border",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/25",
        outline:
          "border-border text-foreground",
        ghost:
          "hover:bg-muted hover:text-soft-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success/10 text-success-foreground border-success/25",
        warning: "bg-warning/12 text-warning-foreground border-warning/30",
        inverse: "bg-inverse text-inverse-foreground border-inverse",
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
