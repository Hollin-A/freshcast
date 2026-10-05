"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-terra text-[#FFF8EC] hover:bg-terra-dk",
        outline:
          "border-line bg-paper text-ink hover:bg-shell",
        secondary:
          "bg-shell text-ink border-line hover:bg-line",
        ghost:
          "hover:bg-shell hover:text-ink",
        destructive:
          "bg-terra/10 text-terra hover:bg-terra/20 focus-visible:border-terra/40 focus-visible:ring-terra/20",
        link: "text-terra underline-offset-4 hover:underline",
        dark: "bg-ink text-cream hover:bg-ink/90",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 px-3 text-xs",
        sm: "h-8 gap-1.5 px-3 text-[0.8rem]",
        lg: "h-12 gap-2 px-5 text-base",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
