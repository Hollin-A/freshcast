import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-line bg-paper px-4 py-2 text-base text-ink transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-mute2 focus-visible:border-terra focus-visible:ring-3 focus-visible:ring-terra/12 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-shell/50 disabled:opacity-50 aria-invalid:border-terra aria-invalid:ring-3 aria-invalid:ring-terra/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
