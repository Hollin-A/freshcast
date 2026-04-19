import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-terra/10 text-terra-dk border-terra/25",
        secondary:
          "bg-shell text-body border-line",
        destructive:
          "bg-terra/10 text-terra border-terra/25",
        outline:
          "border-line text-ink",
        ghost:
          "hover:bg-shell hover:text-body",
        link: "text-terra underline-offset-4 hover:underline",
        olive: "bg-olive/10 text-olive-dk border-olive/25",
        gold: "bg-harvest/12 text-[#8A6520] border-harvest/30",
        plum: "bg-plum/10 text-plum border-plum/25",
        ink: "bg-ink text-cream border-ink",
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
